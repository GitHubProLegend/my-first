/* UI wiring, conversation state, streaming fetch loop. */

const $ = id => document.getElementById(id);
const els = {
  key: $('apikey'), toggleKey: $('toggle-key'), detected: $('detected'),
  provider: $('detected-provider'), note: $('detected-note'),
  model: $('model'), customModel: $('custom-model'), system: $('system'),
  remember: $('remember'), clearChat: $('clear-chat'),
  messages: $('messages'), composer: $('composer'), prompt: $('prompt'),
  send: $('send'), error: $('error')
};

const STORE_KEY = 'key2chat.key';
const STORE_MODEL = 'key2chat.model';
let current = null;      // provider name
let messages = [];       // [{role, content}]
let busy = false;

/* ---------- provider detection ---------- */

function refreshProvider() {
  const name = detectProvider(els.key.value);
  if (name === current) return;
  current = name;

  if (!name) {
    els.detected.className = 'detected unknown';
    els.provider.textContent = els.key.value.trim() ? 'Unrecognized key' : 'No key yet';
    els.note.textContent = els.key.value.trim()
      ? 'Not an Anthropic, OpenAI, or Google key.'
      : 'Enter a key to detect your provider.';
    els.model.innerHTML = '';
    els.model.disabled = true;
    els.customModel.classList.add('hidden');
    return;
  }

  const p = PROVIDERS[name];
  els.detected.className = 'detected ' + name;
  els.provider.textContent = p.label;
  els.note.textContent = p.note;

  els.model.disabled = false;
  els.model.innerHTML = '';
  for (const m of p.models) {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.label;
    els.model.appendChild(o);
  }
  const custom = document.createElement('option');
  custom.value = '__custom__';
  custom.textContent = 'Other (type a model id)…';
  els.model.appendChild(custom);

  const saved = localStorage.getItem(STORE_MODEL + '.' + name);
  if (saved && p.models.some(m => m.id === saved)) els.model.value = saved;
  onModelChange();
}

function onModelChange() {
  const isCustom = els.model.value === '__custom__';
  els.customModel.classList.toggle('hidden', !isCustom);
  if (isCustom) els.customModel.focus();
  else if (current) localStorage.setItem(STORE_MODEL + '.' + current, els.model.value);
}

function selectedModel() {
  return els.model.value === '__custom__' ? els.customModel.value.trim() : els.model.value;
}

/* ---------- rendering ---------- */

function render() {
  els.messages.innerHTML = '';
  if (!messages.length) {
    els.messages.innerHTML =
      '<div class="empty"><h2>Ready when you are</h2><p>Add a key on the left, then send a prompt.</p></div>';
    return;
  }
  for (const m of messages) els.messages.appendChild(bubble(m.role, m.content));
  scroll();
}

function bubble(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = role === 'user' ? 'You' : (current ? PROVIDERS[current].label : 'Assistant');
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = text;
  wrap.append(who, body);
  return wrap;
}

const scroll = () => { els.messages.scrollTop = els.messages.scrollHeight; };

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.remove('hidden');
}
const clearError = () => els.error.classList.add('hidden');

/* ---------- sending ---------- */

async function send(text) {
  const key = els.key.value.trim();
  if (!key) return showError('Enter an API key first.');
  if (!current) return showError('That key does not match a provider we know.');
  const model = selectedModel();
  if (!model) return showError('Choose or type a model id.');

  clearError();
  messages.push({ role: 'user', content: text });
  render();

  const reply = { role: 'assistant', content: '' };
  messages.push(reply);
  const node = bubble('assistant', '…');
  els.messages.appendChild(node);
  const body = node.querySelector('.body');
  scroll();

  setBusy(true);
  try {
    const p = PROVIDERS[current];
    const req = p.request(key, model, els.system.value.trim(), messages.slice(0, -1));
    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body)
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status} ${res.statusText} — ${detail.slice(0, 400)}`);
    }

    await readStream(res, chunk => {
      reply.content += chunk;
      body.textContent = reply.content;
      scroll();
    });

    if (!reply.content) body.textContent = '(empty response)';
  } catch (err) {
    messages.pop();
    node.remove();
    showError(String(err.message || err));
  } finally {
    setBusy(false);
  }
}

async function readStream(res, onText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut;
    while ((cut = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        onText(PROVIDERS[current].parse(JSON.parse(payload)));
      } catch (_) { /* ignore keep-alives and partial frames */ }
    }
  }
}

function setBusy(v) {
  busy = v;
  els.send.disabled = v;
  els.send.textContent = v ? '…' : 'Send';
  els.prompt.disabled = v;
  if (!v) els.prompt.focus();
}

/* ---------- events ---------- */

els.key.addEventListener('input', () => {
  refreshProvider();
  if (els.remember.checked) localStorage.setItem(STORE_KEY, els.key.value);
});

els.toggleKey.addEventListener('click', () => {
  els.key.type = els.key.type === 'password' ? 'text' : 'password';
});

els.model.addEventListener('change', onModelChange);

els.remember.addEventListener('change', () => {
  if (els.remember.checked) localStorage.setItem(STORE_KEY, els.key.value);
  else localStorage.removeItem(STORE_KEY);
});

els.clearChat.addEventListener('click', () => { messages = []; clearError(); render(); });

els.prompt.addEventListener('input', () => {
  els.prompt.style.height = 'auto';
  els.prompt.style.height = Math.min(els.prompt.scrollHeight, 180) + 'px';
});

els.prompt.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});

els.composer.addEventListener('submit', e => {
  e.preventDefault();
  const text = els.prompt.value.trim();
  if (!text || busy) return;
  els.prompt.value = '';
  els.prompt.style.height = 'auto';
  send(text);
});

/* ---------- boot ---------- */

const saved = localStorage.getItem(STORE_KEY);
if (saved) {
  els.key.value = saved;
  els.remember.checked = true;
}
refreshProvider();
render();

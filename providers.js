/* Provider registry: key detection, model lists, request building, stream parsing. */

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    note: 'Detected an Anthropic key — Claude models.',
    matches: k => k.startsWith('sk-ant-'),
    models: [
      { id: 'claude-fable-5-1', label: 'Fable 5.1' },
      { id: 'claude-opus-5', label: 'Opus 5' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' }
    ],
    request(key, model, system, messages) {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: {
          model,
          max_tokens: 4096,
          stream: true,
          ...(system ? { system } : {}),
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        }
      };
    },
    // Returns text delta for one SSE data payload, or '' if not a text event.
    parse(json) {
      if (json.type === 'content_block_delta' && json.delta && json.delta.type === 'text_delta') {
        return json.delta.text;
      }
      return '';
    }
  },

  openai: {
    label: 'OpenAI (GPT)',
    note: 'Detected an OpenAI key — GPT models.',
    matches: k => /^sk-(proj-)?[A-Za-z0-9_\-]/.test(k),
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o4-mini', label: 'o4-mini' }
    ],
    request(key, model, system, messages) {
      const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: { model, stream: true, messages: msgs.map(m => ({ role: m.role, content: m.content })) }
      };
    },
    parse(json) {
      const c = json.choices && json.choices[0];
      return (c && c.delta && c.delta.content) || '';
    }
  },

  google: {
    label: 'Google (Gemini)',
    note: 'Detected a Google AI Studio key — Gemini models.',
    matches: k => k.startsWith('AIza'),
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
    ],
    request(key, model, system, messages) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
        headers: { 'content-type': 'application/json' },
        body: {
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        }
      };
    },
    parse(json) {
      const cand = json.candidates && json.candidates[0];
      const parts = cand && cand.content && cand.content.parts;
      return parts ? parts.map(p => p.text || '').join('') : '';
    }
  }
};

// Order matters: the most specific prefix wins.
const DETECT_ORDER = ['anthropic', 'google', 'openai'];

function detectProvider(key) {
  const k = (key || '').trim();
  if (!k) return null;
  for (const name of DETECT_ORDER) {
    if (PROVIDERS[name].matches(k)) return name;
  }
  return null;
}

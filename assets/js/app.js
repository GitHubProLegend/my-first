/* ==========================================================================
   BallBetter — interaction layer
   Motion is spring-driven so it can be interrupted, re-targeted from the
   live on-screen value, and handed the pointer's velocity at release.
   ========================================================================== */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------------------
     Spring
     Critically damped by default (no overshoot). Always starts from the
     current value and the current velocity, so an interrupt re-targets
     without a discontinuity — no "brick wall" on reversal.
     --------------------------------------------------------------------- */
  class Spring {
    /** @param {(v:number)=>void} onFrame */
    constructor(value, onFrame, { response = 0.4, damping = 1.0 } = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.onFrame = onFrame;
      this.setStiffness(response, damping);
      this.raf = 0;
      this.last = 0;
      this.onRest = null;
    }
    setStiffness(response, damping) {
      // response is the time to reach the target; convert to angular frequency.
      this.omega = (2 * Math.PI) / response;
      this.zeta = damping;
    }
    /** Re-target mid-flight. Velocity carries through by design. */
    to(target, { velocity, response, damping, onRest } = {}) {
      this.target = target;
      if (typeof velocity === 'number') this.velocity = velocity;
      if (response) this.setStiffness(response, damping ?? this.zeta);
      if (onRest) this.onRest = onRest;
      if (reduced.matches) return this.snap(target);
      this.start();
    }
    /** Jump straight there — used while a pointer is driving the value 1:1. */
    set(value, velocity = 0) {
      this.stop();
      this.value = value;
      this.velocity = velocity;
      this.onFrame(this.value);
    }
    snap(value) {
      this.set(value, 0);
      this.target = value;
      if (this.onRest) { const cb = this.onRest; this.onRest = null; cb(); }
    }
    start() {
      if (this.raf) return;
      this.last = performance.now();
      const tick = (now) => {
        // Clamp dt so a backgrounded tab does not explode the integration.
        const dt = Math.min((now - this.last) / 1000, 1 / 30);
        this.last = now;
        this.step(dt);
        this.onFrame(this.value);
        const settled =
          Math.abs(this.value - this.target) < 0.05 && Math.abs(this.velocity) < 0.05;
        if (settled) {
          this.raf = 0;
          this.value = this.target;
          this.velocity = 0;
          this.onFrame(this.value);
          if (this.onRest) { const cb = this.onRest; this.onRest = null; cb(); }
          return;
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    step(dt) {
      const k = this.omega * this.omega;
      const c = 2 * this.zeta * this.omega;
      const a = -k * (this.value - this.target) - c * this.velocity;
      this.velocity += a * dt;
      this.value += this.velocity * dt;
    }
    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /* Where a flick is going, not just where it was released.
     Exponential decay — the form Apple ships. */
  const project = (velocity, decel = 0.998) => (velocity / 1000) * decel / (1 - decel);

  /* Progressive resistance past a boundary. Follows less the further you go. */
  const rubberband = (overshoot, dimension, c = 0.55) =>
    (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

  /* Position/time history → velocity in px/s, from the last ~90 ms. */
  class VelocityTracker {
    constructor() { this.samples = []; }
    add(v) {
      const now = performance.now();
      this.samples.push({ v, t: now });
      while (this.samples.length > 2 && now - this.samples[0].t > 90) this.samples.shift();
    }
    get() {
      if (this.samples.length < 2) return 0;
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      const dt = (b.t - a.t) / 1000;
      return dt > 0 ? (b.v - a.v) / dt : 0;
    }
    reset() { this.samples.length = 0; }
  }

  /* ---------------------------------------------------------------------
     Artwork — drawn, so it is crisp at any size and follows the theme.
     --------------------------------------------------------------------- */
  const ART = {
    ball(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <defs><radialGradient id="bg${hue}" cx="36%" cy="30%" r="78%">
          <stop offset="0%" stop-color="hsl(${hue} 90% 62%)"/>
          <stop offset="62%" stop-color="hsl(${hue} 82% 48%)"/>
          <stop offset="100%" stop-color="hsl(${hue} 72% 30%)"/>
        </radialGradient></defs>
        <circle cx="100" cy="100" r="92" fill="url(#bg${hue})"/>
        <g fill="none" stroke="rgba(20,10,4,.72)" stroke-width="3.4" stroke-linecap="round">
          <path d="M8 100h184"/><path d="M100 8v184"/>
          <path d="M34 34c40 30 40 102 0 132"/>
          <path d="M166 34c-40 30-40 102 0 132"/>
        </g>
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="3"/>
      </svg>`;
    },
    shoe(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <defs><linearGradient id="sg${hue}" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 82% 64%)"/>
          <stop offset="100%" stop-color="hsl(${hue} 74% 38%)"/>
        </linearGradient></defs>
        <!-- upper: toe at left, ankle collar at right -->
        <path d="M24 126c0-16 7-29 20-38 11-8 19-19 23-32 3-9 12-14 22-12l24 5c11 2 15 11 14 22l-2 22c-1 9 5 15 14 18l22 7c11 4 17 11 17 20H24z"
              fill="url(#sg${hue})"/>
        <!-- collar opening -->
        <path d="M92 45c9 6 22 7 32 3" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="4" stroke-linecap="round"/>
        <!-- side panel -->
        <path d="M56 116c14-20 34-33 58-38" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="7" stroke-linecap="round"/>
        <!-- laces -->
        <g stroke="rgba(255,255,255,.72)" stroke-width="3.2" stroke-linecap="round">
          <path d="M60 88l20 10"/><path d="M69 75l21 10"/><path d="M80 63l20 10"/>
        </g>
        <!-- midsole + outsole -->
        <path d="M18 128h164c2 8-1 14-7 14H25c-6 0-9-6-7-14z" fill="hsl(${hue} 20% 92%)"/>
        <path d="M20 142h160c2 10-5 17-17 17H37c-12 0-19-7-17-17z" fill="rgba(14,18,26,.9)"/>
        <g stroke="rgba(255,255,255,.16)" stroke-width="2.4">
          <path d="M52 145v11M76 145v11M100 145v11M124 145v11M148 145v11"/>
        </g>
      </svg>`;
    },
    hoop(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <rect x="34" y="24" width="132" height="82" rx="7"
              fill="hsl(${hue} 60% 52% / .22)" stroke="hsl(${hue} 55% 60%)" stroke-width="3.5"/>
        <rect x="78" y="52" width="44" height="34" rx="3" fill="none"
              stroke="hsl(${hue} 60% 68%)" stroke-width="3.5"/>
        <path d="M74 106h52" stroke="hsl(18 88% 55%)" stroke-width="6" stroke-linecap="round"/>
        <g stroke="rgba(150,160,175,.85)" stroke-width="2.2" fill="none">
          <path d="M78 108l8 30M100 108v32M122 108l-8 30"/>
          <path d="M82 122h36M86 136h28"/>
        </g>
        <path d="M100 106v70" stroke="hsl(${hue} 20% 45%)" stroke-width="9" stroke-linecap="round"/>
      </svg>`;
    },
    sensor(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <rect x="52" y="66" width="96" height="68" rx="18"
              fill="hsl(${hue} 55% 30%)" stroke="hsl(${hue} 70% 62%)" stroke-width="3"/>
        <circle cx="100" cy="100" r="15" fill="hsl(${hue} 85% 66%)"/>
        <circle cx="100" cy="100" r="6" fill="rgba(255,255,255,.9)"/>
        <g fill="none" stroke="hsl(${hue} 78% 64%)" stroke-width="3.4" stroke-linecap="round" opacity=".75">
          <path d="M42 78c-12 14-12 30 0 44"/><path d="M158 78c12 14 12 30 0 44"/>
          <path d="M26 64c-20 22-20 50 0 72" opacity=".45"/><path d="M174 64c20 22 20 50 0 72" opacity=".45"/>
        </g>
      </svg>`;
    },
    kit(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <defs><linearGradient id="kg${hue}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 75% 58%)"/>
          <stop offset="100%" stop-color="hsl(${hue} 70% 38%)"/>
        </linearGradient></defs>
        <path d="M66 34l-34 20 14 26 20-10v76c0 6 4 10 10 10h48c6 0 10-4 10-10V70l20 10 14-26-34-20-22 12h-24z"
              fill="url(#kg${hue})"/>
        <path d="M88 34a12 12 0 0 0 24 0" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="3"/>
        <text x="100" y="128" text-anchor="middle" font-family="system-ui" font-size="34"
              font-weight="700" fill="rgba(255,255,255,.85)">7</text>
      </svg>`;
    },
    bag(hue) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <path d="M74 62V52a26 26 0 0 1 52 0v10" fill="none"
              stroke="hsl(${hue} 45% 58%)" stroke-width="6" stroke-linecap="round"/>
        <rect x="26" y="62" width="148" height="82" rx="26" fill="hsl(${hue} 42% 32%)"/>
        <rect x="26" y="88" width="148" height="18" fill="hsl(${hue} 55% 46%)"/>
        <rect x="82" y="112" width="36" height="14" rx="7" fill="rgba(255,255,255,.28)"/>
      </svg>`;
    },
  };

  const artFor = (p) => {
    if (p.category === 'footwear') return ART.shoe(p.hue);
    if (p.category === 'hoops') return ART.hoop(p.hue);
    if (p.id === 'rep-counter') return ART.sensor(p.hue);
    if (p.id === 'gym-carry') return ART.bag(p.hue);
    if (p.category === 'apparel') return ART.kit(p.hue);
    return ART.ball(p.hue);
  };

  /* ---------------------------------------------------------------------
     Cart — persisted, and the single source the whole UI reads from.
     --------------------------------------------------------------------- */
  const KEY = 'ballbetter.cart.v1';
  const cart = {
    items: [],
    load() {
      try { this.items = JSON.parse(localStorage.getItem(KEY)) || []; }
      catch { this.items = []; }
      if (!Array.isArray(this.items)) this.items = [];
      this.items = this.items.filter((i) => i && findProduct(i.id));
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.items)); } catch { /* private mode */ }
      this.emit();
    },
    add(id, qty = 1) {
      const line = this.items.find((i) => i.id === id);
      if (line) line.qty += qty; else this.items.push({ id, qty });
      this.save();
    },
    setQty(id, qty) {
      const line = this.items.find((i) => i.id === id);
      if (!line) return;
      line.qty = qty;
      if (line.qty <= 0) this.items = this.items.filter((i) => i.id !== id);
      this.save();
    },
    get count() { return this.items.reduce((n, i) => n + i.qty, 0); },
    get subtotal() {
      return this.items.reduce((n, i) => n + findProduct(i.id).price * i.qty, 0);
    },
    emit() { document.dispatchEvent(new CustomEvent('cart:change')); },
  };
  cart.load();

  /* ---------------------------------------------------------------------
     Press feedback — on pointerdown, never on click. Cancels if the
     pointer drags away, and returns if it comes back.
     --------------------------------------------------------------------- */
  const PRESSABLE = '.btn, .chip, .card, .rail__btn, .sheet__close, .qty button, .nav__cart';
  const HYSTERESIS = 10;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(PRESSABLE);
    if (!el || el.hasAttribute('disabled')) return;
    el.classList.add('is-pressed');
    const rect = el.getBoundingClientRect();
    const move = (ev) => {
      const inside =
        ev.clientX > rect.left - HYSTERESIS && ev.clientX < rect.right + HYSTERESIS &&
        ev.clientY > rect.top - HYSTERESIS && ev.clientY < rect.bottom + HYSTERESIS;
      el.classList.toggle('is-pressed', inside);
    };
    const up = () => {
      el.classList.remove('is-pressed');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });

  /* ---------------------------------------------------------------------
     Chrome: nav material, mobile menu, scroll edge.
     --------------------------------------------------------------------- */
  function mountNav() {
    const nav = $('.nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const toggle = $('.nav__menu');
    const links = $('.nav__links');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          links.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__link').forEach((a) => {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------------------------------------------------------------------
     Cart sheet. Slides in from the right, dismisses to the right, and can
     be grabbed mid-flight: the drag starts from wherever it currently is.
     --------------------------------------------------------------------- */
  function mountSheet() {
    const sheet = $('.sheet');
    const scrim = $('.scrim');
    if (!sheet || !scrim) return;

    const width = () => sheet.getBoundingClientRect().width || 420;
    let open = false;
    let lastFocus = null;

    const spring = new Spring(100, (v) => {
      sheet.style.transform = `translateX(${v}%)`;
    }, { response: 0.34, damping: 1.0 });

    function show() {
      if (open) return;
      open = true;
      lastFocus = document.activeElement;
      sheet.classList.add('is-open');
      scrim.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      spring.to(0, { response: 0.34, damping: 1.0 });
      requestAnimationFrame(() => $('.sheet__close', sheet)?.focus());
    }
    function hide(velocityPercent = 0) {
      if (!open) return;
      open = false;
      scrim.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      spring.to(100, {
        velocity: velocityPercent,
        response: 0.34,
        damping: 1.0,
        onRest: () => { if (!open) sheet.classList.remove('is-open'); },
      });
      lastFocus?.focus?.();
    }

    $$('[data-cart-open]').forEach((b) => b.addEventListener('click', show));
    $('.sheet__close', sheet)?.addEventListener('click', () => hide());
    scrim.addEventListener('click', () => hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) hide();
      if (e.key === 'Tab' && open) trapFocus(e, sheet);
    });

    /* Drag to dismiss: 1:1 tracking, resistance past the open edge,
       and the release decided by velocity rather than position alone. */
    const head = $('.sheet__head', sheet);
    if (head && !reduced.matches) {
      const tracker = new VelocityTracker();
      let dragging = false, startX = 0, startValue = 0;

      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        head.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startValue = spring.value;       // grab from the live on-screen value
        spring.stop();
        tracker.reset();
        tracker.add(e.clientX);
      });
      head.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        tracker.add(e.clientX);
        const w = width();
        let next = startValue + ((e.clientX - startX) / w) * 100;
        if (next < 0) next = -rubberband(-next, 100);   // resist past fully-open
        spring.set(next);
      });
      const end = (e) => {
        if (!dragging) return;
        dragging = false;
        head.releasePointerCapture?.(e.pointerId);
        const w = width();
        const vPx = tracker.get();                       // px/s
        const vPct = (vPx / w) * 100;                    // %/s, the spring's unit
        const projected = spring.value + (project(vPx) / w) * 100;
        if (projected > 45 || vPct > 260) hide(vPct);
        else spring.to(0, { velocity: vPct, response: 0.34, damping: 1.0 });
      };
      head.addEventListener('pointerup', end);
      head.addEventListener('pointercancel', end);
    }

    document.addEventListener('cart:added', show);
    render();
    document.addEventListener('cart:change', render);

    function render() {
      const body = $('.sheet__body', sheet);
      const total = $('.sheet__total', sheet);
      const checkout = $('[data-checkout]', sheet);
      if (!body) return;

      if (!cart.items.length) {
        body.innerHTML =
          `<div class="empty"><p class="t-body">Nothing here yet.</p>
           <p class="t-small" style="margin-top:8px">Everything you add shows up here, and stays for next time.</p></div>`;
      } else {
        body.innerHTML = cart.items.map((item) => {
          const p = findProduct(item.id);
          return `<div class="line" data-line="${p.id}">
            <div class="line__art">${artFor(p)}</div>
            <div class="line__main">
              <p class="line__name">${p.name}</p>
              <p class="line__meta">${money(p.price)} each</p>
              <div class="qty">
                <button type="button" data-dec aria-label="One fewer ${p.name}">−</button>
                <output aria-live="polite">${item.qty}</output>
                <button type="button" data-inc aria-label="One more ${p.name}">+</button>
              </div>
            </div>
            <div class="line__price">${money(p.price * item.qty)}</div>
          </div>`;
        }).join('');
      }
      if (total) total.textContent = money(cart.subtotal);
      if (checkout) checkout.disabled = cart.items.length === 0;
    }

    $('.sheet__body', sheet)?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row) return;
      const id = row.dataset.line;
      const line = cart.items.find((i) => i.id === id);
      if (!line) return;
      if (e.target.closest('[data-inc]')) cart.setQty(id, line.qty + 1);
      if (e.target.closest('[data-dec]')) cart.setQty(id, line.qty - 1);
    });

    $('[data-checkout]', sheet)?.addEventListener('click', () => {
      toast('Checkout is a demo — no payment is taken.');
    });
  }

  function trapFocus(e, root) {
    const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* Cart badge stays in sync everywhere. */
  function mountBadge() {
    const paint = () => $$('.nav__count').forEach((el) => {
      el.textContent = String(cart.count);
      el.dataset.empty = String(cart.count === 0);
    });
    paint();
    document.addEventListener('cart:change', paint);
  }

  /* ---------------------------------------------------------------------
     Toast
     --------------------------------------------------------------------- */
  let toastTimer = 0;
  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /* ---------------------------------------------------------------------
     Add-to-cart, from anywhere on any page.
     --------------------------------------------------------------------- */
  function mountAddButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      e.preventDefault();
      const p = findProduct(btn.dataset.add);
      if (!p) return;
      cart.add(p.id, Number(btn.dataset.qty || 1));
      if (btn.hasAttribute('data-open-after')) document.dispatchEvent(new Event('cart:added'));
      else toast(`${p.name} added.`);
    });
  }

  /* ---------------------------------------------------------------------
     Reveal on scroll — opacity and transform only, both compositor-safe.
     --------------------------------------------------------------------- */
  function mountReveal() {
    const els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduced.matches) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('is-in'), delay);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------------
     Draggable rail. Direct manipulation, momentum projection to the
     nearest card, and rubber-banding at both ends.
     --------------------------------------------------------------------- */
  function mountRails() {
    $$('.rail').forEach((rail) => {
      const track = $('.rail__track', rail);
      if (!track) return;
      const prev = $('[data-rail-prev]', rail.parentElement) || null;
      const next = $('[data-rail-next]', rail.parentElement) || null;

      const maxScroll = () => Math.max(0, track.scrollWidth - rail.clientWidth);
      const stepSize = () => {
        const item = $('.rail__item', track);
        if (!item) return 300;
        const gap = parseFloat(getComputedStyle(track).columnGap || '20') || 20;
        return item.getBoundingClientRect().width + gap;
      };

      const spring = new Spring(0, (v) => {
        track.style.transform = `translate3d(${-v}px,0,0)`;
        syncButtons(v);
      }, { response: 0.4, damping: 1.0 });

      function syncButtons(v) {
        const max = maxScroll();
        if (prev) prev.disabled = v <= 1;
        if (next) next.disabled = v >= max - 1;
      }
      const clamp = (v) => Math.max(0, Math.min(v, maxScroll()));

      prev?.addEventListener('click', () =>
        spring.to(clamp(spring.value - stepSize()), { response: 0.42, damping: 1.0 }));
      next?.addEventListener('click', () =>
        spring.to(clamp(spring.value + stepSize()), { response: 0.42, damping: 1.0 }));

      const tracker = new VelocityTracker();
      let dragging = false, decided = false, startX = 0, startY = 0, startValue = 0;

      rail.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || maxScroll() <= 0) return;
        dragging = true; decided = false;
        startX = e.clientX; startY = e.clientY;
        startValue = spring.value;      // start from the live value, mid-flight or not
        spring.stop();
        tracker.reset();
        tracker.add(e.clientX);
      });

      rail.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!decided) {
          // Both directions stay plausible until one clearly wins.
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }  // it was a scroll
          decided = true;
          rail.classList.add('is-dragging');
          rail.setPointerCapture(e.pointerId);
        }
        tracker.add(e.clientX);
        let v = startValue - dx;
        const max = maxScroll();
        if (v < 0) v = -rubberband(-v, rail.clientWidth);
        else if (v > max) v = max + rubberband(v - max, rail.clientWidth);
        spring.set(v);
      });

      const end = (e) => {
        if (!dragging) return;
        const wasDrag = decided;
        dragging = false; decided = false;
        rail.classList.remove('is-dragging');
        rail.releasePointerCapture?.(e.pointerId);
        if (!wasDrag) return;
        const velocity = -tracker.get();                 // px/s in track space
        const projected = spring.value + project(velocity);
        const step = stepSize();
        const snapped = clamp(Math.round(clamp(projected) / step) * step);
        // Momentum carried a flick: a touch of overshoot is honest here.
        const bouncy = Math.abs(velocity) > 400;
        spring.to(snapped, {
          velocity,
          response: 0.4,
          damping: bouncy ? 0.8 : 1.0,
        });
      };
      rail.addEventListener('pointerup', end);
      rail.addEventListener('pointercancel', end);
      rail.addEventListener('click', (e) => {
        // Swallow the click that ends a real drag.
        if (Math.abs(tracker.get()) > 60) e.preventDefault();
      }, true);

      rail.addEventListener('dragstart', (e) => e.preventDefault());
      window.addEventListener('resize', () => spring.to(clamp(spring.value)));
      syncButtons(0);
    });
  }

  /* ---------------------------------------------------------------------
     Accordion — height animated from the live value, so a mid-flight
     toggle reverses from where it is.
     --------------------------------------------------------------------- */
  function mountFaq() {
    $$('.faq__q').forEach((q) => {
      const panel = q.nextElementSibling;
      if (!panel) return;
      const spring = new Spring(0, (v) => {
        panel.style.height = `${Math.max(0, v)}px`;
      }, { response: 0.36, damping: 1.0 });

      q.addEventListener('click', () => {
        const open = q.getAttribute('aria-expanded') === 'true';
        q.setAttribute('aria-expanded', String(!open));
        panel.hidden = false;
        const full = panel.scrollHeight;
        spring.to(open ? 0 : full, {
          onRest: () => {
            if (q.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
          },
        });
      });
    });
  }


  /* ---------------------------------------------------------------------
     3D tilt. The card follows the pointer 1:1 while it is over the card,
     and springs back when it leaves — from wherever it currently is, so a
     fast re-entry never snaps.
     --------------------------------------------------------------------- */
  function mountTilt() {
    if (reduced.matches || !matchMedia('(hover: hover)').matches) return;
    const MAX = 7;   // degrees; past this it stops reading as a surface

    $$('.tilt').forEach((el) => {
      let rx = 0, ry = 0;
      const sx = new Spring(0, (v) => { ry = v; apply(); }, { response: 0.36, damping: 1.0 });
      const sy = new Spring(0, (v) => { rx = v; apply(); }, { response: 0.36, damping: 1.0 });
      const apply = () => {
        el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      };

      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
        sx.set((px - 0.5) * 2 * MAX);
        sy.set((0.5 - py) * 2 * MAX);
      });

      el.addEventListener('pointerleave', () => {
        sx.to(0, { response: 0.5, damping: 1.0 });
        sy.to(0, { response: 0.5, damping: 1.0 });
      });
    });
  }

  /* Scroll progress, read straight from the scroll position. */
  function mountProgress() {
    const bar = $('.progress');
    if (!bar) return;
    const paint = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    };
    paint();
    addEventListener('scroll', paint, { passive: true });
    addEventListener('resize', paint, { passive: true });
  }

  /* ---------------------------------------------------------------------
     Page rendering
     --------------------------------------------------------------------- */
  function cardHTML(p) {
    const cat = CATEGORIES.find((c) => c.id === p.category)?.label || '';
    return `<a class="card reveal" href="product.html?id=${p.id}">
      ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
      <div class="card__art">${artFor(p)}</div>
      <span class="card__cat">${cat}</span>
      <h3 class="card__name">${p.name}</h3>
      <p class="card__desc">${p.tagline}</p>
      <div class="card__foot">
        <span class="card__price">${money(p.price)}</span>
        <span class="link-arrow">Details</span>
      </div>
    </a>`;
  }

  function mountFeatured() {
    const host = $('[data-featured]');
    if (!host) return;
    const ids = (host.dataset.featured || '').split(',').map((s) => s.trim()).filter(Boolean);
    const list = ids.length ? ids.map(findProduct).filter(Boolean) : CATALOG.slice(0, 4);
    host.innerHTML = list
      .map((p) => `<div class="rail__item">${cardHTML(p)}</div>`)
      .join('');
  }

  function mountShop() {
    const grid = $('[data-shop-grid]');
    const filters = $('[data-filters]');
    if (!grid) return;

    if (filters) {
      filters.innerHTML = CATEGORIES.map(
        (c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="false">${c.label}</button>`
      ).join('');
    }

    const params = new URLSearchParams(location.search);
    let active = params.get('c') && CATEGORIES.some((c) => c.id === params.get('c'))
      ? params.get('c') : 'all';

    function paint() {
      const list = active === 'all' ? CATALOG : CATALOG.filter((p) => p.category === active);
      grid.innerHTML = list.map(cardHTML).join('');
      $$('.chip', filters).forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.cat === active)));
      const count = $('[data-shop-count]');
      if (count) count.textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}`;
      mountReveal();
    }

    filters?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      active = chip.dataset.cat;
      const url = new URL(location.href);
      if (active === 'all') url.searchParams.delete('c');
      else url.searchParams.set('c', active);
      history.replaceState(null, '', url);
      paint();
    });

    paint();
  }

  function mountProduct() {
    const host = $('[data-product]');
    if (!host) return;
    const id = new URLSearchParams(location.search).get('id');
    const p = findProduct(id) || CATALOG[0];
    const cat = CATEGORIES.find((c) => c.id === p.category);
    document.title = `${p.name} — BallBetter`;

    $('[data-pdp-crumb]').textContent = p.name;
    $('[data-pdp-stage]').innerHTML = artFor(p);
    $('[data-pdp-eyebrow]').textContent = cat ? cat.label : 'BallBetter';
    $('[data-pdp-name]').textContent = p.name;
    $('[data-pdp-tagline]').textContent = p.tagline;
    $('[data-pdp-summary]').textContent = p.summary;
    $('[data-pdp-price]').textContent = money(p.price);
    $('[data-pdp-add]').dataset.add = p.id;
    $('[data-pdp-specs]').innerHTML = p.highlights.map(
      ([k, v]) => `<div class="spec__cell"><p class="spec__k">${k}</p><p class="spec__v">${v}</p></div>`
    ).join('');
    $('[data-pdp-story]').innerHTML = p.story.map((s, i) => `
      <div class="split reveal" data-delay="${i * 60}">
        <div class="split__copy" ${i % 2 ? 'style="order:2"' : ''}>
          <h2 class="t-heading">${s.title}</h2>
          <p class="t-body">${s.body}</p>
        </div>
        <div class="split__art">${artFor(p)}</div>
      </div>`).join('');

    const others = CATALOG.filter((x) => x.id !== p.id).slice(0, 4);
    const rel = $('[data-pdp-related]');
    if (rel) rel.innerHTML = others.map((x) => `<div class="rail__item">${cardHTML(x)}</div>`).join('');
  }

  function mountContactForm() {
    const form = $('[data-contact]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      toast('Thanks — this demo form does not send anything.');
      form.reset();
    });
  }

  function mountYear() {
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* --------------------------------------------------------------------- */
  function init() {
    mountNav();
    mountBadge();
    mountFeatured();
    mountShop();
    mountProduct();
    mountSheet();
    mountAddButtons();
    mountRails();
    mountFaq();
    mountTilt();
    mountProgress();
    mountContactForm();
    mountYear();
    mountReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

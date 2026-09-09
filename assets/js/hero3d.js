/* ==========================================================================
   BallBetter — hero
   A basketball rendered in WebGL, with no library behind it. Geometry is
   generated at runtime; the pebble grain is procedural in the shader.

   The ball is grabbable. Dragging tracks the pointer 1:1, releasing hands the
   spring the pointer's real angular velocity, and a grab mid-spin takes over
   from wherever it currently is — never from a target it was heading toward.
   ========================================================================== */
(() => {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    antialias: true, alpha: true, premultipliedAlpha: false, depth: true,
  }) || canvas.getContext('experimental-webgl');

  if (!gl) { document.documentElement.classList.add('no-webgl'); return; }
  document.documentElement.classList.add('has-webgl');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Matrices ---------------------------------------------------------- */
  const M4 = {
    perspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
      ]);
    },
    translation(x, y, z) {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    },
    multiply(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          o[c * 4 + r] =
            a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
            a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
      }
      return o;
    },
    /* Model matrix is rotation only, so it doubles as the normal matrix. */
    rotationYXZ(yaw, pitch, roll) {
      const cy = Math.cos(yaw),   sy = Math.sin(yaw);
      const cx = Math.cos(pitch), sx = Math.sin(pitch);
      const cz = Math.cos(roll),  sz = Math.sin(roll);
      // R = Ry * Rx * Rz
      const m = [
        cy * cz + sy * sx * sz,  cx * sz,  -sy * cz + cy * sx * sz,
        -cy * sz + sy * sx * cz, cx * cz,  sy * sz + cy * sx * cz,
        sy * cx,                 -sx,      cy * cx,
      ];
      return new Float32Array([
        m[0], m[1], m[2], 0,
        m[3], m[4], m[5], 0,
        m[6], m[7], m[8], 0,
        0, 0, 0, 1,
      ]);
    },
    mat3(m4) {
      return new Float32Array([m4[0], m4[1], m4[2], m4[4], m4[5], m4[6], m4[8], m4[9], m4[10]]);
    },
  };

  /* --- Geometry ---------------------------------------------------------- */
  function sphere(segments, rings) {
    const pos = [], idx = [];
    for (let y = 0; y <= rings; y++) {
      const v = y / rings, theta = v * Math.PI;
      const st = Math.sin(theta), ct = Math.cos(theta);
      for (let x = 0; x <= segments; x++) {
        const u = x / segments, phi = u * Math.PI * 2;
        pos.push(st * Math.cos(phi), ct, st * Math.sin(phi));
      }
    }
    for (let y = 0; y < rings; y++) {
      for (let x = 0; x < segments; x++) {
        const a = y * (segments + 1) + x, b = a + segments + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }

  /* A tube swept along a closed curve that lies on the sphere. The radial
     direction is used as one frame axis, so the tube hugs the surface and
     never twists. */
  function tube(points, radius, sides, lift) {
    const pos = [], nrm = [], idx = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const next = points[(i + 1) % n];
      const prev = points[(i - 1 + n) % n];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      const rl = Math.hypot(p[0], p[1], p[2]) || 1;
      const rx = p[0] / rl, ry = p[1] / rl, rz = p[2] / rl;   // radial (outward)
      // binormal = tangent × radial
      let bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl; by /= bl; bz /= bl;
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const ox = rx * ca + bx * sa, oy = ry * ca + by * sa, oz = rz * ca + bz * sa;
        pos.push(
          p[0] * lift + ox * radius,
          p[1] * lift + oy * radius,
          p[2] * lift + oz * radius,
        );
        nrm.push(ox, oy, oz);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = i * (sides + 1), b = ((i + 1) % n) * (sides + 1);
      for (let s = 0; s < sides; s++) {
        idx.push(a + s, a + s + 1, b + s, b + s, a + s + 1, b + s + 1);
      }
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  const sph = (theta, phi) =>
    [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];

  /* The two great circles: one around the equator, one through the poles. */
  function equator(steps) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([Math.cos(t), 0, Math.sin(t)]);
    }
    return pts;
  }
  function meridian(phi0, steps) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([Math.sin(t) * Math.cos(phi0), Math.cos(t), Math.sin(t) * Math.sin(phi0)]);
    }
    return pts;
  }

  /* The curved seam: a meridian bent one way going down the front and the
     other way coming back up, which is the shape that reads as a basketball. */
  function curvedSeam(phi0, bulge, steps) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const down = t <= Math.PI;
      const theta = down ? t : 2 * Math.PI - t;
      const phi = phi0 + (down ? 1 : -1) * bulge * Math.sin(theta);
      pts.push(sph(theta, phi));
    }
    return pts;
  }

  /* --- Shaders ----------------------------------------------------------- */
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNrm;
    uniform mat4 uProj, uView, uModel;
    uniform mat3 uNrmMat;
    varying vec3 vObj, vNrm, vWorld;
    void main() {
      vObj = aPos;
      vNrm = uNrmMat * aNrm;
      vec4 world = uModel * vec4(aPos, 1.0);
      vWorld = world.xyz;
      gl_Position = uProj * uView * world;
    }`;

  const FS = `
    precision highp float;
    varying vec3 vObj, vNrm, vWorld;
    uniform mat3 uNrmMat;
    uniform vec3 uColorA, uColorB, uSpec;
    uniform float uMode;      // 0 = ball, 1 = seam
    uniform float uRough;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    // Pebble grain: two octaves, the fine one carrying most of the bump.
    float pebble(vec3 p) {
      return noise(p * 64.0) * 0.55 + noise(p * 155.0) * 0.45;
    }

    void main() {
      vec3 N = normalize(vNrm);

      if (uMode < 0.5) {
        // Perturb the object-space normal by the gradient of the grain, then
        // carry it into world space with the same matrix the mesh used.
        float e = 0.0016;
        vec3 p = normalize(vObj);
        float c  = pebble(p);
        vec3 grad = vec3(
          pebble(p + vec3(e, 0.0, 0.0)) - c,
          pebble(p + vec3(0.0, e, 0.0)) - c,
          pebble(p + vec3(0.0, 0.0, e)) - c) / e;
        vec3 objN = normalize(p - grad * 0.00042);
        N = normalize(uNrmMat * objN);
      }

      vec3 V = normalize(-vWorld + vec3(0.0, 0.0, 4.6));
      vec3 L1 = normalize(vec3(-0.45, 0.78, 0.62));   // key, upper left
      vec3 L2 = normalize(vec3(0.85, -0.15, 0.35));   // warm bounce, lower right
      vec3 L3 = normalize(vec3(0.1, 0.25, -1.0));     // rim, behind

      float d1 = max(dot(N, L1), 0.0);
      float d2 = max(dot(N, L2), 0.0);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);

      // A little grain in the albedo as well as the normal. Base colours are
      // authored in sRGB, so square them into linear before any light lands.
      float tone = uMode < 0.5 ? pebble(normalize(vObj)) : 0.5;
      vec3 base = mix(uColorA, uColorB, clamp(tone * 0.6 + 0.24, 0.0, 1.0));
      base *= base;

      vec3 H = normalize(L1 + V);
      float spec = pow(max(dot(N, H), 0.0), uRough) * (uMode < 0.5 ? 0.20 : 0.05);

      vec3 col = base * (0.035 + d1 * 1.30)
               + base * d2 * 0.15
               + uSpec * spec
               + vec3(1.0, 0.46, 0.16) * rim * (uMode < 0.5 ? 0.28 : 0.04);

      col = col / (col + vec3(0.92));            // roll off the highlights
      col = pow(col, vec3(0.4545));              // to sRGB
      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { document.documentElement.classList.add('no-webgl'); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    document.documentElement.classList.add('no-webgl');
    return;
  }
  gl.useProgram(prog);

  const A = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    nrm: gl.getAttribLocation(prog, 'aNrm'),
  };
  const U = {};
  ['uProj','uView','uModel','uNrmMat','uColorA','uColorB','uSpec','uMode','uRough']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  /* --- Upload ------------------------------------------------------------ */
  function mesh({ pos, nrm, idx }) {
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    const nb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.bufferData(gl.ARRAY_BUFFER, nrm || pos, gl.STATIC_DRAW);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vb, nb, ib, count: idx.length };
  }
  function draw(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.enableVertexAttribArray(A.pos);
    gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nb);
    gl.enableVertexAttribArray(A.nrm);
    gl.vertexAttribPointer(A.nrm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  const ballMesh = mesh(sphere(96, 64));

  // Two great circles, then two curved seams a quarter turn away from them.
  const SEAM_R = 0.016, SEAM_SIDES = 8, STEPS = 240, BULGE = 0.58;
  const seamMeshes = [
    tube(equator(STEPS), SEAM_R, SEAM_SIDES, 1.0),
    tube(meridian(Math.PI / 2, STEPS), SEAM_R, SEAM_SIDES, 1.0),
    tube(curvedSeam(0, BULGE, STEPS), SEAM_R, SEAM_SIDES, 1.0),
    tube(curvedSeam(Math.PI, BULGE, STEPS), SEAM_R, SEAM_SIDES, 1.0),
  ].map(mesh);

  /* --- Rotation state ---------------------------------------------------- */
  const state = {
    yaw: -0.55, pitch: 0.32, roll: 0,
    vYaw: 0, vPitch: 0,
    idle: 0.16,          // rad/s the ball drifts at when nobody is touching it
    scroll: 0,
  };

  /* Velocity from a short history, so a flick reads its real speed rather
     than the last frame's jitter. */
  class Tracker {
    constructor() { this.s = []; }
    add(x, y) {
      const t = performance.now();
      this.s.push({ x, y, t });
      while (this.s.length > 2 && t - this.s[0].t > 90) this.s.shift();
    }
    velocity() {
      if (this.s.length < 2) return [0, 0];
      const a = this.s[0], b = this.s[this.s.length - 1];
      const dt = (b.t - a.t) / 1000;
      return dt > 0 ? [(b.x - a.x) / dt, (b.y - a.y) / dt] : [0, 0];
    }
    reset() { this.s.length = 0; }
  }

  const tracker = new Tracker();
  let dragging = false, lastX = 0, lastY = 0, pointerId = null;
  /* Defined below, once the loop exists; interaction calls it to wake a loop
     that has stopped because nothing was moving. */
  let kick = () => {};
  const stage = canvas.parentElement;

  const RAD_PER_PX = 0.0062;

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    pointerId = e.pointerId;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-grabbing');
    lastX = e.clientX; lastY = e.clientY;
    // Take over from the live spin: kill momentum, keep the current angle.
    state.vYaw = 0; state.vPitch = 0;
    tracker.reset();
    tracker.add(e.clientX, e.clientY);
    kick();
    e.preventDefault();
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    tracker.add(e.clientX, e.clientY);
    state.yaw += (e.clientX - lastX) * RAD_PER_PX;      // 1:1 with the pointer
    state.pitch += (e.clientY - lastY) * RAD_PER_PX;
    state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch));
    lastX = e.clientX; lastY = e.clientY;
    kick();
  });

  function release(e) {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;
    stage.classList.remove('is-grabbing');
    try { stage.releasePointerCapture(pointerId); } catch { /* already gone */ }
    // Hand the spin the pointer's actual velocity — no seam at the release.
    const [vx, vy] = tracker.velocity();
    state.vYaw = vx * RAD_PER_PX;
    state.vPitch = Math.max(-6, Math.min(6, vy * RAD_PER_PX));
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('lostpointercapture', release);

  /* Keyboard equivalent, so the ball is not mouse-only. */
  stage.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    state.vYaw += k[0] * 1.6;
    state.vPitch += k[1] * 0.9;
    kick();
  });

  /* --- Resize ------------------------------------------------------------ */
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  window.addEventListener('resize', resize, { passive: true });

  /* Scroll gives the ball a slow extra turn, so the page feels connected to
     it without the ball ever moving faster than the eye can follow. */
  window.addEventListener('scroll', () => {
    state.scroll = window.scrollY;
    kick();
  }, { passive: true });

  /* --- Frame ------------------------------------------------------------- */
  const view = M4.translation(0, 0, -4.6);
  let visible = true, raf = 0, last = performance.now();

  kick = () => {
    if (raf || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    }, { threshold: 0.01 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', kick, { passive: true });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    resize();

    if (!dragging) {
      // Momentum decays toward the idle drift rather than to a dead stop.
      const decay = Math.pow(0.0015, dt);         // ≈ 0.9985 per 60fps frame
      state.vYaw = (state.vYaw - state.idle) * decay + state.idle;
      state.vPitch *= decay;
      state.pitch += state.vPitch * dt;
      state.pitch += (0.18 - state.pitch) * Math.min(1, dt * 1.1) * 0.35;  // settle upright
      state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch));
      state.yaw += state.vYaw * dt;
    }

    const tilt = Math.min(state.scroll / 900, 1);
    const model = M4.rotationYXZ(
      state.yaw + tilt * 0.5,
      state.pitch,
      -0.14 + tilt * 0.1,
    );
    const proj = M4.perspective(0.55, W / H || 1, 0.1, 50);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniformMatrix4fv(U.uModel, false, model);
    gl.uniformMatrix3fv(U.uNrmMat, false, M4.mat3(model));

    gl.uniform1f(U.uMode, 0);
    gl.uniform1f(U.uRough, 42.0);
    gl.uniform3f(U.uColorA, 0.52, 0.135, 0.022);
    gl.uniform3f(U.uColorB, 1.0, 0.375, 0.062);
    gl.uniform3f(U.uSpec, 1.0, 0.80, 0.62);
    draw(ballMesh);

    gl.uniform1f(U.uMode, 1);
    gl.uniform1f(U.uRough, 26.0);
    gl.uniform3f(U.uColorA, 0.075, 0.045, 0.030);
    gl.uniform3f(U.uColorB, 0.115, 0.070, 0.048);
    gl.uniform3f(U.uSpec, 0.30, 0.26, 0.22);
    seamMeshes.forEach(draw);

    const moving = dragging || Math.abs(state.vYaw) > 0.001 || Math.abs(state.vPitch) > 0.001;
    if (visible && !document.hidden && (moving || !reduced.matches)) {
      raf = requestAnimationFrame(frame);
    }
  }

  if (reduced.matches) { state.idle = 0; state.pitch = 0.18; }
  resize();
  raf = requestAnimationFrame(frame);
})();

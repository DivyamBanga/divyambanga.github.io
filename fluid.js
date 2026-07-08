/* Fluid ink trail.
   A small GPU fluid simulation (stable fluids with vorticity
   confinement). Moving the cursor injects dye and velocity, so
   color pours out of the pointer, swirls with your motion,
   spreads and slowly dissolves. Runs on a pointer-transparent
   canvas above the page at low alpha.

   Two temperaments: fine pointers get the rainbow trail that
   follows the cursor; touch screens get deliberate monochrome
   ink — a tap drops a blot, a drag paints while the finger is
   down — at lower resolution. The loop sleeps whenever the ink
   has fully dissolved or the tab is hidden, and wakes on the
   next movement. Skipped without WebGL and under reduced motion. */
(function () {
  'use strict';

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var touchMode = !fine;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('paint');
  if (!canvas || reduced) return;

  var attrs = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: false };
  var gl = canvas.getContext('webgl2', attrs);
  var isWebGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  if (!gl) return;

  var halfFloatExt = null;
  var supportLinearFiltering;
  if (isWebGL2) {
    if (!gl.getExtension('EXT_color_buffer_float')) return;
    supportLinearFiltering = true; // 16F textures are filterable in WebGL2
  } else {
    halfFloatExt = gl.getExtension('OES_texture_half_float');
    supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
    if (!halfFloatExt) return;
  }
  var texType = isWebGL2 ? gl.HALF_FLOAT : halfFloatExt.HALF_FLOAT_OES;

  function supportsFormat(internalFormat, format) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, texType, null);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(t);
    return ok;
  }

  var formatRGBA, formatRG, formatR;
  if (isWebGL2) {
    formatRGBA = supportsFormat(gl.RGBA16F, gl.RGBA) ? { i: gl.RGBA16F, f: gl.RGBA } : null;
    formatRG = supportsFormat(gl.RG16F, gl.RG) ? { i: gl.RG16F, f: gl.RG } : formatRGBA;
    formatR = supportsFormat(gl.R16F, gl.RED) ? { i: gl.R16F, f: gl.RED } : formatRG;
  } else {
    formatRGBA = supportsFormat(gl.RGBA, gl.RGBA) ? { i: gl.RGBA, f: gl.RGBA } : null;
    formatRG = formatRGBA;
    formatR = formatRGBA;
  }
  if (!formatRGBA) return;

  /* ---------- Config ---------- */
  var SIM_RESOLUTION = touchMode ? 64 : 96;
  var DYE_RESOLUTION = touchMode ? 384 : 512;
  var DENSITY_DISSIPATION = 2.4;   // how fast ink fades
  var VELOCITY_DISSIPATION = 0.9;  // how fast motion calms down
  var PRESSURE = 0.8;
  var PRESSURE_ITERATIONS = touchMode ? 12 : 18;
  var CURL = 10;                   // swirl strength
  var SPLAT_RADIUS = 0.0007;       // ink pour width
  var SPLAT_FORCE = 2200;
  var INK_AMOUNT = 0.085;          // quiet: the ink accents, never competes
  var IDLE_MS = 6000;              // sleep this long after the last splat

  /* ---------- Shaders ---------- */
  function compile(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  }
  function program(vs, fsSource) {
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    var uniforms = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name;
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, u: uniforms, bind: function () { gl.useProgram(p); } };
  }

  var baseVertex = compile(gl.VERTEX_SHADER, [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0);',
    '  vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y);',
    '  vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var splatProgram = program(baseVertex, [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTarget;',
    'uniform float aspectRatio;',
    'uniform vec3 color;',
    'uniform vec2 point;',
    'uniform float radius;',
    'void main () {',
    '  vec2 p = vUv - point.xy;',
    '  p.x *= aspectRatio;',
    '  vec3 splat = exp(-dot(p, p) / radius) * color;',
    '  vec3 base = texture2D(uTarget, vUv).xyz;',
    '  gl_FragColor = vec4(base + splat, 1.0);',
    '}'
  ].join('\n'));

  var advectionSource = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity;',
    'uniform sampler2D uSource;',
    'uniform vec2 texelSize;',
    'uniform vec2 dyeTexelSize;',
    'uniform float dt;',
    'uniform float dissipation;',
    '#ifdef MANUAL_FILTERING',
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
    '  vec2 st = uv / tsize - 0.5;',
    '  vec2 iuv = floor(st);',
    '  vec2 fuv = fract(st);',
    '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
    '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
    '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
    '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
    '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
    '}',
    '#endif',
    'void main () {',
    '#ifdef MANUAL_FILTERING',
    '  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
    '  vec4 result = bilerp(uSource, coord, dyeTexelSize);',
    '#else',
    '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
    '  vec4 result = texture2D(uSource, coord);',
    '#endif',
    '  float decay = 1.0 + dissipation * dt;',
    '  gl_FragColor = result / decay;',
    '}'
  ].join('\n');
  var advectionProgram = program(baseVertex,
    (supportLinearFiltering ? '' : '#define MANUAL_FILTERING\n') + advectionSource);

  var divergenceProgram = program(baseVertex, [
    'precision mediump float;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).x;',
    '  float R = texture2D(uVelocity, vR).x;',
    '  float T = texture2D(uVelocity, vT).y;',
    '  float B = texture2D(uVelocity, vB).y;',
    '  vec2 C = texture2D(uVelocity, vUv).xy;',
    '  if (vL.x < 0.0) { L = -C.x; }',
    '  if (vR.x > 1.0) { R = -C.x; }',
    '  if (vT.y > 1.0) { T = -C.y; }',
    '  if (vB.y < 0.0) { B = -C.y; }',
    '  float div = 0.5 * (R - L + T - B);',
    '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var curlProgram = program(baseVertex, [
    'precision mediump float;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).y;',
    '  float R = texture2D(uVelocity, vR).y;',
    '  float T = texture2D(uVelocity, vT).x;',
    '  float B = texture2D(uVelocity, vB).x;',
    '  float vorticity = R - L - T + B;',
    '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var vorticityProgram = program(baseVertex, [
    'precision highp float;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uVelocity;',
    'uniform sampler2D uCurl;',
    'uniform float curl;',
    'uniform float dt;',
    'void main () {',
    '  float L = texture2D(uCurl, vL).x;',
    '  float R = texture2D(uCurl, vR).x;',
    '  float T = texture2D(uCurl, vT).x;',
    '  float B = texture2D(uCurl, vB).x;',
    '  float C = texture2D(uCurl, vUv).x;',
    '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
    '  force /= length(force) + 0.0001;',
    '  force *= curl * C;',
    '  force.y *= -1.0;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  velocity += force * dt;',
    '  velocity = min(max(velocity, -1000.0), 1000.0);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var pressureProgram = program(baseVertex, [
    'precision mediump float;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uPressure;',
    'uniform sampler2D uDivergence;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  float divergence = texture2D(uDivergence, vUv).x;',
    '  float pressure = (L + R + B + T - divergence) * 0.25;',
    '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var gradientSubtractProgram = program(baseVertex, [
    'precision mediump float;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform sampler2D uPressure;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  velocity.xy -= vec2(R - L, T - B);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n'));

  var clearProgram = program(baseVertex, [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform float value;',
    'void main () {',
    '  gl_FragColor = value * texture2D(uTexture, vUv);',
    '}'
  ].join('\n'));

  /* Touch mode renders the dye as a single ink: the field stores an
     amount, the theme's ink color is applied at display time, so the
     blots are off-white smoke on dark and near-black ink on light. */
  var displayProgram = program(baseVertex, touchMode ? [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec3 uInk;',
    'void main () {',
    '  float d = texture2D(uTexture, vUv).r;',
    '  float a = clamp(d * 1.6, 0.0, 0.4);',
    '  gl_FragColor = vec4(uInk, a);',
    '}'
  ].join('\n') : [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'void main () {',
    '  vec3 c = texture2D(uTexture, vUv).rgb;',
    '  float a = clamp(max(c.r, max(c.g, c.b)) * 1.25, 0.0, 0.21);',
    '  gl_FragColor = vec4(c * 1.05, a);',
    '}'
  ].join('\n'));

  /* The theme's ink color, kept current across theme switches. */
  var inkRGB = [0.92, 0.92, 0.91];
  function readInk() {
    var hex = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (m) {
      inkRGB = [
        parseInt(m[1].slice(0, 2), 16) / 255,
        parseInt(m[1].slice(2, 4), 16) / 255,
        parseInt(m[1].slice(4, 6), 16) / 255
      ];
    }
  }
  if (touchMode) {
    readInk();
    new MutationObserver(readInk).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  /* ---------- Fullscreen quad ---------- */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /* ---------- Framebuffers ---------- */
  function createFBO(w, h, fmt, filter) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.i, w, h, 0, fmt.f, texType, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }
  function createDoubleFBO(w, h, fmt, filter) {
    return {
      width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      read: createFBO(w, h, fmt, filter),
      write: createFBO(w, h, fmt, filter),
      swap: function () {
        var t = this.read;
        this.read = this.write;
        this.write = t;
      }
    };
  }

  function getResolution(resolution) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    var min = Math.round(resolution);
    var max = Math.round(resolution * aspect);
    if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
    return { width: min, height: max };
  }

  var dye, velocity, divergence, curl, pressure;
  function initFramebuffers() {
    var simRes = getResolution(SIM_RESOLUTION);
    var dyeRes = getResolution(DYE_RESOLUTION);
    var filter = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA, filter);
    velocity = createDoubleFBO(simRes.width, simRes.height, formatRG, filter);
    divergence = createFBO(simRes.width, simRes.height, formatR, gl.NEAREST);
    curl = createFBO(simRes.width, simRes.height, formatR, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, formatR, gl.NEAREST);
  }

  /* On phones the URL bar collapse jitters innerHeight on every
     scroll; resizing would wipe the ink each time. So touch sizes
     the canvas once to the tallest the viewport can get, and all
     pointer math uses the canvas's own CSS size. */
  var cssW = window.innerWidth;
  var cssH = window.innerHeight;
  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, touchMode ? 1.25 : 1.5);
    var targetCssH = touchMode
      ? Math.max(window.innerHeight, window.screen && window.screen.height || 0)
      : window.innerHeight;
    var w = Math.round(window.innerWidth * dpr);
    var h = Math.round(targetCssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      cssW = window.innerWidth;
      cssH = targetCssH;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      return true;
    }
    return false;
  }
  resizeCanvas();
  initFramebuffers();

  /* ---------- Pointer ---------- */
  var pointer = null;  // latest cursor position
  var prevPos = null;  // position already painted up to
  var hue = Math.random();

  function inkColor() {
    if (touchMode) {
      // Monochrome: the field stores an ink amount, not a color.
      var A = 0.13 + Math.random() * 0.05;
      return { r: A, g: A, b: A };
    }
    hue = (hue + 0.018) % 1;
    var h = hue * 6;
    var i = Math.floor(h);
    var f = h - i;
    var v = 1, s = 0.38;
    var p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return { r: rgb[0] * INK_AMOUNT, g: rgb[1] * INK_AMOUNT, b: rgb[2] * INK_AMOUNT };
  }

  function toUV(e) {
    return { x: e.clientX / cssW, y: 1 - e.clientY / cssH };
  }

  /* Ink stays out of the way of real interactions. */
  function overInteractive(e) {
    return !!(e.target && e.target.closest &&
      e.target.closest('a, button, input, textarea, select, dialog, .palette'));
  }

  /* A blot: a handful of splats bursting outward from one point.
     Fired on click (a small drop) and tap (a fuller bloom). */
  function blot(uv, strength) {
    for (var i = 0; i < 5; i++) {
      var a = Math.random() * Math.PI * 2;
      var k = 320 * strength * (0.4 + Math.random() * 0.6);
      var c = inkColor();
      splat({
        x: uv.x + (Math.random() - 0.5) * 0.012,
        y: uv.y + (Math.random() - 0.5) * 0.012,
        dx: Math.cos(a) * k,
        dy: Math.sin(a) * k,
        color: { r: c.r * 1.8, g: c.g * 1.8, b: c.b * 1.8 },
        radius: SPLAT_RADIUS * (touchMode ? 4 : 2.6)
      });
    }
  }

  if (touchMode) {
    // Paint only while a finger is down; taps drop a blot.
    window.addEventListener('pointerdown', function (e) {
      if (!e.isPrimary || overInteractive(e)) return;
      wake();
      pointer = prevPos = toUV(e);
      blot(pointer, 1);
    }, { passive: true });
    window.addEventListener('pointermove', function (e) {
      if (!e.isPrimary || !prevPos) return;
      pointer = toUV(e);
      wake();
    }, { passive: true });
    var lift = function () { pointer = null; prevPos = null; };
    window.addEventListener('pointerup', lift, { passive: true });
    window.addEventListener('pointercancel', lift, { passive: true });
  } else {
    window.addEventListener('pointermove', function (e) {
      pointer = toUV(e);
      if (!prevPos) prevPos = pointer;
      wake();
    }, { passive: true });
    // A click presses a small drop of ink out of the pen.
    window.addEventListener('pointerdown', function (e) {
      if (overInteractive(e)) return;
      wake();
      blot(toUV(e), 0.7);
    }, { passive: true });
  }

  /* Paint a continuous stroke from wherever we painted last, right up
     to the current cursor position, every frame. The stroke head is
     always exactly on the pointer. */
  var strokeDist = 0; // how much the visitor has painted on their own
  function paintToPointer() {
    if (!pointer || !prevPos) return;
    var dx = pointer.x - prevPos.x;
    var dy = pointer.y - prevPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) return;
    strokeDist += dist;
    var n = Math.min(8, Math.max(1, Math.ceil(dist / 0.006)));
    for (var i = 1; i <= n; i++) {
      splat({
        x: prevPos.x + (dx * i) / n,
        y: prevPos.y + (dy * i) / n,
        dx: (dx / n) * SPLAT_FORCE,
        dy: (dy / n) * SPLAT_FORCE,
        color: inkColor()
      });
    }
    prevPos = pointer;
  }

  function splat(s) {
    lastActivity = performance.now();
    splatProgram.bind();
    gl.uniform1i(splatProgram.u.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.u.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.u.point, s.x, s.y);
    gl.uniform3f(splatProgram.u.color, s.dx, s.dy, 0);
    gl.uniform1f(splatProgram.u.radius, s.radius || SPLAT_RADIUS);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(splatProgram.u.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.u.color, s.color.r, s.color.g, s.color.b);
    blit(dye.write);
    dye.swap();
  }

  /* ---------- Welcome wisp ----------
     When the page finishes drawing itself in (intro:done, announced
     by script.js), one soft ribbon of ink curls across on its own,
     so the trail introduces itself before the cursor ever moves.
     Skipped if the visitor has already painted. */
  window.addEventListener('intro:done', function () {
    if (strokeDist > 0.12) return;
    wake();
    var t0 = performance.now();
    var DUR = 1500;
    var prev = null;
    (function wisp() {
      var p = Math.min(1, (performance.now() - t0) / DUR);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var x = -0.06 + 0.74 * e;
      var y = 0.52 + 0.13 * Math.sin(e * Math.PI * 1.6);
      if (prev) {
        var dx = x - prev.x;
        var dy = y - prev.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var n = Math.min(8, Math.max(1, Math.ceil(dist / 0.006)));
        for (var i = 1; i <= n; i++) {
          splat({
            x: prev.x + (dx * i) / n,
            y: prev.y + (dy * i) / n,
            dx: (dx / n) * SPLAT_FORCE,
            dy: (dy / n) * SPLAT_FORCE,
            color: inkColor()
          });
        }
      }
      prev = { x: x, y: y };
      if (p < 1) requestAnimationFrame(wisp);
    })();
  }, { once: true });

  /* ---------- Simulation step ---------- */
  function step(dt) {
    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(curlProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.u.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.u.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.u.curl, CURL);
    gl.uniform1f(vorticityProgram.u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.u.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.u.value, PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.u.uDivergence, divergence.attach(0));
    for (var i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(pressureProgram.u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.u.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.u.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinearFiltering)
      gl.uniform2f(advectionProgram.u.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    var velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.u.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.u.uSource, velocityId);
    gl.uniform1f(advectionProgram.u.dt, dt);
    gl.uniform1f(advectionProgram.u.dissipation, VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinearFiltering)
      gl.uniform2f(advectionProgram.u.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.u.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.u.dissipation, DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.disable(gl.BLEND);
    displayProgram.bind();
    gl.uniform2f(displayProgram.u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    if (touchMode) gl.uniform3f(displayProgram.u.uInk, inkRGB[0], inkRGB[1], inkRGB[2]);
    gl.uniform1i(displayProgram.u.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* ---------- Loop, with a conscience ----------
     Runs only while there is ink to move: IDLE_MS after the last
     splat everything has dissolved below visibility, so the loop
     stops scheduling itself. Movement, taps, the wisp or the ink
     API wake it back up. Hidden tabs stop immediately. */
  var lastTime = performance.now();
  var lastActivity = performance.now();
  var running = false;

  function frame() {
    var now = performance.now();
    if (document.hidden || now - lastActivity > IDLE_MS) { running = false; return; }
    var dt = Math.min((now - lastTime) / 1000, 0.0333);
    lastTime = now;
    if (resizeCanvas()) initFramebuffers();
    paintToPointer();
    step(dt);
    render();
    requestAnimationFrame(frame);
  }

  function wake() {
    lastActivity = performance.now();
    if (running || document.hidden) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) wake();
  });
  window.addEventListener('resize', function () { wake(); }, { passive: true });

  /* Small hooks for the rest of the site (palette verbs, console). */
  window.__ink = {
    wake: wake,
    burst: function (clientX, clientY, strength) {
      wake();
      blot({ x: clientX / cssW, y: 1 - clientY / cssH }, strength || 1);
    },
    storm: function (n) {
      n = Math.min(n || 12, 40);
      var i = 0;
      (function next() {
        wake();
        blot({ x: 0.08 + Math.random() * 0.84, y: 0.12 + Math.random() * 0.76 }, 1.4);
        if (++i < n) setTimeout(next, 60 + Math.random() * 90);
      })();
    }
  };

  wake();
})();

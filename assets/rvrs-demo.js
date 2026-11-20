/* DJOW RVRS - browser demo.
   A JavaScript port of the plugin's RiserEngine (same reverb, filters and FX),
   so the riser you hear here is the riser the plugin renders. Preview only. */
(function () {
  var root = document.getElementById('rvrs-demo');
  if (!root) return;

  var PI = Math.PI, SR = 48000;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- Biquad ----------
  function Biquad() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  Biquad.prototype.set = function (sr, fc, q, hp) {
    fc = clamp(fc, 10, sr * 0.45);
    var w = 2 * PI * fc / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (hp) { this.b0 = (1 + c) * 0.5 / a0; this.b1 = -(1 + c) / a0; this.b2 = this.b0; }
    else { this.b0 = (1 - c) * 0.5 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; }
    this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
    return this;
  };
  Biquad.prototype.lp = function (sr, fc) { return this.set(sr, fc, 0.7071, false); };
  Biquad.prototype.hp = function (sr, fc) { return this.set(sr, fc, 0.7071, true); };
  Biquad.prototype.p = function (x) {
    var y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  };

  // ---------- All-pass ----------
  function AllPass(n) { this.buf = new Float32Array(Math.max(1, n)); this.i = 0; this.g = 0.62; }
  AllPass.prototype.p = function (x) {
    var d = this.buf[this.i], y = d - this.g * x;
    this.buf[this.i] = x + this.g * y;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  };

  // ---------- 8-line FDN reverb ----------
  function Fdn(sr, size, rt60, dampHz) {
    var base = [31.7, 37.9, 43.3, 49.1, 56.3, 61.7, 68.9, 76.1], ap = [4.7, 7.9, 12.1, 17.3],
        lfo = [0.31, 0.43, 0.53, 0.67, 0.79, 0.97, 1.13, 1.31];
    var scale = 0.55 + 1.35 * clamp(size, 0, 1);
    rt60 = Math.max(0.1, rt60);
    this.mod = 0.0006 * sr;
    this.len = []; this.lines = []; this.wp = []; this.lpv = []; this.fb = []; this.ph = []; this.pinc = [];
    for (var i = 0; i < 8; i++) {
      var L = Math.max(8, Math.round(base[i] * scale * 0.001 * sr));
      this.len.push(L);
      this.lines.push(new Float32Array(L + Math.floor(this.mod) + 8));
      this.wp.push(0); this.lpv.push(0);
      this.fb.push(Math.pow(10, -3 * (L / sr) / rt60));
      this.ph.push(i * 0.7); this.pinc.push(2 * PI * lfo[i] / sr);
    }
    this.apL = []; this.apR = [];
    for (var j = 0; j < 4; j++) {
      this.apL.push(new AllPass(Math.round(ap[j] * 0.001 * sr)));
      this.apR.push(new AllPass(Math.round(ap[j] * 1.13 * 0.001 * sr)));
    }
    this.damp = 1 - Math.exp(-2 * PI * clamp(dampHz, 500, sr * 0.45) / sr);
    this.d = new Float64Array(8); this.oL = 0; this.oR = 0;
  }
  Fdn.prototype.p = function (inL, inR) {
    var k, i;
    for (k = 0; k < 4; k++) inL = this.apL[k].p(inL);
    for (k = 0; k < 4; k++) inR = this.apR[k].p(inR);
    var d = this.d, sum = 0;
    for (i = 0; i < 8; i++) {
      this.ph[i] += this.pinc[i];
      if (this.ph[i] > 2 * PI) this.ph[i] -= 2 * PI;
      var mod = this.mod * 0.5 * (1 + Math.sin(this.ph[i]));
      var line = this.lines[i], n = line.length;
      var rp = this.wp[i] - this.len[i] - mod;
      while (rp < 0) rp += n;
      var i0 = rp | 0, i1 = (i0 + 1) % n, fr = rp - i0;
      var raw = line[i0 % n] * (1 - fr) + line[i1] * fr;
      this.lpv[i] += this.damp * (raw - this.lpv[i]);
      d[i] = this.lpv[i];
      sum += d[i] * this.fb[i];
    }
    var house = sum * (2 / 8), oL = 0, oR = 0;
    for (i = 0; i < 8; i++) {
      var inp = (i % 2 === 0) ? inL : inR;
      this.lines[i][this.wp[i]] = inp + d[i] * this.fb[i] - house;
      if (++this.wp[i] >= this.lines[i].length) this.wp[i] = 0;
      var sign = ((i >> 1) % 2 === 0) ? 1 : -1;
      if (i % 2 === 0) oL += d[i] * sign; else oR += d[i] * sign;
    }
    this.oL = oL * 0.5; this.oR = oR * 0.5;
  };

  // ---------- helpers ----------
  function findOnset(l, r, sr) {
    var peak = 0, i;
    for (i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
    if (peak <= 1e-5) return 0;
    var th = Math.max(peak * 0.06, 0.002), pre = Math.floor(0.004 * sr);
    for (i = 0; i < l.length; i++) if (Math.max(Math.abs(l[i]), Math.abs(r[i])) > th) return i > pre ? i - pre : 0;
    return 0;
  }

  function reduceSibilance(l, r, sr, amount) {
    var det = new Biquad().hp(sr, 5500);
    var lo1L = new Biquad().lp(sr, 4000), lo2L = new Biquad().lp(sr, 4000), lo1R = new Biquad().lp(sr, 4000), lo2R = new Biquad().lp(sr, 4000);
    var hi1L = new Biquad().hp(sr, 4000), hi2L = new Biquad().hp(sr, 4000), hi1R = new Biquad().hp(sr, 4000), hi2R = new Biquad().hp(sr, 4000);
    var att = 1 - Math.exp(-1 / (0.001 * sr)), rel = 1 - Math.exp(-1 / (0.050 * sr)), sm = 1 - Math.exp(-1 / (0.002 * sr));
    var hfE = 0, fE = 0, g = 1;
    amount = clamp(amount, 0, 1);
    for (var i = 0; i < l.length; i++) {
      var mono = 0.5 * (l[i] + r[i]);
      var hf = Math.abs(det.p(mono)), full = Math.abs(mono);
      hfE += (hf > hfE ? att : rel) * (hf - hfE);
      fE += (full > fE ? att : rel) * (full - fE);
      var ratio = hfE / (fE + 1e-5);
      var dt = fE > 0.003 ? clamp((ratio - 0.32) / 0.30, 0, 1) : 0;
      g += sm * ((1 - amount * dt * 0.94) - g);
      var loL = lo2L.p(lo1L.p(l[i])), loR = lo2R.p(lo1R.p(r[i]));
      var hiL = hi2L.p(hi1L.p(l[i])), hiR = hi2R.p(hi1R.p(r[i]));
      l[i] = loL + hiL * g; r[i] = loR + hiR * g;
    }
  }

  // ---------- the riser ----------
  function renderRiser(inL, inR, p) {
    var sr = p.sampleRate, spb = 60 / clamp(p.bpm, 30, 300);
    var riserLen = Math.min(Math.floor(40 * sr), Math.round(p.lengthBeats * spb * sr));
    var srcLen = Math.min(inL.length, Math.round(p.sourceBeats * spb * sr));
    if (riserLen < 64 || srcLen < 64) return null;

    var sL = inL.slice(0, srcLen), sR = inR.slice(0, srcLen);
    reduceSibilance(sL, sR, sr, p.deEss);

    var rt60 = (riserLen / sr) * (0.8 + 3.2 * clamp(p.decay, 0, 1));
    var rv = new Fdn(sr, p.size, rt60, Math.min(p.highCut, 9000));
    var fade = Math.min(Math.floor(srcLen / 2), Math.floor(0.005 * sr)), i;
    for (i = 0; i < srcLen; i++) {
      var s = srcLen - 1 - i, e = 1;
      if (i < fade) e = i / fade; else if (i >= srcLen - fade) e = (srcLen - 1 - i) / fade;
      rv.p(sL[s] * e, sR[s] * e);
    }

    var L = new Float32Array(riserLen), R = new Float32Array(riserLen);
    for (i = 0; i < riserLen; i++) { rv.p(0, 0); L[riserLen - 1 - i] = rv.oL; R[riserLen - 1 - i] = rv.oR; }

    var hpL = new Biquad().hp(sr, p.lowCut), hpR = new Biquad().hp(sr, p.lowCut), lpL = new Biquad().lp(sr, p.highCut), lpR = new Biquad().lp(sr, p.highCut);
    for (i = 0; i < riserLen; i++) { L[i] = lpL.p(hpL.p(L[i])); R[i] = lpR.p(hpR.p(R[i])); }

    if (p.sweep) {
      var c1L = 0, c2L = 0, c1R = 0, c2R = 0, a1 = 0, a2 = 0, a3 = 0, k = 1 / 0.9, top = Math.min(18000, sr * 0.45);
      for (i = 0; i < riserLen; i++) {
        if ((i & 31) === 0) {
          var fc = 250 * Math.pow(top / 250, i / riserLen), g = Math.tan(PI * fc / sr);
          a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
        }
        var v3 = L[i] - c2L, v1 = a1 * c1L + a2 * v3, v2 = c2L + a2 * c1L + a3 * v3;
        c1L = 2 * v1 - c1L; c2L = 2 * v2 - c2L; L[i] = v2;
        v3 = R[i] - c2R; v1 = a1 * c1R + a2 * v3; v2 = c2R + a2 * c1R + a3 * v3;
        c1R = 2 * v1 - c1R; c2R = 2 * v2 - c2R; R[i] = v2;
      }
    }

    var pw = 0.1 + 1.5 * clamp(p.curve, 0, 1);
    for (i = 0; i < riserLen; i++) { var sg = Math.pow((i + 1) / riserLen, pw); L[i] *= sg; R[i] *= sg; }

    function normalise(t) {
      var pk = 0, j;
      for (j = 0; j < riserLen; j++) pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j]));
      if (pk > 1e-7) { var gg = t / pk; for (j = 0; j < riserLen; j++) { L[j] *= gg; R[j] *= gg; } }
    }
    normalise(1);

    if (p.drive) {
      var am = 2.8, nm = 1 / Math.tanh(am);
      for (i = 0; i < riserLen; i++) { L[i] = Math.tanh(L[i] * am) * nm; R[i] = Math.tanh(R[i] * am) * nm; }
    }
    if (p.wide) {
      for (i = 0; i < riserLen; i++) { var m = 0.5 * (L[i] + R[i]), sd = 0.5 * (L[i] - R[i]) * 1.8; L[i] = m + sd; R[i] = m - sd; }
    }
    if (p.chop) {
      var period = 0.25 * spb * sr, smc = 1 - Math.exp(-1 / (0.003 * sr)), cg = 0;
      for (i = 0; i < riserLen; i++) {
        var fromEnd = riserLen - i, ph = 1 - (fromEnd % period) / period;
        cg += smc * ((ph < 0.6 ? 1 : 0) - cg);
        L[i] *= cg; R[i] *= cg;
      }
    }
    normalise(0.708);
    var fin = Math.min(Math.floor(riserLen / 4), Math.floor(0.020 * sr)), fout = Math.min(Math.floor(riserLen / 4), Math.floor(0.004 * sr));
    for (i = 0; i < riserLen; i++) {
      var gn = 1;
      if (i < fin) gn *= i / fin;
      if (i >= riserLen - fout) gn *= (riserLen - 1 - i) / fout;
      L[i] = clamp(L[i] * gn, -1, 1); R[i] = clamp(R[i] * gn, -1, 1);
    }
    return { l: L, r: R };
  }

  // ---------- UI state ----------
  var LENGTHS = [{ b: 2, t: '1/2 BAR' }, { b: 4, t: '1 BAR' }, { b: 8, t: '2 BARS' }, { b: 16, t: '4 BARS' }];
  var st = { len: 1, bpm: 128, sweep: true, drive: false, wide: true, chop: false };
  var src = null;          // {l, r} trimmed to onset, at SR
  var out = null;          // {riserLen, l, r} riser + vocal joined
  var ctx = null, node = null, t0 = 0, playFrom = 0, playLen = 0, raf = 0, renderTimer = 0;

  var $ = function (s) { return root.querySelector(s); };
  var knobEl = $('.rv-knob'), lenOut = $('.rv-len'), statusEl = $('.rv-status'), canvas = $('canvas'),
      bpmIn = $('.rv-bpm'), fileIn = $('.rv-file'), srcName = $('.rv-src');

  function track(name) {
    try { if (window.fbq) fbq('trackCustom', name); } catch (e) {}
    try { if (window.gtag) gtag('event', name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()); } catch (e) {}
  }
  function status(t) { statusEl.textContent = t; }

  function setKnob() {
    var amt = (st.len + 1) / 4 * 75;
    knobEl.style.setProperty('--amt', amt + '%');
    knobEl.style.setProperty('--rot', (-135 + (st.len + 1) * 67.5) + 'deg');
    knobEl.setAttribute('aria-valuenow', st.len);
    knobEl.setAttribute('aria-valuetext', LENGTHS[st.len].t);
    lenOut.textContent = LENGTHS[st.len].t;
    root.querySelectorAll('.rv-ticks button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === st.len ? 'true' : 'false'); });
  }

  function decode(arrayBuf) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var oac = new OAC(2, SR, SR);
    return new Promise(function (res, rej) {
      var pr = oac.decodeAudioData(arrayBuf, res, rej);
      if (pr && pr.then) pr.then(res, rej);
    });
  }

  function useBuffer(buf) {
    var l = buf.getChannelData(0), r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
    var on = findOnset(l, r, SR), max = Math.min(l.length - on, Math.round(8 * SR));
    var L = new Float32Array(max), R = new Float32Array(max), pk = 0, i;
    for (i = 0; i < max; i++) { L[i] = l[on + i]; R[i] = r[on + i]; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
    if (pk > 1e-6) { var g = 0.8 / pk; for (i = 0; i < max; i++) { L[i] *= g; R[i] *= g; } }
    src = { l: L, r: R };
    render();
  }

  function render() {
    if (!src) return;
    stop();
    status('Rendering…');
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      var rs = renderRiser(src.l, src.r, {
        sampleRate: SR, bpm: st.bpm, lengthBeats: LENGTHS[st.len].b, sourceBeats: 2,
        decay: 0.6, size: 0.6, deEss: 0.6, lowCut: 150, highCut: 14000, curve: 0.3,
        sweep: st.sweep, drive: st.drive, wide: st.wide, chop: st.chop
      });
      if (!rs) { status('That clip is too short. Try a longer vocal.'); return; }
      var n = rs.l.length, total = n + src.l.length;
      var L = new Float32Array(total), R = new Float32Array(total);
      L.set(rs.l, 0); R.set(rs.r, 0); L.set(src.l, n); R.set(src.r, n);
      out = { riserLen: n, l: L, r: R };
      draw(-1);
      status('Ready. Press play.');
    }, 30);
  }

  function draw(pos) {
    if (!out) return;
    var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var N = out.l.length, per = N / w, mid = h / 2, split = out.riserLen / per;
    for (var x = 0; x < w; x++) {
      var a = Math.floor(x * per), b = Math.min(N, Math.floor((x + 1) * per)), pk = 0;
      for (var i = a; i < b; i += 4) pk = Math.max(pk, Math.abs(out.l[i]), Math.abs(out.r[i]));
      var hh = Math.max(1, pk * (mid - 6));
      c.fillStyle = x < split ? 'rgba(177,77,255,' + (0.45 + 0.55 * x / split) + ')' : 'rgba(239,234,247,.78)';
      c.fillRect(x, mid - hh, 1, hh * 2);
    }
    c.fillStyle = 'rgba(215,166,255,.9)'; c.fillRect(Math.round(split), 4, 2, h - 8);
    c.font = '700 11px Figtree, sans-serif'; c.fillStyle = 'rgba(215,166,255,.95)';
    c.fillText('RISER', 8, 16);
    c.fillStyle = 'rgba(239,234,247,.8)'; c.fillText('VOCAL', Math.min(w - 50, split + 8), 16);
    if (pos >= 0) { c.fillStyle = '#fff'; c.fillRect(Math.round(pos * w), 0, 2, h); }
  }

  function stop() {
    if (node) { try { node.onended = null; node.stop(); } catch (e) {} node = null; }
    cancelAnimationFrame(raf);
    if (root.classList.contains('playing')) status('Ready. Press play.');
    root.classList.remove('playing');
    draw(-1);
  }

  function play(riserOnly) {
    if (!out) return;
    document.querySelectorAll('audio,video').forEach(function (m) { if (!m.muted && !m.paused) m.pause(); });
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    stop();
    var len = riserOnly ? out.riserLen : out.l.length;
    var buf = ctx.createBuffer(2, len, SR);
    buf.getChannelData(0).set(out.l.subarray(0, len));
    buf.getChannelData(1).set(out.r.subarray(0, len));
    node = ctx.createBufferSource(); node.buffer = buf; node.connect(ctx.destination);
    node.onended = function () { stop(); };
    t0 = ctx.currentTime; playLen = len / SR; node.start();
    root.classList.add('playing');
    status(riserOnly ? 'Playing the riser…' : 'Playing…');
    (function tick() {
      var f = (ctx.currentTime - t0) / (out.l.length / SR);
      draw(Math.min(1, f));
      if (node) raf = requestAnimationFrame(tick);
    })();
    track(riserOnly ? 'RVRSDemoRiser' : 'RVRSDemoPlay');
  }

  // ---------- events ----------
  knobEl.addEventListener('click', function () { st.len = (st.len + 1) % 4; setKnob(); render(); });
  knobEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { st.len = Math.min(3, st.len + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { st.len = Math.max(0, st.len - 1); }
    else return;
    e.preventDefault(); setKnob(); render();
  });
  root.querySelectorAll('.rv-ticks button').forEach(function (b, i) {
    b.addEventListener('click', function () { st.len = i; setKnob(); render(); });
  });
  root.querySelectorAll('.rv-fx button').forEach(function (b) {
    b.setAttribute('aria-pressed', st[b.dataset.fx] ? 'true' : 'false');
    b.addEventListener('click', function () {
      st[b.dataset.fx] = !st[b.dataset.fx];
      b.setAttribute('aria-pressed', st[b.dataset.fx] ? 'true' : 'false');
      render();
    });
  });
  bpmIn.addEventListener('change', function () {
    st.bpm = clamp(parseInt(bpmIn.value, 10) || 128, 60, 200); bpmIn.value = st.bpm; render();
  });
  $('.rv-play').addEventListener('click', function () { root.classList.contains('playing') ? stop() : play(false); });
  $('.rv-riser').addEventListener('click', function () { play(true); });
  $('.rv-demo').addEventListener('click', function () { srcName.textContent = 'Demo vocal'; $('.rv-demo').hidden = true; loadDemo(); });
  $('.rv-demo').hidden = true;
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    status('Reading your file…');
    f.arrayBuffer().then(decode).then(function (b) {
      srcName.textContent = f.name; $('.rv-demo').hidden = false; useBuffer(b); track('RVRSDemoUpload');
    }).catch(function () { status('That file could not be read. Try a WAV or MP3.'); });
  });
  window.addEventListener('resize', function () { draw(-1); });

  var demoBuf = null;
  function loadDemo() {
    if (demoBuf) { useBuffer(demoBuf); return; }
    status('Loading the demo vocal…');
    fetch(root.dataset.demo).then(function (r) { return r.arrayBuffer(); }).then(decode)
      .then(function (b) { demoBuf = b; useBuffer(b); })
      .catch(function () { status('The demo vocal did not load. Refresh the page to try again.'); });
  }

  setKnob();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); loadDemo(); }
    }, { rootMargin: '300px' });
    io.observe(root);
  } else loadDemo();
})();

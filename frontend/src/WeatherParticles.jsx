import { useEffect, useRef } from "react";

// energyRef: a React ref whose .current is a 0–1 float updated by the beat
// simulation in App.jsx. The draw loop reads it every frame without needing
// the effect to re-run, so it intentionally stays out of the dependency array.
export default function WeatherParticles({ condition, energyRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !condition) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    let particles = [];
    let animId;
    let t = 0;

    // lightning state (thunderstorm only)
    let lightAlpha = 0;
    let nextFlash = 2 + Math.random() * 4;

    // sun shimmer / shooting-star state
    let shimmerAlpha = 0;
    let nextShimmer = 1 + Math.random() * 3;

    // cloud shadow sweep state (Clouds only)
    // shadowT0: t-value when the current shadow event started (-999 = none active)
    let shadowT0   = -999;
    let nextShadow = 12 + Math.random() * 10;
    let shimmerX = 0;
    let shimmerY = 0;

    function init() {
      particles = [];
      const w = canvas.width;
      const h = canvas.height;

      if (condition === "Rain") {
        for (let i = 0; i < 70; i++) {
          particles.push({
            x: Math.random() * (w + 150) - 75,
            y: Math.random() * h,
            speed: 9 + Math.random() * 7,
            len: 13 + Math.random() * 12,
            op: 0.12 + Math.random() * 0.22,
          });
        }
      }

      if (condition === "Thunderstorm") {
        for (let i = 0; i < 90; i++) {
          particles.push({
            x: Math.random() * (w + 150) - 75,
            y: Math.random() * h,
            speed: 12 + Math.random() * 9,
            len: 16 + Math.random() * 14,
            op: 0.14 + Math.random() * 0.24,
          });
        }
      }

      if (condition === "Snow") {
        for (let i = 0; i < 55; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 1.2 + Math.random() * 2.2,
            speed: 0.35 + Math.random() * 0.7,
            drift: Math.random() * Math.PI * 2,
            driftS: 0.008 + Math.random() * 0.016,
            op: 0.5 + Math.random() * 0.5,
          });
        }
      }

      if (condition === "Clear") {
        for (let i = 0; i < 35; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: 0.8 + Math.random() * 1.8,
            phase: Math.random() * Math.PI * 2,
            phaseS: 0.006 + Math.random() * 0.014,
          });
        }
      }

      if (condition === "Clouds") {
        // Three parallax fog layers — all confined to the top 24% of the canvas
        // so they never touch controls or progress bar.
        // Each particle is a wide flat fog ellipse drawn with a soft radial gradient.
        const layers = [
          // [count, yFracMin, yFracMax, wFracMin, wFracMax, hFracMin, hFracMax, spdMin, spdMax, opMin, opMax, blur]
          [3, 0.04, 0.18, 0.50, 0.90, 0.05, 0.11, 0.03, 0.06, 0.028, 0.055, 5.0], // background: widest, slowest, faintest, most blurred
          [3, 0.07, 0.22, 0.28, 0.58, 0.04, 0.09, 0.07, 0.13, 0.045, 0.085, 2.5], // midground
          [2, 0.03, 0.13, 0.32, 0.65, 0.03, 0.07, 0.13, 0.23, 0.035, 0.065, 0.8], // foreground: fastest, sharpest
        ];
        layers.forEach(([count, yMin, yMax, wMin, wMax, hMin, hMax, sMin, sMax, oMin, oMax, blur]) => {
          for (let i = 0; i < count; i++) {
            const wFrac = wMin + Math.random() * (wMax - wMin);
            const halfW = wFrac * w * 0.5;
            particles.push({
              x:     Math.random() * (w + halfW * 2) - halfW,
              yFrac: yMin + Math.random() * (yMax - yMin),
              wFrac,
              hFrac: hMin + Math.random() * (hMax - hMin),
              speed: sMin + Math.random() * (sMax - sMin),
              op:    oMin + Math.random() * (oMax - oMin),
              blur,
            });
          }
        });
      }

      if (condition === "Mist") {
        for (let i = 0; i < 7; i++) {
          particles.push({
            x:      Math.random() * (w + 300) - 150,
            y:      10  + Math.random() * (h - 20),
            cw:     130 + Math.random() * 190,
            ch:     14  + Math.random() * 22,
            speed:  0.07 + Math.random() * 0.13,
            phase:  Math.random() * Math.PI * 2,
            phaseS: 0.003 + Math.random() * 0.005,
            baseOp: 0.035 + Math.random() * 0.04,
          });
        }
      }

      if (condition === "Night") {
        for (let i = 0; i < 80; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.4 + Math.random() * 1.4,
            phase: Math.random() * Math.PI * 2,
            phaseS: 0.005 + Math.random() * 0.018,
            bright: Math.random() < 0.15,
          });
        }
      }

      if (condition === "Dust") {
        for (let i = 0; i < 45; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.8 + Math.random() * 1.6,
            speedX: (Math.random() - 0.2) * 1.2,
            speedY: (Math.random() - 0.5) * 0.5,
            op: 0.15 + Math.random() * 0.3,
          });
        }
      }
    }

    init();

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      // read beat energy every frame — energyRef is stable, .current changes
      const bass = energyRef?.current ?? 0;

      // ── Rain ──
      if (condition === "Rain") {
        ctx.save();
        particles.forEach(p => {
          const spd = p.speed * (1 + bass * 0.7);
          const op  = p.op    * (0.8 + bass * 0.5);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(140,190,255,${op})`;
          ctx.lineWidth = 1.1 + bass * 0.4;
          const dx = -p.len * 0.28;
          const dy = p.len;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();
          p.x += dx / (p.len / spd);
          p.y += spd;
          if (p.y > h + 20) { p.y = -25; p.x = Math.random() * (w + 150) - 75; }
        });
        ctx.restore();
      }

      // ── Thunderstorm ──
      if (condition === "Thunderstorm") {
        ctx.save();
        particles.forEach(p => {
          const spd = p.speed * (1 + bass * 0.8);
          const op  = p.op    * (0.8 + bass * 0.5);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(160,140,255,${op})`;
          ctx.lineWidth = 1.2 + bass * 0.5;
          const dx = -p.len * 0.28;
          const dy = p.len;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();
          p.x += dx / (p.len / spd);
          p.y += spd;
          if (p.y > h + 20) { p.y = -25; p.x = Math.random() * (w + 150) - 75; }
        });
        ctx.restore();

        // lightning flash — also triggered on strong bass peaks
        if (t > nextFlash || (bass > 0.88 && lightAlpha <= 0)) {
          lightAlpha = 0.55 + bass * 0.2;
          nextFlash = t + 2.5 + Math.random() * 5;
        }
        if (lightAlpha > 0) {
          ctx.fillStyle = `rgba(220,200,255,${lightAlpha})`;
          ctx.fillRect(0, 0, w, h);
          lightAlpha = Math.max(0, lightAlpha - 0.055);
        }
      }

      // ── Snow ──
      if (condition === "Snow") {
        ctx.save();
        particles.forEach(p => {
          p.drift += p.driftS;
          // bass makes flakes drift wider
          const driftAmt = 0.55 + bass * 0.7;
          p.x += Math.sin(p.drift) * driftAmt;
          p.y += p.speed * (1 + bass * 0.4);
          if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${p.op})`;
          ctx.fill();
        });
        ctx.restore();
      }

      // ── Clear — golden sparkles + sun shimmer ──
      if (condition === "Clear") {
        ctx.save();
        particles.forEach(p => {
          p.phase += p.phaseS;
          // sparkles brighten and grow on the beat
          const op = ((Math.sin(p.phase) + 1) / 2) * (0.5 + bass * 0.5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + bass * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,210,60,${op})`;
          ctx.fill();
        });

        // sun shimmer — also triggered on bass peak for beat-sync
        if (t > nextShimmer || (bass > 0.85 && shimmerAlpha <= 0.01)) {
          shimmerAlpha = 0.18 + bass * 0.12;
          nextShimmer = t + 3 + Math.random() * 4;
        }
        if (shimmerAlpha > 0) {
          const grd = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.65);
          grd.addColorStop(0, `rgba(255,220,80,${shimmerAlpha})`);
          grd.addColorStop(1, "rgba(255,220,80,0)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, w, h);
          shimmerAlpha = Math.max(0, shimmerAlpha - 0.004);
        }
        ctx.restore();
      }

      // ── Clouds — three parallax fog layers, top-quarter only ──
      // Diffuse radial-gradient ellipses; never touch controls or art.
      if (condition === "Clouds") {
        ctx.save();

        // very faint overcast wash at the top
        const ov = ctx.createLinearGradient(0, 0, 0, h * 0.32);
        ov.addColorStop(0, "rgba(85,100,125,0.09)");
        ov.addColorStop(1, "rgba(85,100,125,0)");
        ctx.fillStyle = ov;
        ctx.fillRect(0, 0, w, h);

        // each particle carries its layer's blur so distant fog looks softer
        particles.forEach(p => {
          const py = p.yFrac * h;
          const rw = p.wFrac * w * 0.5;
          const rh = p.hFrac * h * 0.5;
          const op = Math.min(0.24, p.op * (0.9 + bass * 0.35));

          ctx.save();
          ctx.filter = `blur(${p.blur}px)`;

          const grd = ctx.createRadialGradient(p.x, py, 0, p.x, py, rw);
          grd.addColorStop(0,   `rgba(200,215,235,${op})`);
          grd.addColorStop(0.5, `rgba(190,208,230,${op * 0.38})`);
          grd.addColorStop(1,   "rgba(190,208,230,0)");

          ctx.beginPath();
          ctx.ellipse(p.x, py, rw, rh, 0, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
          ctx.restore();

          p.x += p.speed * (1 + bass * 0.8);
          if (p.x - rw * 1.2 > w + 10) p.x = -(rw * 1.2 + 10);
        });

        // ── cloud shadow sweep ──
        // Every 12-22 s a gentle darkness passes over the full player, as if
        // a real cloud drifted in front of the sun. Ramp: 1.5 s in → 1 s hold → 1.5 s out.
        if (t > nextShadow) {
          shadowT0   = t;
          nextShadow = t + 14 + Math.random() * 8;
        }
        const shadowElapsed = t - shadowT0;
        if (shadowElapsed >= 0 && shadowElapsed < 4.0) {
          let shadowA;
          if      (shadowElapsed < 1.5) shadowA =  (shadowElapsed / 1.5) * 0.055;
          else if (shadowElapsed < 2.5) shadowA = 0.055;
          else                          shadowA = Math.max(0, (1 - (shadowElapsed - 2.5) / 1.5) * 0.055);
          ctx.fillStyle = `rgba(0,0,0,${shadowA})`;
          ctx.fillRect(0, 0, w, h);
        }

        ctx.restore();
      }

      // ── Mist — wispy elongated cloud-like streaks ──
      if (condition === "Mist") {
        ctx.save();
        particles.forEach(p => {
          p.phase += p.phaseS;
          // mist drifts faster with beat energy
          p.x += p.speed * (1 + bass * 0.8);
          if (p.x - p.cw * 0.6 > w + 10) p.x = -p.cw * 0.6 - 10;
          const op = p.baseOp + Math.sin(p.phase) * 0.018;
          const bumps = [
            { ox: 0,            oy: 0,            r: p.ch * 0.55 },
            { ox:  p.cw * 0.28, oy: -p.ch * 0.1,  r: p.ch * 0.48 },
            { ox: -p.cw * 0.27, oy:  p.ch * 0.08, r: p.ch * 0.43 },
            { ox:  p.cw * 0.52, oy:  p.ch * 0.12, r: p.ch * 0.37 },
            { ox: -p.cw * 0.50, oy:  p.ch * 0.10, r: p.ch * 0.33 },
          ];
          ctx.beginPath();
          bumps.forEach(b => {
            ctx.moveTo(p.x + b.ox + b.r, p.y + b.oy);
            ctx.arc(p.x + b.ox, p.y + b.oy, b.r, 0, Math.PI * 2);
          });
          ctx.fillStyle = `rgba(200,212,238,${op})`;
          ctx.fill();
        });
        ctx.restore();
      }

      // ── Night — stars + moon glow ──
      if (condition === "Night") {
        ctx.save();

        // moon glow pulses with bass
        const moonX = w * 0.82;
        const moonY = h * 0.08;
        const moonGlow = 0.13 + bass * 0.12;
        const grd = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, w * 0.55);
        grd.addColorStop(0, `rgba(200,215,255,${moonGlow})`);
        grd.addColorStop(1, "rgba(200,215,255,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // twinkling stars — brighter and bigger on the beat
        particles.forEach(p => {
          p.phase += p.phaseS;
          const baseBright = p.bright ? 0.9 : 0.55;
          const op = ((Math.sin(p.phase) + 1) / 2) * (baseBright + bass * 0.35);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 + bass * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = p.bright
            ? `rgba(220,230,255,${Math.min(1, op)})`
            : `rgba(180,195,255,${Math.min(1, op)})`;
          ctx.fill();
        });

        // occasional shooting star — position is fixed when it spawns, not re-rolled each frame
        if (t > nextShimmer) {
          shimmerAlpha = 1;
          nextShimmer = t + 4 + Math.random() * 8;
          shimmerX = w * 0.2 + Math.random() * w * 0.5;
          shimmerY = h * 0.05 + Math.random() * h * 0.2;
        }
        if (shimmerAlpha > 0) {
          const sx = shimmerX;
          const sy = shimmerY;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 60, sy + 30);
          ctx.strokeStyle = `rgba(220,230,255,${shimmerAlpha * 0.7})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          shimmerAlpha = Math.max(0, shimmerAlpha - 0.04);
        }

        ctx.restore();
      }

      // ── Dust — swirling amber dots ──
      if (condition === "Dust") {
        ctx.save();
        particles.forEach(p => {
          // swirl frequency and amplitude both scale with bass
          p.x += p.speedX + Math.sin(t * (0.5 + bass * 1.5) + p.y * 0.02) * (0.4 + bass * 0.7);
          p.y += p.speedY;
          if (p.x > w + 5)  p.x = -5;
          if (p.x < -5)     p.x = w + 5;
          if (p.y > h + 5)  p.y = -5;
          if (p.y < -5)     p.y = h + 5;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 + bass * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210,145,50,${p.op * (0.8 + bass * 0.5)})`;
          ctx.fill();
        });
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [condition]); // energyRef intentionally omitted — it's a stable ref object

  if (!condition) return null;
  return <canvas ref={canvasRef} className="ms-wx-canvas" />;
}

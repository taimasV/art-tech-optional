(() => {
  const canvas = document.getElementById('grainBackdrop');
  if (!canvas) return;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0.5, y: 0.5, energy: 0 };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let time = 0;
  let frame = 0;
  let lastFrame = 0;

  const palettes = {
    dark: [
      { color: [167, 211, 137], center: 0.46, spread: 0.34, amplitude: 0.075, phase: 0.2 },
      { color: [255, 194, 71], center: 0.61, spread: 0.25, amplitude: 0.055, phase: 2.4 },
      { color: [91, 166, 111], center: 0.35, spread: 0.22, amplitude: 0.045, phase: 4.1 },
    ],
    light: [
      { color: [45, 106, 63], center: 0.46, spread: 0.34, amplitude: 0.075, phase: 0.2 },
      { color: [177, 121, 19], center: 0.61, spread: 0.25, amplitude: 0.055, phase: 2.4 },
      { color: [83, 142, 91], center: 0.35, spread: 0.22, amplitude: 0.045, phase: 4.1 },
    ],
  };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    requestDraw();
  }

  function draw() {
    frame = 0;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = document.documentElement.dataset.theme === 'light' ? 'multiply' : 'screen';

    const bands = palettes[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
    const strands = width < 640 ? 22 : 34;
    const segments = Math.max(24, Math.ceil(width / 30));

    bands.forEach((band, bandIndex) => {
      for (let strand = 0; strand < strands; strand += 1) {
        const across = strand / (strands - 1) - 0.5;
        const baseY = height * (band.center + across * band.spread);
        const phase = time * (0.42 + bandIndex * 0.06) + across * 5.8 + band.phase;
        const alpha = 0.12 + (1 - Math.abs(across) * 1.7) * 0.19;
        const lineWidth = 0.45 + (1 - Math.abs(across) * 1.5) * 0.8;

        context.beginPath();
        for (let point = 0; point <= segments; point += 1) {
          const progress = point / segments;
          const x = progress * width;
          const wave = Math.sin(progress * 6.2 + phase) + Math.sin(progress * 12.4 - phase * 0.73) * 0.28;
          const dx = progress - pointer.x;
          const dy = baseY / Math.max(height, 1) - pointer.y;
          const influence = Math.exp(-(dx * dx / 0.035 + dy * dy / 0.075));
          const touchWave = Math.sin(dx * 30 - time * 2.6) * influence * pointer.energy * height * 0.035;
          const y = baseY + wave * height * band.amplitude + touchWave;
          if (point === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }

        context.strokeStyle = `rgba(${band.color.join(',')},${Math.max(0.025, alpha).toFixed(3)})`;
        context.lineWidth = lineWidth;
        context.stroke();

        // A few drifting flecks give the flowing bands their fine grain.
        for (let fleck = 0; fleck < 2; fleck += 1) {
          const drift = (time * 0.025 + strand * 0.137 + fleck * 0.47 + band.phase) % 1;
          const x = drift * width;
          const wave = Math.sin(drift * 6.2 + phase) + Math.sin(drift * 12.4 - phase * 0.73) * 0.28;
          const y = baseY + wave * height * band.amplitude;
          context.beginPath();
          context.fillStyle = `rgba(${band.color.join(',')},0.32)`;
          context.arc(x, y, fleck === 0 ? 0.8 : 0.55, 0, Math.PI * 2);
          context.fill();
        }
      }
    });

    context.globalCompositeOperation = 'source-over';
    pointer.energy *= 0.94;
    if (!motionPreference.matches && !document.hidden) frame = window.requestAnimationFrame(tick);
  }

  function tick(now) {
    const delta = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    time += delta;
    draw();
  }

  function requestDraw() {
    if (frame) return;
    if (motionPreference.matches || document.hidden) {
      draw();
      return;
    }
    lastFrame = 0;
    frame = window.requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', event => {
    const x = event.clientX / Math.max(window.innerWidth, 1);
    const y = event.clientY / Math.max(window.innerHeight, 1);
    pointer.energy = Math.min(1, pointer.energy + Math.abs(x - pointer.x) + Math.abs(y - pointer.y));
    pointer.x = x;
    pointer.y = y;
    if (motionPreference.matches) requestDraw();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    } else {
      requestDraw();
    }
  });
  new MutationObserver(requestDraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  motionPreference.addEventListener?.('change', requestDraw);
  resize();
})();

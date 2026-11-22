(() => {
  const panel = document.getElementById('circuitFlash');
  const canvas = document.getElementById('circuitCanvas');
  const coordinateReadout = document.getElementById('circuitCoordinates');
  const context = canvas?.getContext('2d');
  if (!panel || !canvas || !context || !coordinateReadout) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0.5, y: 0.5 };
  const boxes = [
    { width: 54, height: 34, phase: 0.3, speed: 0.42 },
    { width: 38, height: 26, phase: 2.6, speed: -0.28 },
    { width: 30, height: 22, phase: 4.4, speed: 0.21 },
  ];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;
  let visible = true;
  let startedAt = performance.now();

  function resize() {
    const bounds = panel.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    paint(reducedMotion.matches ? 0 : (performance.now() - startedAt) / 1000);
  }

  function drawBox(x, y, boxWidth, boxHeight, color, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = 1;
    const halfWidth = boxWidth / 2;
    const halfHeight = boxHeight / 2;
    const corner = Math.min(9, boxWidth / 4, boxHeight / 4);
    context.setLineDash([4, 4]);
    context.strokeRect(x - halfWidth, y - halfHeight, boxWidth, boxHeight);
    context.setLineDash([]);
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(x - halfWidth, y - halfHeight + corner); context.lineTo(x - halfWidth, y - halfHeight); context.lineTo(x - halfWidth + corner, y - halfHeight);
    context.moveTo(x + halfWidth - corner, y - halfHeight); context.lineTo(x + halfWidth, y - halfHeight); context.lineTo(x + halfWidth, y - halfHeight + corner);
    context.moveTo(x - halfWidth, y + halfHeight - corner); context.lineTo(x - halfWidth, y + halfHeight); context.lineTo(x - halfWidth + corner, y + halfHeight);
    context.moveTo(x + halfWidth - corner, y + halfHeight); context.lineTo(x + halfWidth, y + halfHeight); context.lineTo(x + halfWidth, y + halfHeight - corner);
    context.stroke();
    context.restore();
  }

  function paint(time) {
    if (!width || !height) return;
    const palette = getComputedStyle(panel);
    const accent = palette.getPropertyValue('--circuit-accent').trim() || '#f2c66d';
    const rayColor = palette.getPropertyValue('--circuit-ray').trim() || '#8bdcff';
    context.clearRect(0, 0, width, height);

    const targetX = pointer.x * width;
    const targetY = pointer.y * height;
    const drift = Math.sin(time * 0.55) * 0.035;
    const scanX = ((time * 0.12) % 1) * width;
    const spacing = 13;

    const ray = context.createLinearGradient(targetX, 0, targetX, height);
    ray.addColorStop(0, 'rgba(116, 205, 239, 0.01)');
    ray.addColorStop(0.55, 'rgba(116, 205, 239, 0.12)');
    ray.addColorStop(1, 'rgba(116, 205, 239, 0)');
    context.fillStyle = ray;
    context.fillRect(targetX - 1, 0, 2, height);

    const beam = context.createLinearGradient(scanX - 34, 0, scanX + 34, 0);
    beam.addColorStop(0, 'rgba(123, 214, 255, 0)');
    beam.addColorStop(0.5, 'rgba(123, 214, 255, 0.13)');
    beam.addColorStop(1, 'rgba(123, 214, 255, 0)');
    context.fillStyle = beam;
    context.fillRect(scanX - 34, 0, 68, height);

    for (let y = 14; y < height - 14; y += spacing) {
      for (let x = 12; x < width - 8; x += spacing) {
        const dx = (x - targetX) / Math.max(width, 1);
        const dy = (y - targetY) / Math.max(height, 1);
        const focus = Math.max(0, 1 - Math.sqrt(dx * dx * 4 + dy * dy * 3));
        const scan = Math.max(0, 1 - Math.abs(x - scanX) / 90);
        const alpha = 0.14 + focus * 0.45 + scan * 0.16;
        context.fillStyle = `rgba(151, 207, 225, ${alpha})`;
        context.beginPath();
        context.arc(x, y, 0.8 + focus * 0.35, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.save();
    context.strokeStyle = 'rgba(127, 204, 235, 0.20)';
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(0, targetY); context.lineTo(width, targetY);
    context.moveTo(targetX, 0); context.lineTo(targetX, height);
    context.stroke();
    context.restore();

    boxes.forEach((box, index) => {
      const orbit = time * box.speed + box.phase;
      const x = targetX + Math.cos(orbit) * width * (0.13 + index * 0.045) + drift * width;
      const y = targetY + Math.sin(orbit * 1.3) * height * (0.18 + index * 0.06);
      const color = index === 1 ? accent : rayColor;
      drawBox(x, y, box.width, box.height, color, 0.78 - index * 0.14);
      context.save();
      context.globalAlpha = 0.3;
      context.strokeStyle = color;
      context.setLineDash([2, 5]);
      context.beginPath();
      context.moveTo(targetX, targetY);
      context.lineTo(x, y);
      context.stroke();
      context.restore();
    });

    context.beginPath();
    context.arc(targetX, targetY, 3, 0, Math.PI * 2);
    context.fillStyle = accent;
    context.shadowColor = accent;
    context.shadowBlur = 12;
    context.fill();
    context.shadowBlur = 0;
  }

  function animate(now) {
    frame = 0;
    if (!visible || document.hidden || document.documentElement.dataset.theme !== 'dark') return;
    paint((now - startedAt) / 1000);
    if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
  }

  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (document.documentElement.dataset.theme !== 'dark' || !visible || document.hidden) return;
    startedAt = performance.now();
    if (reducedMotion.matches) paint(0);
    else frame = requestAnimationFrame(animate);
  }

  panel.addEventListener('pointermove', event => {
    const bounds = panel.getBoundingClientRect();
    pointer.x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    pointer.y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    coordinateReadout.value = `X ${String(Math.round(pointer.x * 999)).padStart(3, '0')} · Y ${String(Math.round(pointer.y * 999)).padStart(3, '0')}`;
    if (reducedMotion.matches) paint(0);
  });

  new ResizeObserver(resize).observe(panel);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(panel);
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener?.('change', sync);
  resize();
  sync();
})();

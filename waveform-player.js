(() => {
  const canvas = document.getElementById('waveformCanvas');
  const audio = document.getElementById('memoryAudio');
  const fileInput = document.getElementById('audioFileInput');
  const playButton = document.getElementById('wavePlayButton');
  const title = document.getElementById('waveTrackTitle');
  const artist = document.getElementById('waveTrackArtist');
  const currentTimeLabel = document.getElementById('waveCurrentTime');
  const durationLabel = document.getElementById('waveDuration');
  const songInput = document.getElementById('songInput');
  if (!canvas || !audio || !fileInput || !playButton) return;

  const ctx = canvas.getContext('2d');
  let peaks = [];
  let objectUrl = '';
  let raf = 0;
  let pixelRatio = 1;

  function demoPeaks(count = 96) {
    return Array.from({ length: count }, (_, i) => {
      const wave = Math.abs(Math.sin(i * 0.19) * 0.44 + Math.sin(i * 0.071 + 1.4) * 0.31 + Math.sin(i * 0.43) * 0.12);
      return Math.min(1, 0.16 + wave);
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  function draw() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(document.documentElement);
    const playedColor = style.getPropertyValue('--green-accent').trim() || '#a8ce8d';
    const waitingColor = style.getPropertyValue('--wave-muted').trim() || '#78907d';
    const barWidth = 2.4;
    const gap = 2.1;
    const step = barWidth + gap;
    const count = Math.max(1, Math.floor((width + gap) / step));
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
    const activeBars = audio.src ? Math.floor(progress * count) : -1;
    const values = peaks.length ? peaks : demoPeaks(count);

    for (let i = 0; i < count; i += 1) {
      const sample = values[Math.min(values.length - 1, Math.floor((i / count) * values.length))] || 0.1;
      const liveLift = !audio.paused && Math.abs(i - activeBars) < 9 ? Math.sin(performance.now() / 115 + i * 0.7) * 0.11 : 0;
      const barHeight = Math.max(3, (sample + liveLift) * height * 0.88);
      const x = i * step;
      const y = (height - barHeight) / 2;
      ctx.fillStyle = i <= activeBars && peaks.length ? playedColor : waitingColor;
      ctx.globalAlpha = i <= activeBars && peaks.length ? 0.98 : 0.72;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (peaks.length && progress > 0) {
      const playheadX = Math.min(width - 1, progress * width);
      ctx.fillStyle = style.getPropertyValue('--color-accent').trim() || '#ffc247';
      ctx.beginPath();
      ctx.arc(playheadX, height / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    canvas.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    canvas.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
  }

  function animate() {
    draw();
    if (!audio.paused) raf = requestAnimationFrame(animate);
  }

  function updateTitle() {
    const text = songInput?.value.trim();
    if (text) title.textContent = text;
    else if (!audio.src) title.textContent = 'Выбери аудиофайл';
  }

  async function makeWaveform(file) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      peaks = demoPeaks();
      artist.textContent = `${file.name} · предпросмотр недоступен`;
      draw();
      return;
    }

    let audioContext;
    try {
      audioContext = new AudioContextClass();
      const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
      const data = buffer.getChannelData(0);
      const count = 180;
      const chunkSize = Math.max(1, Math.floor(data.length / count));
      const raw = [];
      let maximum = 0;
      for (let i = 0; i < count; i += 1) {
        const start = i * chunkSize;
        const end = Math.min(data.length, start + chunkSize);
        let peak = 0;
        for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(data[sample]));
        raw.push(peak);
        maximum = Math.max(maximum, peak);
      }
      peaks = raw.map(peak => Math.max(0.08, maximum ? peak / maximum : 0.08));
      artist.textContent = file.name;
    } catch {
      peaks = demoPeaks();
      artist.textContent = `${file.name} · упрощённая форма`;
    } finally {
      await audioContext?.close().catch(() => {});
      draw();
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.load();
    document.dispatchEvent(new CustomEvent('tiho-audio-selected', { detail: { file } }));
    peaks = [];
    playButton.disabled = false;
    artist.textContent = 'Загружаю звуковую волну…';
    if (songInput && !songInput.value.trim()) {
      songInput.value = file.name.replace(/\.[^.]+$/, '');
      songInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateTitle();
    await makeWaveform(file);
    fileInput.value = '';
  });

  playButton.addEventListener('click', async () => {
    if (!audio.src) return;
    if (audio.paused) {
      try { await audio.play(); } catch { artist.textContent = 'Не удалось воспроизвести этот файл'; }
    } else {
      audio.pause();
    }
  });
  audio.addEventListener('play', () => {
    playButton.textContent = 'Ⅱ';
    playButton.setAttribute('aria-label', 'Пауза');
    cancelAnimationFrame(raf);
    animate();
  });
  audio.addEventListener('pause', () => {
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Продолжить');
    cancelAnimationFrame(raf);
    draw();
  });
  audio.addEventListener('ended', () => { audio.currentTime = 0; draw(); });
  audio.addEventListener('loadedmetadata', () => {
    durationLabel.textContent = formatTime(audio.duration);
    draw();
  });
  audio.addEventListener('timeupdate', () => {
    currentTimeLabel.textContent = formatTime(audio.currentTime);
    draw();
  });
  songInput?.addEventListener('input', updateTitle);

  document.addEventListener('tiho-audio-saved', () => {
    audio.pause();
    cancelAnimationFrame(raf);
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    peaks = demoPeaks();
    playButton.disabled = true;
    title.textContent = 'Выбери аудиофайл';
    artist.textContent = 'Звук дня';
    currentTimeLabel.textContent = '0:00';
    durationLabel.textContent = '0:00';
    draw();
  });

  document.getElementById('createMemory')?.addEventListener('click', () => {
    window.setTimeout(() => {
      if (document.getElementById('story')?.value || songInput?.value) return;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
      peaks = demoPeaks();
      playButton.disabled = true;
      title.textContent = 'Выбери аудиофайл';
      artist.textContent = 'Звук дня';
      currentTimeLabel.textContent = '0:00';
      durationLabel.textContent = '0:00';
      draw();
    }, 0);
  });

  function seekFromPointer(event) {
    if (!audio.src || !Number.isFinite(audio.duration)) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    currentTimeLabel.textContent = formatTime(audio.currentTime);
    draw();
  }
  canvas.addEventListener('pointerdown', event => {
    if (!audio.src) return;
    canvas.setPointerCapture?.(event.pointerId);
    seekFromPointer(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.buttons) seekFromPointer(event);
  });
  canvas.addEventListener('keydown', event => {
    if (!audio.src || !Number.isFinite(audio.duration)) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5)));
    } else if (event.key === 'Home') audio.currentTime = 0;
    else if (event.key === 'End') audio.currentTime = audio.duration;
    else return;
    currentTimeLabel.textContent = formatTime(audio.currentTime);
    draw();
  });

  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('beforeunload', () => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
  window.addEventListener('resize', resize, { passive: true });
  peaks = demoPeaks();
  resize();
  updateTitle();
})();

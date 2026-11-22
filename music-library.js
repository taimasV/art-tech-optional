(() => {
  const input = document.getElementById('songInput');
  const searchButton = document.getElementById('songAdd');
  const results = document.getElementById('songResults');
  const playerTitle = document.getElementById('waveTrackTitle');
  const playerArtist = document.getElementById('waveTrackArtist');
  const audioFileInput = document.getElementById('audioFileInput');
  const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
  let pendingFile = null;
  let searchSequence = 0;

  window.tihoAccountUser ||= null;
  window.tihoSelectedTrack = null;

  function showSearchStatus(message) {
    const status = document.createElement('div');
    status.className = 'song-search-status';
    status.textContent = message;
    results.replaceChildren(status);
    results.classList.remove('hidden');
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }

  function renderTrack(track) {
    const card = document.createElement('article');
    card.className = 'song-result';

    const artwork = document.createElement('div');
    artwork.className = 'song-result-art';
    artwork.setAttribute('aria-hidden', 'true');
    artwork.textContent = '♫';

    const copy = document.createElement('div');
    copy.className = 'song-result-copy';
    const title = document.createElement('strong');
    title.textContent = track.title;
    const details = document.createElement('small');
    details.textContent = [track.artist, track.album].filter(Boolean).join(' · ');
    copy.append(title, details);

    const actions = document.createElement('div');
    actions.className = 'song-result-actions';
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'song-result-select';
    choose.textContent = 'В дневник';
    choose.addEventListener('click', () => {
      const url = safeExternalUrl(track.url);
      window.tihoSelectedTrack = { ...track, url };
      input.value = `${track.title} — ${track.artist}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (playerTitle) playerTitle.textContent = track.title;
      if (playerArtist) playerArtist.textContent = track.artist;
      results.classList.add('hidden');
      document.getElementById('songTip').textContent = url
        ? 'Песня добавлена к воспоминанию. Слушать её можно в Apple Music по ссылке в архиве.'
        : 'Песня добавлена к воспоминанию.';
    });
    actions.append(choose);

    const externalUrl = safeExternalUrl(track.url);
    if (externalUrl) {
      const link = document.createElement('a');
      link.className = 'song-result-link';
      link.href = externalUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Слушать ↗';
      actions.append(link);
    }
    card.append(artwork, copy, actions);
    return card;
  }

  function searchAppleCatalog(term) {
    return new Promise((resolve, reject) => {
      const callback = `tihoAppleSearch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const url = new URL('https://itunes.apple.com/search');
      url.searchParams.set('term', term);
      url.searchParams.set('media', 'music');
      url.searchParams.set('entity', 'song');
      url.searchParams.set('country', 'ru');
      url.searchParams.set('limit', '12');
      url.searchParams.set('callback', callback);
      const cleanUp = () => { delete window[callback]; script.remove(); clearTimeout(timeout); };
      const timeout = setTimeout(() => { cleanUp(); reject(new Error('Каталог музыки не ответил вовремя.')); }, 12000);
      window[callback] = data => { cleanUp(); resolve(data); };
      script.onerror = () => { cleanUp(); reject(new Error('Не удалось связаться с каталогом музыки.')); };
      script.src = url.href;
      document.head.append(script);
    });
  }

  async function searchMusic() {
    const term = input.value.trim();
    if (term.length < 2) {
      showSearchStatus('Введи хотя бы два символа: название песни или исполнителя.');
      input.focus();
      return;
    }
    const sequence = ++searchSequence;
    searchButton.disabled = true;
    showSearchStatus('Ищу совпадения в каталоге Apple Music…');
    try {
      let data;
      try {
        const response = await fetch(`/api/music/search?term=${encodeURIComponent(term)}`);
        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось выполнить поиск.');
      } catch (serverError) {
        const catalog = await searchAppleCatalog(term);
        data = { tracks: (catalog.results || []).map(track => ({
          id: track.trackId,
          title: track.trackName,
          artist: track.artistName || 'Неизвестный исполнитель',
          album: track.collectionName || '',
          artwork: track.artworkUrl100 || '',
          url: track.trackViewUrl || '',
          genre: track.primaryGenreName || '',
        })) };
        if (!data.tracks.length && !catalog.results) throw serverError;
      }
      if (sequence !== searchSequence) return;
      if (!data.tracks?.length) {
        showSearchStatus('Ничего не нашлось. Попробуй название или имя исполнителя.');
        return;
      }
      const list = document.createDocumentFragment();
      data.tracks.forEach(track => list.append(renderTrack(track)));
      const attribution = document.createElement('div');
      attribution.className = 'song-result-attribution';
      attribution.textContent = 'Результаты каталога Apple Music';
      results.replaceChildren(list, attribution);
      results.classList.remove('hidden');
    } catch (error) {
      if (sequence === searchSequence) showSearchStatus(error.message || 'Поиск временно недоступен.');
    } finally {
      searchButton.disabled = false;
    }
  }

  function openAudioDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('tiho-audio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть хранилище аудио.'));
    });
  }

  function saveAudioLocally(id, file) {
    return openAudioDatabase().then(database => new Promise((resolve, reject) => {
      const transaction = database.transaction('files', 'readwrite');
      transaction.objectStore('files').put(file, id);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Не удалось сохранить файл в этом браузере.')); };
      transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Не удалось сохранить файл в этом браузере.')); };
    }));
  }

  function readAudioLocally(id) {
    return openAudioDatabase().then(database => new Promise((resolve, reject) => {
      const request = database.transaction('files', 'readonly').objectStore('files').get(id);
      request.onsuccess = () => { database.close(); resolve(request.result || null); };
      request.onerror = () => { database.close(); reject(request.error || new Error('Не удалось открыть аудиофайл.')); };
    }));
  }

  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Не удалось прочитать аудиофайл.'));
      reader.readAsDataURL(file);
    });
  }

  async function saveAudio(file) {
    if (!file) return null;
    if (!file.size) throw new Error('Аудиофайл пустой. Выбери другой файл.');
    if (file.size > MAX_AUDIO_SIZE) throw new Error('Для сохранения выбери аудиофайл до 20 МБ.');
    if (!file.type.startsWith('audio/')) throw new Error('Выбери аудиофайл.');

    if (window.tihoAccountUser) {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: await fileAsDataUrl(file), name: file.name, type: file.type }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить аудиофайл.');
      return { ...result.audio, storage: 'account' };
    }

    const id = crypto.randomUUID();
    await saveAudioLocally(id, file);
    return { id, name: file.name, mimeType: file.type, storage: 'browser' };
  }

  async function getAudioUrl(audio) {
    if (audio.storage === 'account') return `/api/audio/${encodeURIComponent(audio.id)}`;
    const file = await readAudioLocally(audio.id);
    if (!file) throw new Error('Этот аудиофайл больше не найден в браузере.');
    return URL.createObjectURL(file);
  }

  async function promoteAudioToAccount(audio) {
    if (!audio || audio.storage !== 'browser' || !window.tihoAccountUser) return audio;
    const file = await readAudioLocally(audio.id);
    return file ? saveAudio(file) : audio;
  }

  document.addEventListener('tiho-audio-selected', event => {
    pendingFile = event.detail?.file || null;
    window.tihoSelectedTrack = null;
  });
  document.addEventListener('tiho-audio-saved', () => { pendingFile = null; });
  input.addEventListener('input', () => {
    const selected = window.tihoSelectedTrack;
    if (selected && input.value.trim() !== `${selected.title} — ${selected.artist}`) window.tihoSelectedTrack = null;
  });
  audioFileInput?.addEventListener('change', event => {
    const file = audioFileInput.files?.[0];
    if (!file) return;
    if (file.size > MAX_AUDIO_SIZE) {
      event.stopImmediatePropagation();
      audioFileInput.value = '';
      document.getElementById('toast').textContent = 'Аудиофайлы больше 20 МБ не поддерживаются.';
      document.getElementById('toast').classList.add('show');
      window.setTimeout(() => document.getElementById('toast').classList.remove('show'), 2600);
    }
  }, true);
  searchButton.addEventListener('click', searchMusic);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); searchMusic(); }
  });

  window.tihoMusic = {
    search: searchMusic,
    getPendingFile: () => pendingFile,
    saveAudio,
    promoteAudioToAccount,
    getAudioUrl,
    releaseAudioUrl: url => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); },
    clearSelection: () => { pendingFile = null; window.tihoSelectedTrack = null; },
  };
})();

const $ = (id) => document.getElementById(id);
const themeToggle = $('themeToggle');
const savedTheme = localStorage.getItem('tiho-theme');
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
function updateThemeToggle() {
  const isLight = document.documentElement.dataset.theme === 'light';
  $('themeIcon').textContent = isLight ? '☾' : '☼';
  $('themeLabel').textContent = isLight ? 'Тёмная' : 'Светлая';
  themeToggle.setAttribute('aria-label', `Переключить на ${isLight ? 'тёмную' : 'светлую'} тему`);
}
themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('tiho-theme', nextTheme);
  updateThemeToggle();
});
updateThemeToggle();
const story = $('story'), titleInput = $('eventTitle'), songInput = $('songInput'), photoInput = $('photoInput');
const composer = $('createMemoryModal'), composerTrigger = $('openMemoryComposer'), editorCard = document.querySelector('.editor-card');
$('composerForm').append(editorCard);
function openComposer() { composer.classList.remove('hidden'); document.body.classList.add('composer-open'); titleInput.focus(); }
function closeComposer() { composer.classList.add('hidden'); document.body.classList.remove('composer-open'); composerTrigger.focus(); }
composerTrigger.addEventListener('click', openComposer);
$('closeMemoryComposer').addEventListener('click', closeComposer);
composer.addEventListener('click', event => { if (event.target === composer) closeComposer(); });
document.addEventListener('keydown', event => {
  if (composer.classList.contains('hidden')) return;
  if (event.key === 'Escape') { closeComposer(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...composer.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(element => !element.closest('.hidden') && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
let selectedMood = 'Светлое';
let photos = [];
let coverPhoto = '';
let editingMemoryId = null;
let memories = [];
const moodClasses = {'Тихое':'mood-quiet','Светлое':'mood-bright','Волнительное':'mood-restless','Тёплое':'mood-warm','Своё':'mood-own'};
const dayMotifs = [
  { id:'water', name:'Вода и дождь', words:/дожд|ливн|мокр|капл|река|море|океан|волна|вода|туман|снег|rain|sea|ocean|water/i },
  { id:'journey', name:'Дорога и движение', words:/дорог|путешеств|поезд|самол|машин|ехал|шла|шёл|гуля|маршрут|станци|город|улиц|окн[оа]|ветер|road|train|travel|city/i },
  { id:'nature', name:'Природа и воздух', words:/лес|дерев|лист|трава|цвет|гор[аы]|неб[оа]|солнц|сад|парк|птиц|природ|nature|forest|sky/i },
  { id:'light', name:'Свет и вечер', words:/ноч|вечер|рассвет|закат|звёзд|звезд|огн|свеч|фонар|свет|темнот|night|sunset|light/i },
  { id:'home', name:'Дом и близость', words:/дом|семь|мам|пап|друз|обня|вместе|чай|кофе|кухн|ед[аы]|уют|смеял|люб|home|friend/i }
];
function atmosphereFor(input = {}) {
  const text = `${input.title || ''} ${input.story || ''} ${input.song || ''} ${input.songArtist || ''} ${input.songGenre || ''} ${input.audio?.name || ''}`;
  const motif = dayMotifs.find(item => item.words.test(text));
  const moodNames = { 'Тихое':'Тихая пауза', 'Светлое':'Светлая пауза', 'Волнительное':'Движение внутри', 'Тёплое':'Тёплая близость', 'Своё':'Своя погода' };
  const music = input.songGenre || (input.audio ? 'Живой звук' : input.song ? 'Музыкальный след' : 'Тишина');
  const base = moodNames[input.mood] || 'Своя погода';
  const signature = motif ? `${base} · ${motif.name.toLocaleLowerCase('ru-RU')}` : base;
  const reasons = [];
  reasons.push(`Палитра: ${input.mood || 'Своё настроение'}.`);
  if (motif) reasons.push(`Мотив взят из слов: ${motif.name.toLocaleLowerCase('ru-RU')}.`);
  else if ((input.story || '').trim()) reasons.push('В тексте нет явного образа — композиция оставляет больше воздуха.');
  if (input.photos?.length) reasons.push(`Фото добавляет фактуру (${input.photos.length}).`);
  if (input.song || input.audio) reasons.push(`Музыка задаёт ритм: ${music}.`);
  return { motif: motif?.id || 'open', motifName: motif?.name || 'Свободное пространство', signature, reason: reasons.join(' '), musicTexture: music, photoTexture: input.photos?.length ? 'image' : 'grain' };
}
function applyAtmosphere(element, input) {
  if (!element) return;
  const atmosphere = atmosphereFor(input);
  element.dataset.motif = atmosphere.motif;
  element.dataset.music = (atmosphere.musicTexture || '').toLocaleLowerCase('ru-RU').includes('ambient') ? 'ambient' : input.song || input.audio ? 'rhythm' : 'silence';
  return atmosphere;
}
try { memories = JSON.parse(localStorage.getItem('tiho-memories') || '[]'); } catch { memories = []; }

function updatePreview() {
  const date = new Date();
  $('previewDate').textContent = `${new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(date)} · ${new Intl.DateTimeFormat('ru-RU',{weekday:'long'}).format(date)}`;
  const text = story.value.trim();
  const title = titleInput.value.trim();
  const sentence = text ? (text.split(/[.!?\n]/)[0].slice(0, 72) || text.slice(0, 72)) : 'Добавь несколько слов о дне';
  $('previewCaption').textContent = title || 'Новое воспоминание';
  $('previewDescription').textContent = sentence;
  $('previewMood').textContent = ({'Светлое':'☀ светлое настроение','Тихое':'☁ тихое настроение','Волнительное':'〰 волнительное настроение','Тёплое':'♡ тёплое настроение','Своё':'✳ твоё настроение'})[selectedMood] || '✳ твоё настроение';
  const song = songInput.value.trim();
  $('previewSong').textContent = song || 'Твоя песня появится здесь';
  const preview = $('previewImage');
  preview.classList.remove(...Object.values(moodClasses));
  preview.classList.add(moodClasses[selectedMood] || 'mood-own');
  const cover = coverPhoto || photos[0];
  preview.classList.toggle('has-photo', Boolean(cover));
  if (cover) preview.style.backgroundImage = `url("${cover}")`;
  else preview.style.backgroundImage = '';
  const atmosphere = applyAtmosphere(preview, { title, story:text, mood:selectedMood, song, songArtist:window.tihoSelectedTrack?.artist, songGenre:window.tihoSelectedTrack?.genre, audio:window.tihoMusic?.getPendingFile(), photos });
  $('visualSignature').textContent = atmosphere.signature;
  $('visualReason').textContent = atmosphere.reason;
  $('wordCount').textContent = `${story.value.length} / 500`;
}
story.addEventListener('input', updatePreview);
titleInput.addEventListener('input', updatePreview);
  songInput.addEventListener('input', updatePreview);
document.addEventListener('tiho-audio-selected', updatePreview);
document.querySelectorAll('.mood').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.mood.selected')?.classList.remove('selected'); button.classList.add('selected'); selectedMood = button.dataset.mood; updatePreview();
}));
document.querySelector('.mood[data-mood="Светлое"]').classList.add('selected');

photoInput.addEventListener('change', async () => {
  const files = [...photoInput.files].slice(0, 10 - photos.length);
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    photos.push(await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }));
  }
  if (!coverPhoto && photos[0]) coverPhoto = photos[0];
  renderPhotos(); updatePreview(); photoInput.value = '';
});
function renderPhotos() {
  $('photoPreviews').replaceChildren(...photos.map((src, i) => { const wrap = document.createElement('div'); wrap.className='photo-thumb-wrap'; const img = document.createElement('img'); img.src = src; img.className = `photo-thumb ${coverPhoto===src?'cover-choice':''}`; img.title = 'Нажми, чтобы выбрать фоном'; img.onclick = () => { coverPhoto=src; renderPhotos(); updatePreview(); }; const remove=document.createElement('button'); remove.type='button';remove.className='photo-remove';remove.textContent='×';remove.title='Убрать фото';remove.onclick=()=>{photos.splice(i,1);if(coverPhoto===src)coverPhoto=photos[0]||'';renderPhotos();updatePreview();};wrap.append(img,remove);return wrap; }));
}
function addSong() { songInput.focus(); updatePreview(); if (songInput.value.trim()) $('songTip').innerHTML = '<span>♫</span> Песня останется рядом<br>с этим воспоминанием.'; }
$('songAdd').addEventListener('click', addSong); songInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSong(); });

function saveMemories() { try { localStorage.setItem('tiho-memories', JSON.stringify(memories)); } catch { toast('Фото слишком большие для хранения в браузере'); } }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
$('createMemory').addEventListener('click', async () => {
  const text = story.value.trim();
  const title = titleInput.value.trim();
  const audioFile = window.tihoMusic?.getPendingFile();
  if (!title && !text && !photos.length && !songInput.value.trim() && !audioFile) { titleInput.focus(); toast('Добавь название, описание, фото или музыку.'); return; }
  const button = $('createMemory');
  button.disabled = true;
  try {
    const audio = audioFile ? await window.tihoMusic.saveAudio(audioFile) : null;
    const now = new Date();
    const selectedTrack = window.tihoSelectedTrack;
    const memory = { id: Date.now(), date: now.toISOString(), displayDate: new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(now), dayName: new Intl.DateTimeFormat('ru-RU',{weekday:'long'}).format(now), title: title || (text.split(/[.!?\n]/)[0].slice(0, 80) || 'Воспоминание дня'), story: text, mood: selectedMood, song: songInput.value.trim(), songLink: selectedTrack?.url || '', songArtist: selectedTrack?.artist || '', songGenre: selectedTrack?.genre || '', audio, photos: [...photos], background: coverPhoto || photos[0] || '' };
    Object.assign(memory, atmosphereFor(memory));
    memories.unshift(memory);
    saveMemories(); updateCounts();
    if (accountUser) await memorySync;
    toast('День сохранён в архиве ✨');
    story.value = ''; titleInput.value = ''; songInput.value = ''; photos = []; coverPhoto = '';
    document.querySelector('.mood.selected')?.classList.remove('selected');
    const defaultMoodButton = document.querySelectorAll('.mood')[1]; if (defaultMoodButton) { selectedMood = defaultMoodButton.dataset.mood; defaultMoodButton.classList.add('selected'); }
    renderPhotos(); updatePreview();
    $('songTip').textContent = 'Одной ноты иногда достаточно, чтобы вспомнить целый вечер.';
    window.tihoMusic?.clearSelection();
    document.dispatchEvent(new Event('tiho-audio-saved'));
    closeComposer();
  } catch (error) {
    toast(error.message || 'Не удалось сохранить музыку. Попробуй ещё раз.');
  } finally {
    button.disabled = false;
  }
});
function updateCircuitInfo() {
  const now = new Date();
  const monthCount = memories.filter(memory => {
    const date = new Date(memory.date);
    return !Number.isNaN(date.valueOf()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const latest = [...memories].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  $('circuitMemoryCount').textContent = memories.length;
  $('circuitMonthCount').innerHTML = `${monthCount} <small>записей</small>`;
  $('circuitLastDate').textContent = latest?.displayDate || 'Пока пусто';
  $('circuitLastMood').textContent = latest ? (latest.mood || 'Настроение не указано') : 'Здесь появится твой архив';
}
function updateCounts() { $('todayCount').textContent = memories.length; $('memoryCount').textContent = memories.length; updateCircuitInfo(); renderRecentMemories(); }
function renderRecentMemories(){const list=$('recentMemories');if(!list)return;list.replaceChildren(...memories.slice(0,4).map(memory=>{const b=document.createElement('button');b.className='recent-memory-link';b.textContent=`${memory.displayDate} · ${(memory.title || memory.story || 'Воспоминание').slice(0,22)}`;b.title=memory.story || memory.title;b.onclick=()=>{showArchive();openMemory(memory)};return b;}));}
function showToday() { $('todayView').classList.remove('hidden'); $('archiveView').classList.add('hidden'); $('crumb').textContent='Сегодня'; $('pageTitle').innerHTML='День, который<br><em>хочется оставить.</em>'; $('pageIntro').textContent='Не обязательно помнить всё. Достаточно сохранить то, что чувствовалось.'; $('navToday').classList.add('active'); $('navArchive').classList.remove('active'); }
function showArchive() { $('todayView').classList.add('hidden'); $('archiveView').classList.remove('hidden'); $('crumb').textContent='Архив воспоминаний'; $('pageTitle').innerHTML='Всё, что осталось<br><em>с тобой.</em>'; $('pageIntro').textContent='Каждый день — отдельная маленькая вселенная.'; $('navToday').classList.remove('active'); $('navArchive').classList.add('active'); renderArchive(); }
$('navToday').addEventListener('click', showToday); $('navArchive').addEventListener('click', showArchive); $('backToToday').addEventListener('click', showToday);
$('circuitOpenArchive').addEventListener('click', () => { showArchive(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => button.dataset.viewTarget === 'archive' ? showArchive() : showToday()));
$('headerHelp').addEventListener('click', openComposer);
$('footerAccount').addEventListener('click', openAccount);
const currentDate = new Date();
$('todayDate').textContent = `ТВОЙ ДЕНЬ · ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(currentDate).toLocaleUpperCase('ru-RU')}`;
$('footerYear').textContent = currentDate.getFullYear();
function renderArchive() {
  const grid = $('archiveGrid'); grid.replaceChildren();
  const query = ($('archiveSearch')?.value || '').trim().toLocaleLowerCase('ru-RU');
  const matches = memories.filter(memory => !query || [memory.title, memory.story, memory.song, memory.songArtist, memory.songGenre, memory.motifName, memory.signature, memory.mood, memory.displayDate].join(' ').toLocaleLowerCase('ru-RU').includes(query));
  $('archiveResultCount').textContent = query ? `${matches.length} из ${memories.length}` : '';
  $('emptyArchive').classList.toggle('hidden', matches.length > 0);
  if (!memories.length) { $('emptyArchive').querySelector('h3').textContent='Здесь будут жить твои дни'; $('emptyArchive').querySelector('p').textContent='Сохрани первое воспоминание — оно появится в своей папке.'; }
  else if (!matches.length) { $('emptyArchive').querySelector('h3').textContent='Такого дня пока не нашлось'; $('emptyArchive').querySelector('p').textContent='Попробуй другое слово: историю, песню, образ или дату.'; }
  matches.forEach(memory => {
    const card = document.createElement('article'); card.className='archive-card'; card.tabIndex=0;
    const cover = document.createElement('div'); cover.className=`archive-card-image ${moodClasses[memory.mood] || 'mood-own'}`; applyAtmosphere(cover, memory); if (memory.background || memory.photos?.[0]) cover.style.backgroundImage=`url("${memory.background || memory.photos[0]}")`;
    const loops = document.createElement('span'); loops.className='color-loops'; loops.setAttribute('aria-hidden','true');
    const title = document.createElement('span'); title.textContent = memory.title || memory.story?.split(/[.!?\n]/)[0].slice(0,46) || 'День, который остался'; cover.append(loops,title);
    const body = document.createElement('div'); body.className='archive-card-body';
    const date = document.createElement('div'); date.className='archive-card-date'; date.textContent=`${memory.displayDate} · ${memory.dayName}`;
    const desc = document.createElement('p'); desc.textContent=memory.story || 'Название, фото и музыка сохранили атмосферу этого дня.';
    const tags = document.createElement('div'); tags.className='archive-card-tags'; tags.innerHTML=`<span>♡ ${escapeHtml(memory.mood)}</span><span>✳ ${escapeHtml(memory.motifName || atmosphereFor(memory).motifName)}</span><span>${memory.song || memory.audio ? '♫ музыка' : '✳ воспоминание'}</span>`;
    body.append(date,desc,tags); card.append(cover,body); card.addEventListener('click',()=>openMemory(memory)); card.addEventListener('keydown',e=>{if(e.key==='Enter')openMemory(memory)}); grid.append(card);
  });
}
$('archiveSearch')?.addEventListener('input', renderArchive);
function escapeHtml(value='') { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function openMemory(m) {
  editingMemoryId=m.id;
  const hero = document.createElement('div'); hero.className=`modal-hero ${moodClasses[m.mood] || 'mood-own'}`; applyAtmosphere(hero, m); if (m.background || m.photos?.[0]) hero.style.backgroundImage=`url("${m.background || m.photos[0]}")`;
  const loops = document.createElement('span'); loops.className='color-loops'; loops.setAttribute('aria-hidden','true');
  const title = document.createElement('span'); title.className='masked-heading'; title.textContent=m.title || m.story?.split(/[.!?\n]/)[0].slice(0,58) || 'Этот день'; hero.append(loops,title);
  const changeBg=document.createElement('button');changeBg.type='button';changeBg.className='archive-background-button';changeBg.textContent='Сменить фон';changeBg.onclick=()=>$('backgroundInput').click();hero.append(changeBg);
  const date=document.createElement('div');date.className='modal-date';date.textContent=`${m.displayDate} · ${m.dayName}`;
  const h=document.createElement('h2');h.textContent=m.title || 'Так ощущался этот день';
  const text=document.createElement('div');text.className='modal-story';text.textContent=m.story;
  const meta=document.createElement('div');meta.className='modal-meta';meta.textContent=`♡ ${m.mood}${m.song ? '   ·   ♫ '+m.song : ''}`;
  const songLink = document.createElement('a'); songLink.className = 'saved-song-link'; songLink.textContent = 'Открыть песню в Apple Music ↗';
  songLink.href = m.songLink || '#'; songLink.target = '_blank'; songLink.rel = 'noopener noreferrer'; songLink.hidden = !m.songLink;
  const choices=document.createElement('div');choices.className='modal-photo-choices';
  (m.photos||[]).forEach(src=>{const img=document.createElement('img');img.src=src;img.className=`modal-photo-choice ${(m.background||m.photos?.[0])===src?'selected':''}`;img.title='Сделать фоном';img.onclick=()=>{m.background=src;saveMemories();renderArchive();openMemory(m)};choices.append(img)});
  $('modalBody').querySelectorAll('audio').forEach(player => { player.pause(); player.removeAttribute('src'); });
  if (activeModalAudioUrl) window.tihoMusic?.releaseAudioUrl(activeModalAudioUrl);
  activeModalAudioUrl = '';
  $('modalBody').replaceChildren(hero,date,h,...(m.story ? [text] : []),choices,meta,songLink);$('memoryModal').classList.remove('hidden');
  if (m.audio && window.tihoMusic) {
    const player = document.createElement('audio');
    player.className = 'saved-audio-player'; player.controls = true; player.preload = 'metadata';
    player.setAttribute('aria-label', `Воспроизвести ${m.audio.name || m.song || 'аудиофайл'}`);
    $('modalBody').append(player);
    try {
      const audioUrl = await window.tihoMusic.getAudioUrl(m.audio);
      if (!player.isConnected) { window.tihoMusic.releaseAudioUrl(audioUrl); return; }
      player.src = audioUrl;
      if (audioUrl.startsWith('blob:')) activeModalAudioUrl = audioUrl;
    } catch (error) {
      const note = document.createElement('p'); note.className = 'audio-unavailable'; note.textContent = error.message;
      player.replaceWith(note);
    }
  }
}
function stopModalAudio() {
  $('modalBody').querySelectorAll('audio').forEach(player => { player.pause(); player.removeAttribute('src'); });
  if (activeModalAudioUrl) window.tihoMusic?.releaseAudioUrl(activeModalAudioUrl);
  activeModalAudioUrl = '';
}
$('modalClose').addEventListener('click',()=>{$('memoryModal').classList.add('hidden');stopModalAudio();editingMemoryId=null});
$('memoryModal').addEventListener('click',e=>{if(e.target===$('memoryModal')){$('memoryModal').classList.add('hidden');stopModalAudio();editingMemoryId=null}});
$('backgroundInput').addEventListener('change',()=>{const file=$('backgroundInput').files?.[0];if(!file||!file.type.startsWith('image/'))return;const reader=new FileReader();reader.onload=()=>{if(editingMemoryId!==null){const memory=memories.find(item=>item.id===editingMemoryId);if(memory){memory.background=reader.result;saveMemories();renderArchive();openMemory(memory);toast('Фон воспоминания обновлён ✨');}}else{coverPhoto=reader.result;renderPhotos();updatePreview();toast('Фон дня обновлён ✨');}editingMemoryId=null;};reader.readAsDataURL(file);$('backgroundInput').value='';});
$('backgroundAdvice').addEventListener('click',()=>{const words=story.value.toLowerCase();let idea='Выбери снимок с одним главным объектом и свободным местом под текст — так фон поддержит воспоминание, а не перетянет внимание.';if(/море|вода|озер|река|пляж/.test(words))idea='Попробуй кадр воды крупным планом или линию горизонта. Мягкое отражение передаст ощущение дня и оставит место для текста.';else if(/дожд|окн|дом|уют|чай|кофе/.test(words))idea='Подойдёт фото света на окне, чашки или тихой детали дома. Лёгкая расфокусировка сделает фон похожим на память.';else if(/лес|парк|дерев|прогул|ветер/.test(words))idea='Ищи кадр с просветом между деревьями, движением листвы или дорожкой вдаль. Такой фон добавит глубину и сохранит настроение прогулки.';else if(selectedMood==='Тихое')idea='Для тихого настроения попробуй пустое пространство, мягкую тень или размытый свет. Спокойный фон усилит ощущение паузы.';else if(selectedMood==='Волнительное')idea='Выбери кадр с движением — огни, смазанный шаг или ветер в волосах. Один резкий цветовой акцент передаст волнение.';else if(selectedMood==='Тёплое')idea='Подойдёт близкий кадр рук, еды, ткани или закатного света. Тёплая деталь вернёт не только картинку, но и телесное ощущение дня.';$('backgroundHint').textContent=idea;});
$('newCollection').addEventListener('click',()=>toast('Коллекции скоро можно будет создавать здесь'));
$('weatherEdit').addEventListener('click',()=>{const value=prompt('Какая сегодня погода внутри? Например: дождь и спокойствие');if(value)$('weatherEdit').title=value;});
$('createMemory').setAttribute('aria-label','Сохранить воспоминание в архив');
let accountUser = null;
let accountApiAvailable = null;
let activeModalAudioUrl = '';
let memorySync = Promise.resolve();
let authMode = 'login';
function setAccountUser(user) {
  accountUser = user;
  window.tihoAccountUser = user;
  const button = $('accountButton');
  button.textContent = user ? user.name : 'Войти';
  button.title = user ? user.email : 'Войти или создать аккаунт';
  const sidebarName = document.querySelector('.sidebar-bottom b');
  const sidebarInfo = document.querySelector('.sidebar-bottom small');
  if (sidebarName) sidebarName.textContent = user?.name || 'Гость';
  if (sidebarInfo) sidebarInfo.textContent = user?.email || 'Личное пространство';
  const avatar = document.querySelector('.sidebar-bottom .avatar');
  if (avatar) avatar.textContent = user?.name?.trim().charAt(0).toUpperCase() || '·';
}
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-mode]').forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
  $('nameField').classList.toggle('hidden', mode !== 'register');
  $('accountPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('accountName').required = mode === 'register';
  $('accountSubmit').innerHTML = mode === 'register' ? 'Создать аккаунт <span>↗</span>' : 'Войти <span>↗</span>';
  $('accountTitle').textContent = mode === 'register' ? 'Создай своё пространство' : 'Твои воспоминания всегда рядом';
  $('accountError').textContent = '';
}
function openAccount() {
  $('accountError').textContent = '';
  const serverUnavailable = accountApiAvailable === false;
  $('accountStaticNotice').classList.toggle('hidden', accountApiAvailable !== false);
  document.querySelector('.account-copy').classList.toggle('hidden', serverUnavailable);
  $('accountForm').classList.toggle('hidden', serverUnavailable || Boolean(accountUser));
  document.querySelector('.account-tabs').classList.toggle('hidden', serverUnavailable || Boolean(accountUser));
  $('accountLogout').classList.toggle('hidden', !accountUser);
  $('accountTitle').textContent = accountUser ? `Привет, ${accountUser.name}` : 'Твои воспоминания всегда рядом';
  $('accountModal').classList.remove('hidden');
}
document.querySelectorAll('[data-auth-mode]').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode)));
$('accountButton').addEventListener('click', openAccount);
$('accountClose').addEventListener('click', () => $('accountModal').classList.add('hidden'));
$('accountModal').addEventListener('click', event => { if (event.target === $('accountModal')) $('accountModal').classList.add('hidden'); });
$('accountForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('accountSubmit').disabled = true;
  $('accountError').textContent = '';
  try {
    const localMemories = [...memories];
    const response = await fetch(authMode === 'register' ? '/api/register' : '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: $('accountName').value.trim(), email: $('accountEmail').value.trim(), password: $('accountPassword').value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось войти.');
    setAccountUser(result.user);
    if (authMode === 'register') {
      memories = [...(result.memories || []), ...localMemories];
    } else {
      memories = result.memories || [];
    }
    for (const memory of memories) {
      if (memory.audio?.storage === 'browser') memory.audio = await window.tihoMusic?.promoteAudioToAccount(memory.audio) || memory.audio;
    }
    const archiveResponse = await fetch('/api/memories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memories }) });
    if (!archiveResponse.ok) throw new Error('Не удалось синхронизировать воспоминания и музыку.');
    toast(authMode === 'register' ? 'Аккаунт создан, воспоминания сохранены' : 'Вы вошли в аккаунт');
    localStorage.setItem('tiho-memories', JSON.stringify(memories));
    updateCounts(); renderArchive(); $('accountModal').classList.add('hidden');
  } catch (error) {
    $('accountError').textContent = location.hostname.endsWith('github.io')
      ? 'Вход через аккаунт требует серверной версии сайта. Воспоминания на GitHub Pages сохраняются в этом браузере.'
      : error.message || 'Проверь соединение и попробуй ещё раз.';
  } finally {
    $('accountSubmit').disabled = false;
  }
});
$('accountLogout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  setAccountUser(null); memories = [];
  localStorage.setItem('tiho-memories', '[]');
  updateCounts(); renderArchive(); $('accountModal').classList.add('hidden');
  toast('Вы вышли из аккаунта');
});
fetch('/api/me').then(response => { if (!response.ok) throw new Error('API unavailable'); return response.json(); }).then(result => {
  accountApiAvailable = true;
  if (!result.user) return;
  setAccountUser(result.user); memories = result.memories || [];
  localStorage.setItem('tiho-memories', JSON.stringify(memories)); updateCounts(); renderArchive();
}).catch(() => { accountApiAvailable = false; });
function saveMemories() {
  try { localStorage.setItem('tiho-memories', JSON.stringify(memories)); }
  catch { toast('Фото слишком большие для хранения в браузере'); }
  if (accountUser) {
    const snapshot = JSON.stringify(memories);
    memorySync = memorySync.then(() => fetch('/api/memories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memories: JSON.parse(snapshot) }) }))
      .then(response => { if (!response.ok) throw new Error('sync'); })
      .catch(() => toast('Не удалось синхронизировать архив. Проверь соединение.'));
  }
}
updateCounts(); updatePreview();

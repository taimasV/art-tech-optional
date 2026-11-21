const $ = (id) => document.getElementById(id);
const story = $('story'), songInput = $('songInput'), photoInput = $('photoInput');
let selectedMood = 'Светлое';
let photos = [];
let memories = [];
try { memories = JSON.parse(localStorage.getItem('tiho-memories') || '[]'); } catch { memories = []; }

function updatePreview() {
  const text = story.value.trim();
  const sentence = text ? (text.split(/[.!?\n]/)[0].slice(0, 58) || text.slice(0, 58)) : 'Иногда лучший план —\nникуда не торопиться.';
  $('previewCaption').textContent = sentence;
  $('previewMood').textContent = ({'Светлое':'☀ светлое настроение','Тихое':'☁ тихое настроение','Волнительное':'〰 волнительное настроение','Тёплое':'♡ тёплое настроение','Своё':'✳ твоё настроение'})[selectedMood] || '✳ твоё настроение';
  const song = songInput.value.trim();
  $('previewSong').textContent = song || 'Твоя песня появится здесь';
  if (photos[0]) $('previewImage').style.backgroundImage = `url("${photos[0]}")`;
  else $('previewImage').style.backgroundImage = '';
  $('wordCount').textContent = `${story.value.length} / 500`;
}
story.addEventListener('input', updatePreview);
songInput.addEventListener('input', updatePreview);
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
  renderPhotos(); updatePreview(); photoInput.value = '';
});
function renderPhotos() {
  $('photoPreviews').replaceChildren(...photos.map((src, i) => { const img = document.createElement('img'); img.src = src; img.className = 'photo-thumb'; img.title = 'Нажми, чтобы убрать'; img.onclick = () => { photos.splice(i, 1); renderPhotos(); updatePreview(); }; return img; }));
}
function addSong() { songInput.focus(); updatePreview(); if (songInput.value.trim()) $('songTip').innerHTML = '<span>♫</span> Песня останется рядом<br>с этим воспоминанием.'; }
$('songAdd').addEventListener('click', addSong); songInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSong(); });

function saveMemories() { try { localStorage.setItem('tiho-memories', JSON.stringify(memories)); } catch { toast('Фото слишком большие для хранения в браузере'); } }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
$('createMemory').addEventListener('click', () => {
  const text = story.value.trim();
  if (!text && !photos.length && !songInput.value.trim()) { story.focus(); toast('Добавь пару слов, фото или песню'); return; }
  const now = new Date();
  memories.unshift({ id: Date.now(), date: now.toISOString(), displayDate: new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(now), dayName: new Intl.DateTimeFormat('ru-RU',{weekday:'long'}).format(now), story: text || 'Этот день остался в фотографиях и музыке.', mood: selectedMood, song: songInput.value.trim(), photos: [...photos] });
  saveMemories(); updateCounts(); toast('День сохранён в архиве ✨');
  story.value = ''; songInput.value = ''; photos = []; selectedMood = 'Светлое'; document.querySelector('.mood.selected')?.classList.remove('selected'); document.querySelector('[data-mood="Светлое"]').classList.add('selected'); renderPhotos(); updatePreview(); $('songTip').innerHTML = '<span>♪</span> Одной ноты иногда достаточно,<br>чтобы вспомнить целый вечер.';
});
function updateCounts() { $('todayCount').textContent = memories.length; $('memoryCount').textContent = memories.length; }
function showToday() { $('todayView').classList.remove('hidden'); $('archiveView').classList.add('hidden'); $('crumb').textContent='Сегодня'; $('pageTitle').innerHTML='День, который<br><em>хочется оставить.</em>'; $('pageIntro').textContent='Не обязательно помнить всё. Достаточно сохранить то, что чувствовалось.'; $('navToday').classList.add('active'); $('navArchive').classList.remove('active'); }
function showArchive() { $('todayView').classList.add('hidden'); $('archiveView').classList.remove('hidden'); $('crumb').textContent='Архив воспоминаний'; $('pageTitle').innerHTML='Всё, что осталось<br><em>с тобой.</em>'; $('pageIntro').textContent='Каждый день — отдельная маленькая вселенная.'; $('navToday').classList.remove('active'); $('navArchive').classList.add('active'); renderArchive(); }
$('navToday').addEventListener('click', showToday); $('navArchive').addEventListener('click', showArchive); $('backToToday').addEventListener('click', showToday);
function renderArchive() {
  const grid = $('archiveGrid'); grid.replaceChildren(); $('emptyArchive').classList.toggle('hidden', memories.length > 0);
  memories.forEach(memory => {
    const card = document.createElement('article'); card.className='archive-card'; card.tabIndex=0;
    const cover = document.createElement('div'); cover.className='archive-card-image'; if (memory.photos?.[0]) cover.style.backgroundImage=`url("${memory.photos[0]}")`;
    const title = document.createElement('span'); title.textContent = memory.story.split(/[.!?\n]/)[0].slice(0,46) || 'День, который остался'; cover.append(title);
    const body = document.createElement('div'); body.className='archive-card-body';
    const date = document.createElement('div'); date.className='archive-card-date'; date.textContent=`${memory.displayDate} · ${memory.dayName}`;
    const desc = document.createElement('p'); desc.textContent=memory.story;
    const tags = document.createElement('div'); tags.className='archive-card-tags'; tags.innerHTML=`<span>♡ ${escapeHtml(memory.mood)}</span><span>${memory.song ? '♫ музыка' : '✳ воспоминание'}</span>`;
    body.append(date,desc,tags); card.append(cover,body); card.addEventListener('click',()=>openMemory(memory)); card.addEventListener('keydown',e=>{if(e.key==='Enter')openMemory(memory)}); grid.append(card);
  });
}
function escapeHtml(value='') { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function openMemory(m) {
  const hero = document.createElement('div'); hero.className='modal-hero'; if (m.photos?.[0]) hero.style.backgroundImage=`url("${m.photos[0]}")`;
  const title = document.createElement('span'); title.textContent=m.story.split(/[.!?\n]/)[0].slice(0,58) || 'Этот день'; hero.append(title);
  const date=document.createElement('div');date.className='modal-date';date.textContent=`${m.displayDate} · ${m.dayName}`;
  const h=document.createElement('h2');h.textContent='Так ощущался этот день';
  const text=document.createElement('div');text.className='modal-story';text.textContent=m.story;
  const meta=document.createElement('div');meta.className='modal-meta';meta.textContent=`♡ ${m.mood}${m.song ? '   ·   ♫ '+m.song : ''}`;
  $('modalBody').replaceChildren(hero,date,h,text,meta);$('memoryModal').classList.remove('hidden');
}
$('modalClose').addEventListener('click',()=>$('memoryModal').classList.add('hidden'));
$('memoryModal').addEventListener('click',e=>{if(e.target===$('memoryModal'))$('memoryModal').classList.add('hidden')});
$('newCollection').addEventListener('click',()=>toast('Коллекции скоро можно будет создавать здесь'));
$('weatherEdit').addEventListener('click',()=>{const value=prompt('Какая сегодня погода внутри? Например: дождь и спокойствие');if(value)$('weatherEdit').title=value;});
$('createMemory').setAttribute('aria-label','Сохранить воспоминание в архив');
updateCounts(); updatePreview();

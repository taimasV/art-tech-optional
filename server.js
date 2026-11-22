const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const databasePath = path.join(root, 'data', 'accounts.json');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function readDatabase() {
  try { return JSON.parse(fs.readFileSync(databasePath, 'utf8')); }
  catch { return { users: [] }; }
}
function writeDatabase(database) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const tempPath = `${databasePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(database), { mode: 0o600 });
  fs.renameSync(tempPath, databasePath);
}
function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 100 * 1024 * 1024) { reject(Object.assign(new Error('Слишком большой запрос'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Некорректные данные'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function sessionUser(req, database) {
  const token = /(?:^|; )tiho_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return database.users.find(user => user.sessions?.some(session => session.hash === tokenHash && session.expiresAt > Date.now()));
}
function makeSession(user, res, database) {
  const token = crypto.randomBytes(32).toString('hex');
  user.sessions ||= [];
  user.sessions = user.sessions.filter(session => session.expiresAt > Date.now());
  user.sessions.push({ hash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  writeDatabase(database);
  res.setHeader('Set-Cookie', `tiho_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
}

async function handleApi(req, res, pathname) {
  const database = readDatabase();
  try {
    if (req.method === 'GET' && pathname === '/api/music/search') {
      const term = new URL(req.url, 'http://localhost').searchParams.get('term')?.trim() || '';
      if (term.length < 2 || term.length > 120) return sendJson(res, 400, { error: 'Введите название песни или исполнителя.' });
      const searchUrl = new URL('https://itunes.apple.com/search');
      searchUrl.searchParams.set('term', term);
      searchUrl.searchParams.set('media', 'music');
      searchUrl.searchParams.set('entity', 'song');
      searchUrl.searchParams.set('country', 'ru');
      searchUrl.searchParams.set('limit', '12');
      const response = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) return sendJson(res, 502, { error: 'Музыкальный каталог сейчас не отвечает.' });
      const catalog = await response.json();
      const tracks = (catalog.results || []).map(track => ({
        id: track.trackId,
        title: track.trackName,
        artist: track.artistName || 'Неизвестный исполнитель',
        album: track.collectionName || '',
        artwork: track.artworkUrl100 || '',
        url: track.trackViewUrl || '',
        genre: track.primaryGenreName || '',
      }));
      return sendJson(res, 200, { tracks });
    }
    if (req.method === 'POST' && pathname === '/api/audio') {
      const user = sessionUser(req, database);
      if (!user) return sendJson(res, 401, { error: 'Войди в аккаунт, чтобы сохранить аудиофайл вместе с воспоминанием.' });
      const { data, name, type } = await readJson(req);
      const match = typeof data === 'string' && /^data:(audio\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(data);
      if (!match || match[2].length > 28 * 1024 * 1024) return sendJson(res, 400, { error: 'Не удалось прочитать аудиофайл или он слишком большой (лимит 20 МБ).' });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) return sendJson(res, 413, { error: 'Размер аудиофайла должен быть не больше 20 МБ.' });
      const mimeType = match[1].toLowerCase();
      const id = crypto.randomUUID();
      const displayName = String(name || 'Аудиофайл').replace(/[\\/\0-\x1f]/g, '').slice(0, 160) || 'Аудиофайл';
      const directory = path.join(root, 'data', 'audio', user.id);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, id), bytes, { mode: 0o600 });
      user.audioFiles ||= [];
      user.audioFiles.push({ id, name: displayName, mimeType, createdAt: Date.now() });
      writeDatabase(database);
      return sendJson(res, 201, { audio: { id, name: displayName, mimeType, url: `/api/audio/${id}` } });
    }
    const audioMatch = req.method === 'GET' && /^\/api\/audio\/([0-9a-f-]{36})$/i.exec(pathname);
    if (audioMatch) {
      const user = sessionUser(req, database);
      const audioFile = user?.audioFiles?.find(file => file.id === audioMatch[1]);
      if (!user || !audioFile) return sendJson(res, 404, { error: 'Аудиофайл не найден.' });
      const audioPath = path.join(root, 'data', 'audio', user.id, audioFile.id);
      let stat;
      try { stat = fs.statSync(audioPath); } catch { return sendJson(res, 404, { error: 'Аудиофайл не найден.' }); }
      const baseHeaders = { 'Content-Type': audioFile.mimeType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        let start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2] || 0));
        let end = range[2] && range[1] ? Number(range[2]) : stat.size - 1;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= stat.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
          return;
        }
        end = Math.min(end, stat.size - 1);
        res.writeHead(206, { ...baseHeaders, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
        fs.createReadStream(audioPath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
      fs.createReadStream(audioPath).pipe(res);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/register') {
      const { name, email, password } = await readJson(req);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!String(name || '').trim() || String(name).trim().length > 60) return sendJson(res, 400, { error: 'Укажите имя длиной до 60 символов.' });
      if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) return sendJson(res, 400, { error: 'Введите корректную почту.' });
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) return sendJson(res, 400, { error: 'Пароль должен содержать не менее 8 символов.' });
      if (database.users.some(user => user.email === normalizedEmail)) return sendJson(res, 409, { error: 'Аккаунт с такой почтой уже существует.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
      const user = { id: crypto.randomUUID(), name: String(name).trim(), email: normalizedEmail, salt, passwordHash, memories: [] };
      database.users.push(user); makeSession(user, res, database);
      return sendJson(res, 201, { user: { name: user.name, email: user.email }, memories: user.memories });
    }
    if (req.method === 'POST' && pathname === '/api/login') {
      const { email, password } = await readJson(req);
      const user = database.users.find(item => item.email === String(email || '').trim().toLowerCase());
      if (!user || typeof password !== 'string') return sendJson(res, 401, { error: 'Неверная почта или пароль.' });
      const candidate = crypto.scryptSync(password, user.salt, 64);
      const stored = Buffer.from(user.passwordHash, 'hex');
      if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) return sendJson(res, 401, { error: 'Неверная почта или пароль.' });
      makeSession(user, res, database);
      return sendJson(res, 200, { user: { name: user.name, email: user.email }, memories: user.memories || [] });
    }
    if (req.method === 'GET' && pathname === '/api/me') {
      const user = sessionUser(req, database);
      return sendJson(res, 200, { user: user ? { name: user.name, email: user.email } : null, memories: user?.memories || [] });
    }
    if (req.method === 'POST' && pathname === '/api/logout') {
      const user = sessionUser(req, database);
      const token = /(?:^|; )tiho_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (user && token) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        user.sessions = user.sessions.filter(session => session.hash !== hash);
        writeDatabase(database);
      }
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'tiho_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }
    if (req.method === 'PUT' && pathname === '/api/memories') {
      const user = sessionUser(req, database);
      if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт, чтобы сохранить данные.' });
      const { memories } = await readJson(req);
      if (!Array.isArray(memories) || memories.length > 5000) return sendJson(res, 400, { error: 'Некорректный архив воспоминаний.' });
      user.memories = memories; writeDatabase(database);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: 'Не найдено.' });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : 'Ошибка сервера.' });
  }
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname);
    return;
  }

  const requested = pathname === '/' ? '/art.html' : pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root + path.sep) || file === root) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (error, content) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Local site: http://localhost:${port}/`);
});

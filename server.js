const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

// ========== قاعدة بيانات في الذاكرة ==========
const db = {
  users: [],
  posts: [],
  messages: [],
  quizzes: []
};

// ========== دوال مساعدة ==========
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 4); }
function findUser(id) { return db.users.find(u => u.id === id); }
function findUserByEmail(email) { return db.users.find(u => u.email === email); }

// ========== Middleware ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ========== المصادقة ==========
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    const decoded = jwt.verify(token, 'my_secret_key');
    const user = findUser(decoded.id);
    if (!user || !user.isActive) throw new Error();
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// ========== API ==========

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (findUserByEmail(email)) return res.status(400).json({ error: 'Email already used' });
    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: 'u' + genId(),
      username,
      email,
      password: hashed,
      avatar: '',
      bio: '',
      verified: false,
      role: 'user',
      isActive: true,
      createdAt: Date.now()
    };
    db.users.push(user);
    const token = jwt.sign({ id: user.id, role: user.role }, 'my_secret_key');
    res.status(201).json({ token, user: { id: user.id, username, email, role: user.role } });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, 'my_secret_key');
    res.json({ token, user: { id: user.id, username: user.username, email, role: user.role } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Users ---
app.get('/api/users/me', auth, (req, res) => res.json(req.user));
app.put('/api/users/me', auth, (req, res) => {
  const { username, bio } = req.body;
  if (username) req.user.username = username;
  if (bio !== undefined) req.user.bio = bio;
  res.json(req.user);
});
app.post('/api/users/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  req.user.avatar = '/uploads/' + req.file.filename;
  res.json({ avatar: req.user.avatar });
});

// --- Posts ---
app.get('/api/posts/feed', auth, (req, res) => {
  const posts = db.posts.sort((a, b) => b.createdAt - a.createdAt);
  const enriched = posts.map(p => {
    const user = findUser(p.userId);
    return { ...p, user: user ? { username: user.username, avatar: user.avatar } : null };
  });
  res.json(enriched);
});

app.post('/api/posts', auth, upload.single('image'), (req, res) => {
  const imageUrl = req.file ? '/uploads/' + req.file.filename : '';
  const post = {
    id: 'p' + genId(),
    userId: req.user.id,
    text: req.body.text || '',
    image: imageUrl,
    likes: [],
    comments: [],
    createdAt: Date.now()
  };
  db.posts.push(post);
  io.emit('newPost', post);
  res.status(201).json(post);
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const idx = post.likes.indexOf(req.user.id);
  if (idx === -1) post.likes.push(req.user.id);
  else post.likes.splice(idx, 1);
  res.json({ likes: post.likes.length });
});

app.post('/api/posts/:id/comment', auth, (req, res) => {
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.comments.push({ userId: req.user.id, text: req.body.text, createdAt: Date.now() });
  res.json({ comments: post.comments });
});

// --- Quiz ---
app.post('/api/quiz/submit', auth, (req, res) => {
  const { answers } = req.body;
  if (!answers || answers.length !== 5) return res.status(400).json({ error: 'Answer all 5' });
  db.quizzes = db.quizzes.filter(q => q.userId !== req.user.id);
  db.quizzes.push({ userId: req.user.id, answers });
  const results = db.quizzes.filter(q => q.userId !== req.user.id).map(q => {
    const user = findUser(q.userId);
    if (!user) return null;
    let score = 0;
    for (let i = 0; i < 5; i++) if (Math.abs(answers[i] - q.answers[i]) <= 1) score++;
    return { userId: q.userId, username: user.username, compatibility: Math.round((score / 5) * 100) };
  }).filter(Boolean).sort((a, b) => b.compatibility - a.compatibility);
  res.json({ results });
});

// --- Chat ---
app.get('/api/chat/users', auth, (req, res) => {
  const ids = new Set();
  db.messages.filter(m => m.senderId === req.user.id || m.receiverId === req.user.id)
    .forEach(m => ids.add(m.senderId === req.user.id ? m.receiverId : m.senderId));
  const users = db.users.filter(u => ids.has(u.id) && u.id !== req.user.id);
  res.json(users.map(u => ({ _id: u.id, username: u.username, avatar: u.avatar })));
});

app.get('/api/chat/messages/:userId', auth, (req, res) => {
  const msgs = db.messages.filter(m =>
    (m.senderId === req.user.id && m.receiverId === req.params.userId) ||
    (m.senderId === req.params.userId && m.receiverId === req.user.id)
  ).sort((a, b) => a.createdAt - b.createdAt);
  const enriched = msgs.map(m => {
    const sender = findUser(m.senderId);
    return { ...m, senderId: sender ? { _id: sender.id, username: sender.username } : null };
  });
  res.json(enriched);
});

// --- Admin ---
app.get('/api/admin/stats', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const totalLikes = db.posts.reduce((acc, p) => acc + p.likes.length, 0);
  res.json({ totalUsers: db.users.length, totalPosts: db.posts.length, totalLikes });
});
app.get('/api/admin/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(db.users.map(u => ({ ...u, password: undefined })));
});
app.put('/api/admin/users/:id/toggle', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.isActive = !user.isActive;
  res.json({ isActive: user.isActive });
});
app.delete('/api/admin/users/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.users = db.users.filter(u => u.id !== req.params.id);
  res.json({ message: 'Deleted' });
});
app.put('/api/admin/users/:id/verify', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.verified = true;
  res.json({ verified: true });
});
app.delete('/api/admin/posts/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.posts = db.posts.filter(p => p.id !== req.params.id);
  res.json({ message: 'Deleted' });
});
app.get('/api/admin/messages', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(db.messages);
});

// ========== Socket.io ==========
io.on('connection', (socket) => {
  socket.on('join', (userId) => socket.join(userId));
  socket.on('sendMessage', ({ senderId, receiverId, text }) => {
    const msg = { id: 'm' + genId(), senderId, receiverId, text, createdAt: Date.now() };
    db.messages.push(msg);
    const sender = findUser(senderId);
    const enriched = { ...msg, senderId: sender ? { _id: sender.id, username: sender.username } : null };
    io.to(receiverId).emit('receiveMessage', enriched);
    io.to(senderId).emit('receiveMessage', enriched);
  });
});

// ========== الواجهة الأمامية (SPA متكاملة) ==========
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>FaceLove</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',sans-serif}
body{background:#f0f2f5;color:#1a1a2e;padding-bottom:70px}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:linear-gradient(135deg,#ff6b81,#ff4757);border-radius:10px}
.navbar{position:fixed;top:0;left:0;width:100%;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);padding:10px 20px;display:flex;justify-content:space-between;align-items:center;z-index:100;border-bottom:1px solid rgba(0,0,0,0.03)}
.logo{font-weight:800;font-size:1.3rem;background:linear-gradient(135deg,#ff6b81,#ff4757);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo i{-webkit-text-fill-color:#ff4757}
.nav-icons a{margin-left:12px;font-size:1.2rem;color:#888;text-decoration:none;padding:6px 8px;border-radius:10px;transition:0.2s}
.nav-icons a:hover,.nav-icons a.active{color:#ff4757;background:#fff0f2}
.main{padding-top:70px;max-width:700px;margin:auto;padding-left:16px;padding-right:16px}
.page{display:none;animation:fade .3s}
.page.active{display:block}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{background:#fff;border-radius:20px;padding:18px;margin-bottom:14px;box-shadow:0 4px 15px rgba(0,0,0,0.02);border:1px solid #f0f0f0}
.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#ff6b81,#ff4757);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0}
.post-header{display:flex;gap:12px;margin-bottom:8px;align-items:center}
.post-header .info{flex:1}
.post-header .info .name{font-weight:600}
.post-header .info .time{font-size:0.75rem;color:#999}
.post-image{width:100%;border-radius:14px;margin:8px 0;max-height:350px;object-fit:cover}
.post-actions{display:flex;gap:20px;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0}
.post-actions span{display:flex;align-items:center;gap:4px;color:#888;font-size:0.9rem;cursor:pointer}
.post-actions span:hover{color:#ff4757}
.post-actions .liked{color:#ff4757}
.chat-item{display:flex;align-items:center;gap:12px;padding:10px;background:#fafafa;border-radius:14px;margin-bottom:6px;cursor:pointer;border:1px solid transparent}
.chat-item:hover{border-color:#ff6b81}
.chat-window{background:#fff;border-radius:20px;padding:16px;height:70vh;display:flex;flex-direction:column}
.chat-msgs{flex:1;overflow-y:auto;padding:4px 0}
.msg{margin:4px 0;padding:8px 14px;border-radius:16px;max-width:80%;background:#f0f2f5;align-self:flex-start}
.msg.sent{background:#ff4757;color:#fff;align-self:flex-end}
.chat-input{display:flex;gap:8px;margin-top:8px}
.chat-input input{flex:1;padding:10px 14px;border-radius:30px;border:1px solid #eee;outline:none}
.chat-input button{background:#ff4757;color:#fff;border:none;border-radius:50%;width:44px;cursor:pointer}
.auth-form{max-width:380px;margin:auto;background:#fff;padding:28px;border-radius:24px;box-shadow:0 8px 30px rgba(0,0,0,0.02)}
.auth-form input{width:100%;padding:10px 14px;margin:6px 0;border:1px solid #eee;border-radius:30px;outline:none}
.auth-form input:focus{border-color:#ff4757}
.auth-form button{width:100%;padding:10px;background:#ff4757;color:#fff;border:none;border-radius:30px;font-weight:700;cursor:pointer}
.auth-form .toggle{text-align:center;margin-top:10px;color:#888;font-size:0.9rem;cursor:pointer}
.modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:200}
.modal.active{display:flex}
.modal-content{background:#fff;padding:24px;border-radius:24px;max-width:400px;width:90%}
.quiz-question{margin-bottom:12px}
.quiz-question label{display:inline-block;margin-right:12px}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.stat-box{background:#fafafa;padding:12px;border-radius:14px;text-align:center}
.stat-box h4{font-size:1.5rem;color:#ff4757}
.user-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0}
.user-row .actions button{margin-left:4px;padding:2px 10px;border:none;border-radius:20px;font-size:0.7rem;cursor:pointer}
.btn-verify{background:#2ed573;color:#fff}
.btn-block{background:#ff6b6b;color:#fff}
.btn-del{background:#ff4757;color:#fff}
@media(max-width:600px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>

<!-- Auth -->
<div id="auth" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px">
<div class="auth-form" id="login-form">
<h2 style="text-align:center;color:#ff4757"><i class="fas fa-heart"></i> FaceLove</h2>
<h4 style="text-align:center;margin-bottom:16px">تسجيل الدخول</h4>
<input type="email" id="login-email" placeholder="البريد الإلكتروني">
<input type="password" id="login-pass" placeholder="كلمة المرور">
<button onclick="handleLogin()">دخول</button>
<div class="toggle" onclick="toggleAuth()">ليس لديك حساب؟ سجل الآن</div>
</div>
<div class="auth-form" id="register-form" style="display:none">
<h2 style="text-align:center;color:#ff4757"><i class="fas fa-heart"></i> FaceLove</h2>
<h4 style="text-align:center;margin-bottom:16px">إنشاء حساب</h4>
<input type="text" id="reg-username" placeholder="اسم المستخدم">
<input type="email" id="reg-email" placeholder="البريد الإلكتروني">
<input type="password" id="reg-pass" placeholder="كلمة المرور">
<button onclick="handleRegister()">تسجيل</button>
<div class="toggle" onclick="toggleAuth()">لديك حساب؟ سجل دخول</div>
</div>
</div>

<!-- App -->
<div id="app" style="display:none">
<nav class="navbar">
<div class="logo"><i class="fas fa-heart"></i> FaceLove</div>
<div class="nav-icons">
<a href="#" id="nav-feed" class="active" onclick="navigate('feed')"><i class="fas fa-home"></i></a>
<a href="#" id="nav-chat" onclick="navigate('chat')"><i class="fas fa-comment-dots"></i></a>
<a href="#" id="nav-profile" onclick="navigate('profile')"><i class="fas fa-user"></i></a>
<a href="#" id="nav-admin" style="display:none" onclick="navigate('admin')"><i class="fas fa-crown"></i></a>
<a href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i></a>
</div>
</nav>

<div class="main">
<!-- Feed -->
<section id="page-feed" class="page active">
<div class="card">
<textarea id="post-text" placeholder="شارك ما يخطر ببالك..." rows="2" style="width:100%;padding:10px;border-radius:14px;border:1px solid #eee;resize:vertical"></textarea>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px">
<div><input type="file" id="post-image" accept="image/*" style="display:none" onchange="document.getElementById('img-name').textContent=this.files[0]?.name"><label for="post-image" style="cursor:pointer;color:#ff4757"><i class="fas fa-image"></i> إضافة صورة</label><span id="img-name" style="color:#999;font-size:0.8rem;margin-left:6px"></span></div>
<button onclick="createPost()" style="background:#ff4757;color:#fff;border:none;padding:8px 22px;border-radius:30px;font-weight:700;cursor:pointer">نشر</button>
</div>
</div>
<div id="feed-container"></div>
</section>

<!-- Chat -->
<section id="page-chat" class="page">
<div id="chat-list"></div>
<div id="chat-window" style="display:none" class="chat-window">
<div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #eee"><span id="chat-user-name" style="font-weight:700"></span><span onclick="closeChat()" style="cursor:pointer;color:#888"><i class="fas fa-times"></i></span></div>
<div id="chat-messages" class="chat-msgs"></div>
<div class="chat-input"><input type="text" id="chat-text" placeholder="اكتب رسالة..."><button onclick="sendMsg()"><i class="fas fa-paper-plane"></i></button></div>
</div>
</section>

<!-- Profile -->
<section id="page-profile" class="page">
<div class="card">
<div style="text-align:center">
<div id="profile-avatar" class="avatar" style="width:80px;height:80px;font-size:2rem;margin:auto;background:linear-gradient(135deg,#ff6b81,#ff4757);color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%"></div>
<input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
<button onclick="document.getElementById('avatar-input').click()" style="background:none;border:none;color:#ff4757;cursor:pointer;margin-top:4px"><i class="fas fa-camera"></i> تغيير الصورة</button>
<h2 id="profile-username" style="margin:6px 0 2px"></h2>
<p id="profile-bio" style="color:#888;font-size:0.9rem"></p>
<div style="margin:8px 0"><span id="profile-verified" style="color:#2ed573;display:none"><i class="fas fa-check-circle"></i> موثق</span></div>
<button onclick="editProfile()" style="background:#ff4757;color:#fff;border:none;padding:6px 24px;border-radius:30px;cursor:pointer">تعديل الملف</button>
</div>
</div>
<div id="profile-posts"></div>
</section>

<!-- Admin -->
<section id="page-admin" class="page">
<div class="card"><div class="stat-grid" id="admin-stats"></div></div>
<div class="card"><h3 style="margin-bottom:8px">👥 المستخدمين</h3><div id="admin-users"></div></div>
<div class="card"><h3 style="margin-bottom:8px">📝 المنشورات</h3><div id="admin-posts"></div></div>
<div class="card"><h3 style="margin-bottom:8px">💬 الرسائل</h3><div id="admin-messages"></div></div>
</section>
</div>
</div>

<!-- Quiz Modal -->
<div id="quiz-modal" class="modal">
<div class="modal-content">
<h3 style="margin-bottom:12px"><i class="fas fa-brain" style="color:#ff4757"></i> اختبار التوافق</h3>
<div id="quiz-questions"></div>
<button onclick="submitQuiz()" style="width:100%;padding:10px;background:#ff4757;color:#fff;border:none;border-radius:30px;font-weight:700;cursor:pointer;margin-top:10px">إرسال</button>
<button onclick="document.getElementById('quiz-modal').classList.remove('active')" style="background:none;border:none;color:#888;margin-top:6px;cursor:pointer">إلغاء</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
// ====== المتغيرات ======
let currentUser = null, socket = null, activeChat = null;
let token = localStorage.getItem('token');

// ====== المصادقة ======
function toggleAuth() {
  const l = document.getElementById('login-form');
  const r = document.getElementById('register-form');
  if (l.style.display === 'none') { l.style.display = 'block'; r.style.display = 'none'; }
  else { l.style.display = 'none'; r.style.display = 'block'; }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-pass').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      currentUser = data.user;
      initApp();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (e) { alert('Error: ' + e.message); }
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-pass').value;
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      currentUser = data.user;
      initApp();
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (e) { alert('Error: ' + e.message); }
}

function logout() { localStorage.removeItem('token'); location.reload(); }

function initApp() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if (currentUser.role === 'admin') document.getElementById('nav-admin').style.display = 'inline';
  socket = io();
  socket.emit('join', currentUser.id);
  socket.on('receiveMessage', (msg) => {
    if (activeChat && (msg.senderId._id === activeChat || msg.receiverId._id === activeChat)) {
      appendMsg(msg);
    }
  });
  socket.on('newPost', () => {
    if (document.getElementById('page-feed').classList.contains('active')) loadFeed();
  });
  navigate('feed');
}

// ====== التنقل ======
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-icons a').forEach(a => a.classList.remove('active'));
  const map = { feed: 'nav-feed', chat: 'nav-chat', profile: 'nav-profile', admin: 'nav-admin' };
  const el = document.getElementById(map[page]);
  if (el) el.classList.add('active');
  if (page === 'feed') loadFeed();
  else if (page === 'chat') loadChatList();
  else if (page === 'profile') loadProfile();
  else if (page === 'admin' && currentUser?.role === 'admin') loadAdmin();
}

// ====== Feed ======
async function loadFeed() {
  try {
    const res = await fetch('/api/posts/feed', { headers: { 'Authorization': 'Bearer ' + token } });
    const posts = await res.json();
    const c = document.getElementById('feed-container');
    c.innerHTML = posts.map(p => \`
      <div class="card">
        <div class="post-header">
          <div class="avatar">\${p.user?.username?.[0] || '?'}</div>
          <div class="info"><div class="name">\${p.user?.username || 'مستخدم'}</div><div class="time">\${new Date(p.createdAt).toLocaleString()}</div></div>
        </div>
        <div>\${p.text}</div>
        \${p.image ? '<img src="'+p.image+'" class="post-image">' : ''}
        <div class="post-actions">
          <span onclick="likePost('\${p.id}')"><i class="fas fa-heart \${p.likes.includes(currentUser.id)?'liked':''}"></i> \${p.likes.length}</span>
          <span onclick="toggleComments('\${p.id}')"><i class="fas fa-comment"></i> \${p.comments.length}</span>
          <span onclick="openQuiz()"><i class="fas fa-brain"></i> اختبار</span>
        </div>
        <div id="comments-\${p.id}" style="display:none;margin-top:8px">
          \${p.comments.map(c => '<div><strong>'+(c.user?.username||'مستخدم')+':</strong> '+c.text+'</div>').join('')}
          <input type="text" id="comment-\${p.id}" placeholder="أضف تعليقاً..." style="width:100%;padding:6px 12px;border-radius:30px;border:1px solid #eee;margin-top:4px" onkeypress="if(event.key==='Enter')addComment('\${p.id}')">
        </div>
      </div>
    \`).join('');
  } catch (e) { console.error(e); }
}

async function createPost() {
  const text = document.getElementById('post-text').value;
  const file = document.getElementById('post-image');
  const fd = new FormData();
  fd.append('text', text);
  if (file.files[0]) fd.append('image', file.files[0]);
  try {
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
    if (res.ok) {
      document.getElementById('post-text').value = '';
      document.getElementById('post-image').value = '';
      document.getElementById('img-name').textContent = '';
      loadFeed();
    } else alert('فشل النشر');
  } catch (e) { alert('Error'); }
}

async function likePost(id) {
  try { await fetch('/api/posts/' + id + '/like', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); loadFeed(); } catch (e) {}
}
function toggleComments(id) {
  const el = document.getElementById('comments-' + id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
async function addComment(id) {
  const input = document.getElementById('comment-' + id);
  const text = input.value.trim();
  if (!text) return;
  try {
    await fetch('/api/posts/' + id + '/comment', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    input.value = ''; loadFeed();
  } catch (e) { alert('Error'); }
}

// ====== Chat ======
async function loadChatList() {
  try {
    const res = await fetch('/api/chat/users', { headers: { 'Authorization': 'Bearer ' + token } });
    const users = await res.json();
    const c = document.getElementById('chat-list');
    c.innerHTML = users.map(u => \`
      <div class="chat-item" onclick="openChat('\${u._id}','\${u.username}')">
        <div class="avatar">\${u.username?.[0] || '?'}</div>
        <div><strong>\${u.username}</strong></div>
      </div>
    \`).join('') || '<p style="color:#999;text-align:center;padding:20px">لا توجد محادثات</p>';
    document.getElementById('chat-window').style.display = 'none';
  } catch (e) { console.error(e); }
}
function openChat(id, name) { activeChat = id; document.getElementById('chat-window').style.display = 'flex'; document.getElementById('chat-user-name').textContent = name; loadMessages(id); }
function closeChat() { activeChat = null; document.getElementById('chat-window').style.display = 'none'; }
async function loadMessages(id) {
  try {
    const res = await fetch('/api/chat/messages/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
    const msgs = await res.json();
    const c = document.getElementById('chat-messages');
    c.innerHTML = msgs.map(m => \`
      <div class="msg \${m.senderId?._id === currentUser.id ? 'sent' : ''}">
        \${m.senderId?._id === currentUser.id ? '' : '<strong>'+m.senderId?.username+':</strong> '}\${m.text}
      </div>
    \`).join('');
    c.scrollTop = c.scrollHeight;
  } catch (e) { console.error(e); }
}
function sendMsg() {
  const input = document.getElementById('chat-text');
  const text = input.value.trim();
  if (!text || !activeChat) return;
  socket.emit('sendMessage', { senderId: currentUser.id, receiverId: activeChat, text });
  input.value = '';
}
function appendMsg(msg) {
  const c = document.getElementById('chat-messages');
  const d = document.createElement('div');
  d.className = 'msg ' + (msg.senderId._id === currentUser.id ? 'sent' : '');
  d.innerHTML = (msg.senderId._id === currentUser.id ? '' : '<strong>' + msg.senderId.username + ':</strong> ') + msg.text;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}

// ====== Profile ======
async function loadProfile() {
  try {
    const res = await fetch('/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } });
    const user = await res.json();
    document.getElementById('profile-avatar').textContent = user.username?.[0] || '?';
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-bio').textContent = user.bio || 'أهلاً بك!';
    document.getElementById('profile-verified').style.display = user.verified ? 'inline' : 'none';
    const posts = await (await fetch('/api/posts/feed', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    const my = posts.filter(p => p.user?._id === user.id);
    document.getElementById('profile-posts').innerHTML = my.map(p => \`
      <div class="card"><p>\${p.text}</p>\${p.image ? '<img src="'+p.image+'" class="post-image">' : ''}</div>
    \`).join('') || '<p style="color:#999;text-align:center;padding:20px">لا توجد منشورات</p>';
  } catch (e) { console.error(e); }
}
function editProfile() {
  const newBio = prompt('أدخل السيرة الذاتية الجديدة:', document.getElementById('profile-bio').textContent);
  if (newBio !== null) {
    fetch('/api/users/me', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: newBio }) })
      .then(() => loadProfile());
  }
}
async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  try {
    await fetch('/api/users/avatar', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
    loadProfile();
  } catch (e) { alert('Error'); }
}

// ====== Quiz ======
function openQuiz() {
  document.getElementById('quiz-modal').classList.add('active');
  const qs = ['كيف تصف شخصيتك؟ (1-5)', 'ما هو نمط حياتك المفضل؟', 'كيف تتعامل مع المشاكل؟', 'ما هي أولويتك في الحياة؟', 'كيف تفضل قضاء وقتك؟'];
  document.getElementById('quiz-questions').innerHTML = qs.map((q, i) => \`
    <div class="quiz-question"><p>\${q}</p>\${[1,2,3,4,5].map(v => '<label><input type="radio" name="q'+i+'" value="'+v+'"> '+v+'</label>').join('')}</div>
  \`).join('');
}
async function submitQuiz() {
  const answers = [];
  for (let i=0; i<5; i++) {
    const sel = document.querySelector('input[name="q'+i+'"]:checked');
    if (!sel) return alert('أجب على جميع الأسئلة');
    answers.push(parseInt(sel.value));
  }
  try {
    const res = await fetch('/api/quiz/submit', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    const data = await res.json();
    if (res.ok) {
      const msg = data.results.length ? data.results.slice(0,5).map(r => r.username + ': ' + r.compatibility + '%').join('\n') : 'لا توجد نتائج';
      alert('نتائج التوافق:\n' + msg);
    } else alert(data.error || 'Error');
    document.getElementById('quiz-modal').classList.remove('active');
  } catch (e) { alert('Error'); }
}

// ====== Admin ======
async function loadAdmin() {
  if (currentUser.role !== 'admin') return;
  try {
    const stats = await (await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    document.getElementById('admin-stats').innerHTML = \`
      <div class="stat-box"><h4>\${stats.totalUsers}</h4><p>المستخدمين</p></div>
      <div class="stat-box"><h4>\${stats.totalPosts}</h4><p>المنشورات</p></div>
      <div class="stat-box"><h4>\${stats.totalLikes}</h4><p>الإعجابات</p></div>
    \`;
    const users = await (await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    document.getElementById('admin-users').innerHTML = users.map(u => \`
      <div class="user-row">
        <span>\${u.username}\${u.verified ? ' ✅' : ''}</span>
        <span>\${u.isActive ? 'نشط' : 'محظور'}</span>
        <span class="actions">
          <button class="btn-verify" onclick="verifyUser('\${u.id}')">توثيق</button>
          <button class="btn-block" onclick="toggleUser('\${u.id}')">\${u.isActive ? 'حظر' : 'إلغاء'}</button>
          <button class="btn-del" onclick="deleteUser('\${u.id}')">حذف</button>
        </span>
      </div>
    \`).join('');
    const posts = await (await fetch('/api/posts/feed', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    document.getElementById('admin-posts').innerHTML = posts.slice(0,10).map(p => \`
      <div class="user-row"><span>\${p.text?.substring(0,30)}</span><span>بواسطة \${p.user?.username}</span><button class="btn-del" onclick="deletePost('\${p.id}')">حذف</button></div>
    \`).join('');
    const msgs = await (await fetch('/api/admin/messages', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    document.getElementById('admin-messages').innerHTML = msgs.slice(0,20).map(m => \`
      <div class="user-row"><span>\${m.senderId?.username} → \${m.receiverId?.username}</span><span>\${m.text}</span></div>
    \`).join('');
  } catch (e) { console.error(e); }
}
async function toggleUser(id) { if (!confirm('تغيير حالة المستخدم؟')) return; await fetch('/api/admin/users/'+id+'/toggle', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } }); loadAdmin(); }
async function deleteUser(id) { if (!confirm('حذف المستخدم نهائياً؟')) return; await fetch('/api/admin/users/'+id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); loadAdmin(); }
async function verifyUser(id) { await fetch('/api/admin/users/'+id+'/verify', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } }); loadAdmin(); }
async function deletePost(id) { if (!confirm('حذف المنشور؟')) return; await fetch('/api/admin/posts/'+id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }); loadAdmin(); }

// ====== بدء التشغيل ======
if (token) {
  fetch('/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(user => {
      if (user && user.id) { currentUser = user; initApp(); }
      else { localStorage.removeItem('token'); location.reload(); }
    })
    .catch(() => { localStorage.removeItem('token'); location.reload(); });
}
</script>
</body>
</html>
  `);
});

// ========== تشغيل الخادم ==========
server.listen(PORT, () => {
  console.log(`🚀 FaceLove Ultimate running on http://localhost:${PORT}`);
  console.log(`📊 Admin: set role to "admin" in memory (change in code)`);
});

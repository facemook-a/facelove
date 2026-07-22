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
    const user = { id: 'u' + genId(), username, email, password: hashed, avatar: '', bio: '', verified: false, role: 'user', isActive: true };
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

// ========== الواجهة الأمامية ==========
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
<button onclick="document.getElementById('quiz-modal').classList.remove

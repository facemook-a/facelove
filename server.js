const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

// ========== رابط قاعدة البيانات مع كلمة المرور ==========
// تم إدخال كلمة المرور 0705557575 في الرابط
const MONGODB_URI = 'mongodb+srv://aymaneedd:0705557575@cluster0.r4uqw3s.mongodb.net/facelove';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ========== النماذج ==========
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  verified: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true }
});
const User = mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const QuizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: [Number], required: true }
});
const Quiz = mongoose.model('Quiz', QuizSchema);

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
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'), false);
  }
});

// ========== المصادقة ==========
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    const decoded = jwt.verify(token, 'my_secret_key');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw new Error();
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// ========== API ==========

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (await User.findOne({ $or: [{ username }, { email }] }))
      return res.status(400).json({ error: 'Username or email already used' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, 'my_secret_key');
    res.status(201).json({ token, user: { id: user._id, username, email, role: user.role } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, 'my_secret_key');
    res.json({ token, user: { id: user._id, username: user.username, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users
app.get('/api/users/me', auth, async (req, res) => res.json(req.user));

app.put('/api/users/me', auth, async (req, res) => {
  try {
    const { username, bio } = req.body;
    if (username) req.user.username = username;
    if (bio !== undefined) req.user.bio = bio;
    await req.user.save();
    res.json(req.user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/users/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const filename = 'avatar-' + Date.now() + '.jpg';
    const outputPath = path.join(__dirname, 'uploads', filename);
    await sharp(req.file.path).resize(200, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(outputPath);
    fs.unlinkSync(req.file.path);
    req.user.avatar = '/uploads/' + filename;
    await req.user.save();
    res.json({ avatar: req.user.avatar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Posts
app.get('/api/posts/feed', auth, async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate('userId', 'username avatar');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts', auth, upload.single('image'), async (req, res) => {
  try {
    let imageUrl = '';
    if (req.file) {
      const filename = Date.now() + '.jpg';
      const outputPath = path.join(__dirname, 'uploads', filename);
      await sharp(req.file.path).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(outputPath);
      fs.unlinkSync(req.file.path);
      imageUrl = '/uploads/' + filename;
    }
    const post = new Post({ userId: req.user._id, text: req.body.text || '', image: imageUrl });
    await post.save();
    io.emit('newPost', post);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    const index = post.likes.indexOf(req.user._id);
    if (index === -1) post.likes.push(req.user._id);
    else post.likes.splice(index, 1);
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts/:id/comment', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    post.comments.push({ userId: req.user._id, text: req.body.text });
    await post.save();
    res.json({ comments: post.comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quiz
app.post('/api/quiz/submit', auth, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || answers.length !== 5) return res.status(400).json({ error: 'Answer all 5 questions' });
    await Quiz.findOneAndDelete({ userId: req.user._id });
    await new Quiz({ userId: req.user._id, answers }).save();
    const all = await Quiz.find({ userId: { $ne: req.user._id } });
    const results = [];
    for (let q of all) {
      const user = await User.findById(q.userId);
      if (!user) continue;
      let score = 0;
      for (let i = 0; i < 5; i++) {
        if (Math.abs(answers[i] - q.answers[i]) <= 1) score++;
      }
      results.push({ userId: q.userId, username: user.username, compatibility: Math.round((score / 5) * 100) });
    }
    results.sort((a, b) => b.compatibility - a.compatibility);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat
app.get('/api/chat/users', auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    }).distinct('senderId receiverId');
    const ids = new Set();
    msgs.forEach(id => { if (id.toString() !== req.user._id.toString()) ids.add(id.toString()); });
    const users = await User.find({ _id: { $in: Array.from(ids) } }, 'username avatar');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat/messages/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user._id }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin
app.get('/api/admin/stats', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const totalUsers = await User.countDocuments();
  const totalPosts = await Post.countDocuments();
  const totalLikes = await Post.aggregate([{ $project: { likesCount: { $size: "$likes" } } }, { $group: { _id: null, total: { $sum: "$likesCount" } } }]);
  res.json({ totalUsers, totalPosts, totalLikes: totalLikes[0]?.total || 0 });
});

app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(await User.find({}, '-password'));
});

app.put('/api/admin/users/:id/toggle', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ isActive: user.isActive });
});

app.delete('/api/admin/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

app.put('/api/admin/users/:id/verify', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.verified = true;
  await user.save();
  res.json({ verified: true });
});

app.delete('/api/admin/posts/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  await Post.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

app.get('/api/admin/messages', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(await Message.find().populate('senderId receiverId', 'username'));
});

// ========== Socket.io ==========
io.on('connection', (socket) => {
  console.log('🔌 Client connected');
  socket.on('join', (userId) => socket.join(userId));
  socket.on('sendMessage', async ({ senderId, receiverId, text }) => {
    try {
      const msg = new Message({ senderId, receiverId, text });
      await msg.save();
      const populated = await msg.populate('senderId receiverId', 'username');
      io.to(receiverId).emit('receiveMessage', populated);
      io.to(senderId).emit('receiveMessage', populated);
    } catch (error) {
      console.error(error);
    }
  });
  socket.on('disconnect', () => console.log('🔌 Client disconnected'));
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
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#f5f6fa;color:#1a1a2e;padding-bottom:70px}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:#ff6b81;border-radius:10px}
#navbar{position:fixed;top:0;left:0;width:100%;background:#ffffffcc;backdrop-filter:blur(20px);box-shadow:0 4px 20px rgba(0,0,0,0.03);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:100;border-bottom:1px solid rgba(255,107,129,0.1)}
.logo{font-weight:800;font-size:1.3rem;background:linear-gradient(135deg,#ff6b81,#ff4757);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo i{-webkit-text-fill-color:#ff4757;margin-right:4px}
.nav-icons span{margin-left:16px;font-size:1.3rem;color:#888;cursor:pointer;transition:0.2s;padding:6px;border-radius:12px}
.nav-icons span:hover{color:#ff4757;background:#fff0f2}
.nav-icons span.active{color:#ff4757;background:#fff0f2}
#main-content{margin-top:75px;padding:16px;max-width:720px;margin-left:auto;margin-right:auto}
.page{display:none;animation:fade 0.3s ease}
.page.active{display:block}
@keyframes fade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.card{background:#fff;border-radius:20px;padding:18px 20px;margin-bottom:16px;box-shadow:0 8px 30px rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.02)}
.card:hover{border-color:#ff6b8133}
.post-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#ff6b81,#ff4757);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;color:#fff;flex-shrink:0}
.post-image{width:100%;border-radius:14px;margin:10px 0;max-height:400px;object-fit:cover}
.post-actions{display:flex;gap:24px;margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0}
.post-actions span{display:flex;align-items:center;gap:6px;color:#888;cursor:pointer;font-size:0.95rem}
.post-actions span:hover{color:#ff4757}
.post-actions .liked{color:#ff4757}
.chat-list-item{display:flex;align-items:center;gap:14px;padding:12px 16px;background:#fff;border-radius:16px;margin-bottom:8px;cursor:pointer;border:1px solid transparent}
.chat-list-item:hover{border-color:#ff6b8133;background:#fafafa}
.chat-window{background:#fff;border-radius:20px;padding:16px;height:70vh;display:flex;flex-direction:column}
.chat-messages{flex:1;overflow-y:auto;padding:8px 0}
.message{margin:6px 0;padding:10px 16px;border-radius:18px;max-width:80%;background:#f0f2f5;align-self:flex-start}
.message.sent{background:#ff4757;color:#fff;align-self:flex-end}
.chat-input{display:flex;gap:10px;margin-top:10px}
.chat-input input{flex:1;padding:12px 16px;border-radius:30px;border:2px solid #eee;outline:none}
.chat-input input:focus{border-color:#ff4757}
.chat-input button{background:#ff4757;color:#fff;border:none;border-radius:50%;width:48px;cursor:pointer}
.stat-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.stat-card{background:#fff;padding:16px;border-radius:16px;text-align:center;border:1px solid #f0f0f0}
.stat-card h4{font-size:1.6rem;color:#ff4757}
.user-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0}
.user-item .actions button{margin-left:6px;padding:4px 12px;border:none;border-radius:20px;font-size:0.8rem;cursor:pointer}
.btn-verify{background:#2ed573;color:#fff}
.btn-block{background:#ff6b6b;color:#fff}
.btn-delete{background:#ff4757;color:#fff}
.auth-form{max-width:400px;margin:auto;background:#fff;padding:32px;border-radius:28px;box-shadow:0 20px 60px rgba(0,0,0,0.03)}
.auth-form input{width:100%;padding:12px 16px;margin:6px 0;border:2px solid #eee;border-radius:30px;outline:none}
.auth-form input:focus{border-color:#ff4757}
.auth-form button{width:100%;padding:12px;background:#ff4757;color:#fff;border:none;border-radius:30px;font-weight:700;cursor:pointer}
.auth-form .toggle{text-align:center;margin-top:12px;color:#888;cursor:pointer}
.modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:200}
.modal.active{display:flex}
.modal-content{background:#fff;padding:28px;border-radius:28px;max-width:420px;width:90%}
.quiz-question{margin-bottom:16px}
.quiz-question label{display:inline-block;margin:4px 12px 4px 0}
@media(max-width:600px){.stat-cards{grid-template-columns:repeat(2,1fr)}.nav-icons span{margin-left:10px;font-size:1.1rem}}
</style>
</head>
<body>

<div id="auth-container" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px">
<div class="auth-form" id="login-form">
<h2 style="text-align:center;color:#ff4757"><i class="fas fa-heart"></i> FaceLove</h2>
<h4 style="text-align:center;margin-bottom:20px">تسجيل الدخول</h4>
<input type="email" id="login-email" placeholder="البريد الإلكتروني">
<input type="password" id="login-password" placeholder="كلمة المرور">
<button onclick="handleLogin()">دخول</button>
<div class="toggle" onclick="toggleAuth()">ليس لديك حساب؟ سجل الآن</div>
</div>
<div class="auth-form" id="register-form" style="display:none">
<h2 style="text-align:center;color:#ff4757"><i class="fas fa-heart"></i> FaceLove</h2>
<h4 style="text-align:center;margin-bottom:20px">إنشاء حساب</h4>
<input type="text" id="reg-username" placeholder="اسم المستخدم">
<input type="email" id="reg-email" placeholder="البريد الإلكتروني">
<input type="password" id="reg-password" placeholder="كلمة المرور">
<button onclick="handleRegister()">تسجيل</button>
<div class="toggle" onclick="toggleAuth()">لديك حساب؟ سجل دخول</div>
</div>
</div>

<div id="app-container" style="display:none">
<nav id="navbar"><div class="logo"><i class="fas fa-heart"></i> FaceLove</div>
<div class="nav-icons">
<span id="page-home" class="active" onclick="navigate('feed')"><i class="fas fa-home"></i></span>
<span id="page-chat" onclick="navigate('chat')"><i class="fas fa-comment-dots"></i></span>
<span id="page-profile" onclick="navigate('profile')"><i class="fas fa-user"></i></span>
<span id="page-admin" style="display:none" onclick="navigate('admin')"><i class="fas fa-crown"></i></span>
<span onclick="handleLogout()"><i class="fas fa-sign-out-alt"></i></span>
</div></nav>

<div id="main-content">
<section id="feed-page" class="page active">
<div class="card">
<textarea id="post-text" placeholder="شارك ما يخطر ببالك..." rows="2" style="width:100%;padding:12px;border-radius:16px;border:2px solid #eee;resize:vertical;font-family:inherit"></textarea>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px">
<div style="display:flex;align-items:center;gap:12px">
<input type="file" id="post-image" accept="image/*" style="display:none" onchange="document.getElementById('image-name').textContent=this.files[0]?.name">
<label for="post-image" style="cursor:pointer;color:#ff4757"><i class="fas fa-image"></i> إضافة صورة</label>
<span id="image-name" style="color:#888;font-size:0.85rem"></span>
</div>
<button onclick="createPost()" style="background:#ff4757;color:#fff;border:none;padding:10px 28px;border-radius:30px;font-weight:700;cursor:pointer">نشر</button>
</div>
</div>
<div id="feed-container"></div>
</section>

<section id="chat-page" class="page">
<div id="chat-list-container"></div>
<div id="chat-window" style="display:none" class="chat-window">
<div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #eee">
<span id="chat-user-name" style="font-weight:700"></span>
<span onclick="closeChat()" style="cursor:pointer;color:#888"><i class="fas fa-times"></i></span>
</div>
<div id="chat-messages" class="chat-messages"></div>
<div class="chat-input">
<input type="text" id="chat-text" placeholder="اكتب رسالة...">
<button onclick="sendMessage()"><i class="fas fa-paper-plane"></i></button>
</div>
</div>
</section>

<section id="profile-page" class="page">
<div class="card">
<div style="text-align:center">
<div id="profile-avatar" class="avatar" style="width:80px;height:80px;font-size:2.2rem;margin:auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff6b81,#ff4757);color:#fff;font-weight:700"></div>
<input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
<button onclick="document.getElementById('avatar-input').click()" style="background:none;border:none;color:#ff4757;cursor:pointer;margin-top:6px"><i class="fas fa-camera"></i> تغيير الصورة</button>
<h2 id="profile-username" style="margin:8px 0 4px"></h2>
<p id="profile-bio" style="color:#888"></p>
<div style="margin:12px 0">
<span id="profile-verified" style="color:#2ed573;display:none"><i class="fas fa-check-circle"></i> موثق</span>
</div>
<button onclick="editProfile()" style="background:#ff4757;color:#fff;border:none;padding:8px 28px;border-radius:30px;font-weight:600;cursor:pointer">تعديل الملف</button>
</div>
</div>
<div id="profile-posts"></div>
</section>

<section id="admin-page" class="page">
<div class="card"><div class="stat-cards" id="admin-stats"></div></div>
<div class="card"><h3 style="margin-bottom:12px">👥 المستخدمين</h3><div id="admin-users"></div></div>
<div class="card"><h3 style="margin-bottom:12px">📝 المنشورات</h3><div id="admin-posts"></div></div>
<div class="card"><h3 style="margin-bottom:12px">💬 الرسائل</h3><div id="admin-messages"></div></div>
</section>
</div>
</div>

<div id="quiz-modal" class="modal">
<div class="modal-content">
<h3 style="margin-bottom:16px"><i class="fas fa-brain" style="color:#ff4757"></i> اختبار التوافق</h3>
<div id="quiz-questions"></div>
<button onclick="submitQuiz()" style="width:100%;padding:12px;background:#ff4757;color:#fff;border:none;border-radius:30px;font-weight:700;cursor:pointer;margin-top:12px">إرسال</button>
<button onclick="document.getElementById('quiz-modal').classList.remove('active')" style="background:none;border:none;color:#888;margin-top:8px;cursor:pointer">إلغاء</button>
</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let currentUser=null,socket=null,activeChatUserId=null;
let token=localStorage.getItem('token');

function toggleAuth(){
const l=document.getElementById('login-form'),r=document.getElementById('register-form');
if(l.style.display==='none'){l.style.display='block';r.style.display='none'}
else{l.style.display='none';r.style.display='block'}
}

async function handleLogin(){
const email=document.getElementById('login-email').value;
const password=document.getElementById('login-password').value;
try{
const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
const data=await res.json();
if(res.ok){token=data.token;localStorage.setItem('token',token);currentUser=data.user;initApp();}
else alert(data.error||'Login failed');
}catch(e){alert('Error')}
}

async function handleRegister(){
const username=document.getElementById('reg-username').value;
const email=document.getElementById('reg-email').value;
const password=document.getElementById('reg-password').value;
try{
const res=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,email,password})});
const data=await res.json();
if(res.ok){token=data.token;localStorage.setItem('token',token);currentUser=data.user;initApp();}
else alert(data.error||'Registration failed');
}catch(e){alert('Error')}
}

function handleLogout(){localStorage.removeItem('token');location.reload()}

function initApp(){
document.getElementById('auth-container').style.display='none';
document.getElementById('app-container').style.display='block';
if(currentUser.role==='admin')document.getElementById('page-admin').style.display='inline';
socket=io();socket.emit('join',currentUser.id);
socket.on('receiveMessage',(msg)=>{if(activeChatUserId&&(msg.senderId._id===activeChatUserId||msg.receiverId._id===activeChatUserId))appendMessage(msg)});
socket.on('newPost',()=>{if(document.getElementById('feed-page').classList.contains('active'))loadFeed()});
navigate('feed');
}

function navigate(page){
document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
document.getElementById(page+'-page').classList.add('active');
document.querySelectorAll('.nav-icons span').forEach(s=>s.classList.remove('active'));
const el=document.getElementById('page-'+(page==='feed'?'home':page));if(el)el.classList.add('active');
if(page==='feed')loadFeed();
else if(page==='chat')loadChatList();
else if(page==='profile')loadProfile();
else if(page==='admin'&&currentUser?.role==='admin')loadAdmin();
}

async function loadFeed(){
try{
const res=await fetch('/api/posts/feed',{headers:{'Authorization':'Bearer '+token}});
const posts=await res.json();
const c=document.getElementById('feed-container');
c.innerHTML=posts.map(p=>\`
<div class="card">
<div class="post-header"><div class="avatar">\${p.userId?.username?.[0]||'?'}</div><div><strong>\${p.userId?.username||'مستخدم'}</strong></div></div>
<p>\${p.text}</p>\${p.image?'<img src="'+p.image+'" class="post-image">':''}
<div class="post-actions">
<span onclick="likePost('\${p._id}')"><i class="fas fa-heart \${p.likes.includes(currentUser.id)?'liked':''}"></i> \${p.likes.length}</span>
<span onclick="toggleComments('\${p._id}')"><i class="fas fa-comment"></i> \${p.comments.length}</span>
<span onclick="openQuizModal()" style="cursor:pointer"><i class="fas fa-brain"></i> اختبار</span>
</div>
<div id="comments-\${p._id}" style="display:none;margin-top:10px">
\${p.comments.map(c=>'<div><strong>'+(c.userId?.username||'مستخدم')+':</strong> '+c.text+'</div>').join('')}
<input type="text" id="comment-input-\${p._id}" placeholder="أضف تعليقاً..." style="width:100%;padding:8px 12px;border-radius:30px;border:1px solid #eee;margin-top:6px" onkeypress="if(event.key==='Enter')addComment('\${p._id}')">
</div>
</div>\`).join('');
}catch(e){console.error(e)}
}

async function createPost(){
const text=document.getElementById('post-text').value;
const file=document.getElementById('post-image');
const fd=new FormData();fd.append('text',text);if(file.files[0])fd.append('image',file.files[0]);
try{
const res=await fetch('/api/posts',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});
if(res.ok){document.getElementById('post-text').value='';document.getElementById('post-image').value='';document.getElementById('image-name').textContent='';loadFeed();}
else alert('فشل النشر');
}catch(e){alert('Error')}
}

async function likePost(id){try{await fetch('/api/posts/'+id+'/like',{method:'POST',headers:{'Authorization':'Bearer '+token}});loadFeed()}catch(e){}}

function toggleComments(id){const el=document.getElementById('comments-'+id);el.style.display=el.style.display==='none'?'block':'none'}

async function addComment(id){
const input=document.getElementById('comment-input-'+id);const text=input.value.trim();if(!text)return;
try{await fetch('/api/posts/'+id+'/comment',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({text})});input.value='';loadFeed()}catch(e){alert('Error')}
}

async function loadChatList(){
try{
const res=await fetch('/api/chat/users',{headers:{'Authorization':'Bearer '+token}});
const users=await res.json();
const c=document.getElementById('chat-list-container');
c.innerHTML=users.map(u=>\`<div class="chat-list-item" onclick="openChat('\${u._id}','\${u.username}')"><div class="avatar">\${u.username?.[0]||'?'}</div><div><strong>\${u.username}</strong></div></div>\`).join('')||'<p style="color:#888;text-align:center;padding:20px">لا توجد محادثات</p>';
document.getElementById('chat-window').style.display='none';
}catch(e){console.error(e)}
}

function openChat(id,name){activeChatUserId=id;document.getElementById('chat-window').style.display='flex';document.getElementById('chat-user-name').textContent=name;loadMessages(id)}
function closeChat(){activeChatUserId=null;document.getElementById('chat-window').style.display='none'}

async function loadMessages(id){
try{
const res=await fetch('/api/chat/messages/'+id,{headers:{'Authorization':'Bearer '+token}});
const msgs=await res.json();
const c=document.getElementById('chat-messages');
c.innerHTML=msgs.map(m=>\`<div class="message \${m.senderId===currentUser.id?'sent':''}">\${m.senderId===currentUser.id?'':'<strong>'+m.senderId?.username+':</strong> '}\${m.text}</div>\`).join('');
c.scrollTop=c.scrollHeight;
}catch(e){console.error(e)}
}

function sendMessage(){
const input=document.getElementById('chat-text');const text=input.value.trim();if(!text||!activeChatUserId)return;
socket.emit('sendMessage',{senderId:currentUser.id,receiverId:activeChatUserId,text});input.value='';
}

function appendMessage(msg){
const c=document.getElementById('chat-messages');const d=document.createElement('div');
d.className='message '+(msg.senderId._id===currentUser.id?'sent':'');
d.innerHTML=(msg.senderId._id===currentUser.id?'':'<strong>'+msg.senderId?.username+':</strong> ')+msg.text;
c.appendChild(d);c.scrollTop=c.scrollHeight;
}

async function loadProfile(){
try{
const res=await fetch('/api/users/me',{headers:{'Authorization':'Bearer '+token}});
const user=await res.json();
document.getElementById('profile-avatar').textContent=user.username?.[0]||'?';
document.getElementById('profile-username').textContent=user.username;
document.getElementById('profile-bio').textContent=user.bio||'أهلاً بك في FaceLove!';
document.getElementById('profile-verified').style.display=user.verified?'inline':'none';
const posts=await (await fetch('/api/posts/feed',{headers:{'Authorization':'Bearer '+token}})).json();
const my=posts.filter(p=>p.userId?._id===user._id);
document.getElementById('profile-posts').innerHTML=my.map(p=>\`<div class="card"><p>\${p.text}</p>\${p.image?'<img src="'+p.image+'" class="post-image">':''}</div>\`).join('')||'<p style="color:#888;text-align:center;padding:20px">لا توجد منشورات</p>';
}catch(e){console.error(e)}
}

function editProfile(){
const newBio=prompt('أدخل السيرة الذاتية الجديدة:',document.getElementById('profile-bio').textContent);
if(newBio!==null){fetch('/api/users/me',{method:'PUT',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({bio:newBio})}).then(()=>loadProfile())}
}

async function uploadAvatar(input){
const file=input.files[0];if(!file)return;const fd=new FormData();fd.append('avatar',file);
try{await fetch('/api/users/avatar',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});loadProfile()}catch(e){alert('Error')}
}

function openQuizModal(){
document.getElementById('quiz-modal').classList.add('active');
const qs=['كيف تصف شخصيتك؟ (1-5)','ما هو نمط حياتك المفضل؟','كيف تتعامل مع المشاكل؟','ما هي أولويتك في الحياة؟','كيف تفضل قضاء وقتك؟'];
document.getElementById('quiz-questions').innerHTML=qs.map((q,i)=>'<div class="quiz-question"><p>'+q+'</p>'+[1,2,3,4,5].map(v=>'<label><input type="radio" name="q'+i+'" value="'+v+'"> '+v+'</label>').join('')+'</div>').join('');
}

async function submitQuiz(){
const answers=[];for(let i=0;i<5;i++){const sel=document.querySelector('input[name="q'+i+'"]:checked');if(!sel)return alert('أجب على جميع الأسئلة');answers.push(parseInt(sel.value))}
try{
const res=await fetch('/api/quiz/submit',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({answers})});
const data=await res.json();
if(res.ok){alert('نتائج التوافق:\n'+data.results.slice(0,5).map(r=>r.username+': '+r.compatibility+'%').join('\n'))}
else alert(data.error||'Error');
document.getElementById('quiz-modal').classList.remove('active');
}catch(e){alert('Error')}
}

async function loadAdmin(){
if(currentUser.role!=='admin')return;
try{
const stats=await(await fetch('/api/admin/stats',{headers:{'Authorization':'Bearer '+token}})).json();
document.getElementById('admin-stats').innerHTML='<div class="stat-card"><h4>'+stats.totalUsers+'</h4><p>المستخدمين</p></div><div class="stat-card"><h4>'+stats.totalPosts+'</h4><p>المنشورات</p></div><div class="stat-card"><h4>'+stats.totalLikes+'</h4><p>الإعجابات</p></div>';
const users=await(await fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+token}})).json();
document.getElementById('admin-users').innerHTML=users.map(u=>'<div class="user-item"><span>'+u.username+(u.verified?' ✅':'')+'</span><span>'+(u.isActive?'نشط':'محظور')+'</span><span class="actions"><button class="btn-verify" onclick="verifyUser(\\''+u._id+'\\')">توثيق</button><button class="btn-block" onclick="toggleUser(\\''+u._id+'\\')">'+(u.isActive?'حظر':'إلغاء')+'</button><button class="btn-delete" onclick="deleteUser(\\''+u._id+'\\')">حذف</button></span></div>').join('');
const posts=await(await fetch('/api/posts/feed',{headers:{'Authorization':'Bearer '+token}})).json();
document.getElementById('admin-posts').innerHTML=posts.slice(0,10).map(p=>'<div class="user-item"><span>'+p.text?.substring(0,30)+'</span><span>بواسطة '+p.userId?.username+'</span><button class="btn-delete" onclick="deletePost(\\''+p._id+'\\')">حذف</button></div>').join('');
const msgs=await(await fetch('/api/admin/messages',{headers:{'Authorization':'Bearer '+token}})).json();
document.getElementById('admin-messages').innerHTML=msgs.slice(0,20).map(m=>'<div class="user-item"><span>'+m.senderId?.username+' → '+m.receiverId?.username+'</span><span>'+m.text+'</span></div>').join('');
}catch(e){console.error(e)}
}

async function toggleUser(id){if(!confirm('تغيير حالة المستخدم؟'))return;await fetch('/api/admin/users/'+id+'/toggle',{method:'PUT',headers:{'Authorization':'Bearer '+token}});loadAdmin()}
async function deleteUser(id){if(!confirm('حذف المستخدم نهائياً؟'))return;await fetch('/api/admin/users/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+token}});loadAdmin()}
async function verifyUser(id){await fetch('/api/admin/users/'+id+'/verify',{method:'PUT',headers:{'Authorization':'Bearer '+token}});loadAdmin()}
async function deletePost(id){if(!confirm('حذف المنشور؟'))return;await fetch('/api/admin/posts/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+token}});loadAdmin()}

if(token){
fetch('/api/users/me',{headers:{'Authorization':'Bearer '+token}}).then(res=>res.json()).then(user=>{
if(user&&user._id){currentUser=user;initApp();}
else{localStorage.removeItem('token');location.reload()}
}).catch(()=>{localStorage.removeItem('token');location.reload()});
}
</script>
</body>
</html>
  `);
});

// ========== تشغيل الخادم ==========
server.listen(PORT, () => {
  console.log(`🚀 FaceLove running on http://localhost:${PORT}`);
  console.log(`📊 Admin: set role to "admin" in database`);
});

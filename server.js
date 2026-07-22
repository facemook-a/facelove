require('dotenv').config();
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

// ==================== إعدادات الخادم ====================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;

// ==================== قاعدة البيانات ====================
// استخدم MongoDB Atlas أو محلي
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/facelove';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ==================== نماذج (Models) ====================

// نموذج المستخدم
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  verified: { type: Boolean, default: false },
  verificationPending: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// نموذج المنشور
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

// نموذج الرسائل
const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  voiceNote: { type: String, default: '' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// نموذج اختبار التوافق
const QuizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now }
});
const Quiz = mongoose.model('Quiz', QuizSchema);

// ==================== Middleware ====================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Multer لرفع الصور
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

// ==================== المصادقة (JWT) ====================
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_secret');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw new Error();
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

// ==================== API Routes ====================

// -------- المصادقة --------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: 'Username or email already used' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'my_secret');
    res.status(201).json({ token, user: { id: user._id, username, email, role: user.role, verified: user.verified } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'my_secret');
    res.json({ token, user: { id: user._id, username: user.username, email, role: user.role, verified: user.verified } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------- المستخدم --------
app.get('/api/users/me', auth, async (req, res) => {
  res.json(req.user);
});

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
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = 'avatar-' + Date.now() + '.jpg';
    const outputPath = path.join(__dirname, 'uploads', filename);
    await sharp(req.file.path)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    fs.unlinkSync(req.file.path);
    req.user.avatar = '/uploads/' + filename;
    await req.user.save();
    res.json({ avatar: req.user.avatar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/request-verification', auth, async (req, res) => {
  if (req.user.verified) return res.status(400).json({ error: 'Already verified' });
  req.user.verificationPending = true;
  await req.user.save();
  res.json({ message: 'Verification request sent' });
});

// -------- المنشورات --------
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
      await sharp(req.file.path)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      fs.unlinkSync(req.file.path);
      imageUrl = '/uploads/' + filename;
    }
    const post = new Post({
      userId: req.user._id,
      text: req.body.text || '',
      image: imageUrl
    });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
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
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.comments.push({ userId: req.user._id, text: req.body.text });
    await post.save();
    res.json({ comments: post.comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------- اختبارات التوافق --------
app.post('/api/quiz/submit', auth, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || answers.length !== 5) return res.status(400).json({ error: 'Please answer all 5 questions' });
    await Quiz.findOneAndDelete({ userId: req.user._id });
    const quiz = new Quiz({ userId: req.user._id, answers });
    await quiz.save();
    const allQuizzes = await Quiz.find({ userId: { $ne: req.user._id } });
    const results = [];
    for (let q of allQuizzes) {
      const user = await User.findById(q.userId);
      if (!user) continue;
      let score = 0;
      for (let i = 0; i < answers.length; i++) {
        if (Math.abs(answers[i] - q.answers[i]) <= 1) score++;
      }
      const percentage = Math.round((score / answers.length) * 100);
      results.push({ userId: q.userId, username: user.username, compatibility: percentage });
    }
    results.sort((a, b) => b.compatibility - a.compatibility);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------- الدردشة --------
app.get('/api/chat/users', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    }).distinct('senderId receiverId');
    const userIds = new Set();
    messages.forEach(id => {
      if (id.toString() !== req.user._id.toString()) userIds.add(id.toString());
    });
    const users = await User.find({ _id: { $in: Array.from(userIds) } }, 'username avatar');
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

// -------- لوحة الأدمن --------
app.get('/api/admin/stats', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const totalUsers = await User.countDocuments();
  const totalPosts = await Post.countDocuments();
  const totalLikes = await Post.aggregate([{ $project: { likesCount: { $size: "$likes" } } }, { $group: { _id: null, total: { $sum: "$likesCount" } } }]);
  const activeUsers = await User.countDocuments({ isActive: true });
  res.json({ totalUsers, totalPosts, totalLikes: totalLikes[0]?.total || 0, activeUsers });
});

app.get('/api/admin/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = await User.find({}, '-password');
  res.json(users);
});

app.put('/api/admin/users/:id/toggle', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ isActive: user.isActive });
});

app.delete('/api/admin/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

app.put('/api/admin/users/:id/verify', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.verified = true;
  user.verificationPending = false;
  await user.save();
  res.json({ verified: true });
});

app.delete('/api/admin/posts/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  await Post.findByIdAndDelete(req.params.id);
  res.json({ message: 'Post deleted' });
});

app.get('/api/admin/messages', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const messages = await Message.find().populate('senderId receiverId', 'username');
  res.json(messages);
});

// ==================== Socket.io (دردشة فورية) ====================
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('sendMessage', async ({ senderId, receiverId, text }) => {
    try {
      const message = new Message({ senderId, receiverId, text });
      await message.save();
      const populated = await message.populate('senderId receiverId', 'username');
      io.to(receiverId).emit('receiveMessage', populated);
      io.to(senderId).emit('receiveMessage', populated);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    io.to(receiverId).emit('typing', { senderId });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ==================== الواجهة الأمامية (SPA كاملة) ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== تشغيل الخادم ====================
server.listen(PORT, () => {
  console.log(`🚀 FaceLove Pro running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel available for admin users`);
});

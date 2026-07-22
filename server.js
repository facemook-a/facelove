const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// قاعدة بيانات في الذاكرة
const users = [];

// تسجيل
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = { id: Date.now().toString(), username, email, password: hashed };
    users.push(user);
    const token = jwt.sign({ id: user.id }, 'secret');
    res.json({ token, user: { id: user.id, username, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user.id }, 'secret');
    res.json({ token, user: { id: user.id, username: user.username, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// جلب المستخدم الحالي
app.get('/api/users/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, 'secret');
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ====== الواجهة الأمامية ======
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FaceLove</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif}
body{background:#f0f2f5;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh}
.auth{background:#fff;padding:30px;border-radius:20px;max-width:400px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.05)}
.auth h2{text-align:center;color:#ff4757;margin-bottom:20px}
.auth input{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:30px;outline:none}
.auth input:focus{border-color:#ff4757}
.auth button{width:100%;padding:12px;background:#ff4757;color:#fff;border:none;border-radius:30px;font-weight:700;cursor:pointer}
.auth .toggle{text-align:center;margin-top:12px;color:#888;cursor:pointer;font-size:0.9rem}
.auth .toggle:hover{color:#ff4757}
.hidden{display:none}
#app{display:none}
.nav{position:fixed;top:0;left:0;right:0;background:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 10px rgba(0,0,0,0.03)}
.nav .logo{font-weight:700;font-size:1.2rem;color:#ff4757}
.nav .logo i{color:#ff4757}
.nav a{color:#888;margin-left:15px;text-decoration:none}
.nav a:hover{color:#ff4757}
.main{margin-top:80px;max-width:600px;margin-left:auto;margin-right:auto}
.card{background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid #f0f0f0}
.post-header{display:flex;gap:10px;align-items:center}
.post-header .avatar{width:36px;height:36px;border-radius:50%;background:#ff4757;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
.post-header .info{flex:1}
.post-header .info .name{font-weight:600}
.post-header .info .time{font-size:0.75rem;color:#999}
.post-image{width:100%;border-radius:12px;margin:8px 0;max-height:300px;object-fit:cover}
.post-actions{display:flex;gap:16px;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0}
.post-actions span{cursor:pointer;color:#888}
.post-actions span:hover{color:#ff4757}
.post-actions .liked{color:#ff4757}
textarea{width:100%;padding:10px;border:1px solid #eee;border-radius:12px;resize:vertical}
.btn-post{background:#ff4757;color:#fff;border:none;padding:8px 20px;border-radius:30px;font-weight:700;cursor:pointer}
</style>
</head>
<body>

<!-- Auth -->
<div id="auth">
<div class="auth">
<h2><i class="fas fa-heart"></i> FaceLove</h2>
<div id="login-form">
<h3 style="text-align:center;margin-bottom:16px">تسجيل الدخول</h3>
<input type="email" id="login-email" placeholder="البريد الإلكتروني">
<input type="password" id="login-pass" placeholder="كلمة المرور">
<button onclick="login()">دخول</button>
<div class="toggle" onclick="showRegister()">ليس لديك حساب؟ سجل الآن</div>
</div>
<div id="register-form" class="hidden">
<h3 style="text-align:center;margin-bottom:16px">إنشاء حساب</h3>
<input type="text" id="reg-username" placeholder="اسم المستخدم">
<input type="email" id="reg-email" placeholder="البريد الإلكتروني">
<input type="password" id="reg-pass" placeholder="كلمة المرور">
<button onclick="register()">تسجيل</button>
<div class="toggle" onclick="showLogin()">لديك حساب؟ سجل دخول</div>
</div>
</div>
</div>

<!-- App -->
<div id="app">
<nav class="nav">
<div class="logo"><i class="fas fa-heart"></i> FaceLove</div>
<div>
<a href="#" onclick="loadFeed()"><i class="fas fa-home"></i></a>
<a href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i></a>
</div>
</nav>
<div class="main">
<div class="card">
<textarea id="post-text" placeholder="شارك ما يخطر ببالك..." rows="2"></textarea>
<div style="display:flex;justify-content:space-between;margin-top:8px">
<div><input type="file" id="post-image" accept="image/*" style="display:none"><label for="post-image" style="cursor:pointer;color:#ff4757"><i class="fas fa-image"></i> إضافة صورة</label></div>
<button class="btn-post" onclick="createPost()">نشر</button>
</div>
</div>
<div id="feed"></div>
</div>
</div>

<script>
let currentUser = null;
let token = localStorage.getItem('token');

// ====== Auth ======
function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}
function showLogin() {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
}

async function register() {
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
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function login() {
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
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function logout() {
  localStorage.removeItem('token');
  location.reload();
}

function initApp() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadFeed();
}

// ====== Feed ======
async function loadFeed() {
  try {
    const res = await fetch('/api/posts/feed', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const posts = await res.json();
    const container = document.getElementById('feed');
    container.innerHTML = posts.map(p => \`
      <div class="card">
        <div class="post-header">
          <div class="avatar">\${p.user?.username?.[0] || '?'}</div>
          <div class="info">
            <div class="name">\${p.user?.username || 'مستخدم'}</div>
            <div class="time">\${new Date(p.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div>\${p.text}</div>
        \${p.image ? '<img src="'+p.image+'" class="post-image">' : ''}
        <div class="post-actions">
          <span><i class="fas fa-heart"></i> \${p.likes?.length || 0}</span>
        </div>
      </div>
    \`).join('');
  } catch (e) {
    console.error(e);
  }
}

async function createPost() {
  const text = document.getElementById('post-text').value;
  if (!text) return alert('اكتب نصاً');
  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      document.getElementById('post-text').value = '';
      loadFeed();
    } else {
      alert('فشل النشر');
    }
  } catch (e) {
    alert('Error');
  }
}

// ====== Start ======
if (token) {
  fetch('/api/users/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(user => {
    if (user && user.id) {
      currentUser = user;
      initApp();
    } else {
      localStorage.removeItem('token');
      location.reload();
    }
  })
  .catch(() => {
    localStorage.removeItem('token');
    location.reload();
  });
}
</script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('🚀 Server running on port ' + PORT);
});

// FaceLove Lite - Simple Social Platform (Works instantly)
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(session({
  secret: 'facelove_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// In-memory database (resets on restart, fine for testing)
const db = {
  users: [],
  posts: [],
  friendships: [],
  messages: []
};

// Helper
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 4); }

// ==================== ROUTES ====================

// Home
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove Lite</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .splash { text-align: center; animation: pulse 2s ease-in-out infinite; }
        .splash .logo {
          width: 100px; height: 100px;
          background: linear-gradient(145deg, #d4af37, #f9d976);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 0 60px rgba(212,175,55,0.3);
        }
        .splash .logo i { font-size: 50px; color: #0a0a0a; }
        .splash h1 {
          color: #fff;
          font-size: 40px;
          font-weight: 800;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .splash p { color: #888; font-size: 14px; letter-spacing: 3px; margin-top: 6px; }
        .loader {
          width: 40px; height: 40px; margin: 30px auto 0;
          border: 3px solid rgba(212,175,55,0.1);
          border-top: 3px solid #d4af37;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      </style>
    </head>
    <body>
      <div class="splash">
        <div class="logo"><i class="fas fa-crown"></i></div>
        <h1>FaceLove Lite</h1>
        <p>Simple & Fast</p>
        <div class="loader"></div>
      </div>
      <script>setTimeout(()=>{window.location.href='/login'},2000);</script>
    </body>
    </html>
  `);
});

// Login
app.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - FaceLove Lite</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth {
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid rgba(212,175,55,0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand { text-align: center; margin-bottom: 30px; }
        .auth .brand i { font-size: 35px; color: #d4af37; margin-bottom: 8px; }
        .auth .brand h1 { color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #666; font-size: 13px; }
        .auth .error {
          background: rgba(255,59,92,0.1);
          color: #ff6b6b;
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          display: ${error ? 'block' : 'none'};
        }
        .auth .form-group { margin-bottom: 14px; }
        .auth .form-group input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus { border-color: #d4af37; }
        .auth .btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 12px;
          color: #0a0a0a;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(212,175,55,0.3); }
        .auth .links {
          text-align: center;
          margin-top: 18px;
          color: #666;
          font-size: 13px;
        }
        .auth .links a { color: #d4af37; text-decoration: none; font-weight: 600; }
        .auth .links a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-crown"></i>
          <h1>Face<span>Love</span> Lite</h1>
          <p>Sign in to continue</p>
        </div>
        <div class="error">${error}</div>
        <form action="/login" method="POST">
          <div class="form-group">
            <input type="text" name="username" placeholder="Username" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create Account</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.redirect('/login?error=Invalid credentials');
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

// Register
app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register - FaceLove Lite</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth {
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid rgba(212,175,55,0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand { text-align: center; margin-bottom: 25px; }
        .auth .brand i { font-size: 35px; color: #d4af37; margin-bottom: 8px; }
        .auth .brand h1 { color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #666; font-size: 13px; }
        .auth .form-group { margin-bottom: 12px; }
        .auth .form-group input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus { border-color: #d4af37; }
        .auth .btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 12px;
          color: #0a0a0a;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(212,175,55,0.3); }
        .auth .links {
          text-align: center;
          margin-top: 16px;
          color: #666;
          font-size: 13px;
        }
        .auth .links a { color: #d4af37; text-decoration: none; font-weight: 600; }
        .auth .links a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-crown"></i>
          <h1>Face<span>Love</span> Lite</h1>
          <p>Create your account</p>
        </div>
        <form action="/register" method="POST">
          <div class="form-group">
            <input type="text" name="username" placeholder="Username" required>
          </div>
          <div class="form-group">
            <input type="text" name="phone" placeholder="Phone (optional)">
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password" required minlength="6">
          </div>
          <button type="submit" class="btn"><i class="fas fa-user-plus"></i> Create Account</button>
        </form>
        <div class="links">
          Have an account? <a href="/login">Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/register', (req, res) => {
  const { username, phone, password } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.send('<script>alert("Username taken"); window.location="/register";</script>');
  }
  const user = {
    id: 'u' + genId(),
    username,
    phone: phone || '',
    password,
    joined: new Date().toISOString(),
    bio: 'Welcome to FaceLove Lite!',
    role: 'user',
    gold: false,
    verified: false
  };
  db.users.push(user);
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

// Dashboard (main app)
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.redirect('/login');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove Lite</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          background: #0a0a0a;
          color: #e0e0e0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-bottom: 70px;
          padding-top: 60px;
        }
        .top-nav {
          position: fixed; top:0; left:0; right:0; height:55px;
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,175,55,0.1);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px; z-index:100;
        }
        .top-nav .brand { font-size: 18px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px; }
        .top-nav .brand i { color: #d4af37; }
        .top-nav .brand span { color: #d4af37; }
        .top-nav .actions { display: flex; align-items: center; gap: 12px; }
        .top-nav .actions .avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #0a0a0a;
        }
        .top-nav .actions a { color: #888; font-size: 18px; text-decoration: none; transition: 0.3s; }
        .top-nav .actions a:hover { color: #d4af37; }

        .bottom-nav {
          position: fixed; bottom:0; left:0; right:0; height:65px;
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(212,175,55,0.1);
          display: flex; justify-content: space-around; align-items: center;
          z-index:100;
        }
        .bottom-nav a {
          color: #555; font-size: 20px; text-decoration: none;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          transition: 0.3s; padding: 4px 10px;
        }
        .bottom-nav a span { font-size: 8px; color: #555; }
        .bottom-nav a:hover { color: #d4af37; }
        .bottom-nav a:hover span { color: #d4af37; }
        .bottom-nav a.active { color: #d4af37; }
        .bottom-nav a.active span { color: #d4af37; }

        .content { max-width: 700px; margin: 0 auto; padding: 0 12px; }
        .page { display: none; animation: fadeUp 0.3s ease; }
        .page.active { display: block; }
        @keyframes fadeUp { 0% { opacity:0; transform:translateY(15px); } 100% { opacity:1; transform:translateY(0); } }

        .card {
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 14px;
          border: 1px solid rgba(212,175,55,0.08);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .card .title { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
        .card .title i { color: #d4af37; margin-right: 6px; }

        .post-box textarea {
          width: 100%; padding: 12px 14px; background: rgba(30,30,30,0.6);
          border: 2px solid transparent; border-radius: 12px; color: #fff;
          font-size: 14px; font-family: inherit; resize: vertical; min-height: 60px;
          outline: none; transition: 0.3s;
        }
        .post-box textarea:focus { border-color: #d4af37; }
        .post-box .actions {
          display: flex; justify-content: flex-end; margin-top: 10px;
        }
        .post-box .actions .btn-post {
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none; padding: 8px 24px; border-radius: 30px;
          color: #0a0a0a; font-weight: 700; font-size: 13px; cursor: pointer;
          transition: 0.3s;
        }
        .post-box .actions .btn-post:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212,175,55,0.3); }

        .feed-post {
          background: rgba(20,20,20,0.8);
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 12px;
          border: 1px solid rgba(212,175,55,0.06);
        }
        .feed-post .header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .feed-post .header .avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #0a0a0a;
          flex-shrink: 0;
        }
        .feed-post .header .info { flex: 1; }
        .feed-post .header .info .name { font-weight: 700; font-size: 14px; color: #fff; }
        .feed-post .header .info .time { font-size: 11px; color: #666; }
        .feed-post .body { font-size: 14px; line-height: 1.6; margin: 4px 0 10px; }
        .feed-post .actions { display: flex; gap: 16px; padding-top: 8px; border-top: 1px solid rgba(212,175,55,0.06); }
        .feed-post .actions button {
          background: none; border: none; color: #777; font-size: 13px;
          cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 4px;
        }
        .feed-post .actions button:hover { color: #d4af37; }
        .feed-post .actions button.liked { color: #d4af37; }
        .feed-post .comments { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(212,175,55,0.06); }
        .feed-post .comments .comment { display: flex; gap: 8px; margin: 4px 0; font-size: 13px; }
        .feed-post .comments .comment .cname { font-weight: 700; color: #d4af37; }
        .feed-post .comments input {
          width: 100%; padding: 8px 12px; background: rgba(30,30,30,0.6);
          border: 2px solid transparent; border-radius: 30px; color: #fff;
          font-size: 13px; outline: none; margin-top: 6px; transition: 0.3s;
        }
        .feed-post .comments input:focus { border-color: #d4af37; }

        .friend-item {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 12px; background: rgba(30,30,30,0.4);
          border-radius: 12px; margin-bottom: 8px; cursor: pointer;
          transition: 0.3s;
        }
        .friend-item:hover { background: rgba(40,40,40,0.6); }
        .friend-item .avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #0a0a0a;
          flex-shrink: 0;
        }
        .friend-item .info { flex: 1; }
        .friend-item .info .name { font-weight: 600; font-size: 14px; color: #fff; }
        .friend-item .info .status { font-size: 11px; color: #666; }
        .friend-item .actions { display: flex; gap: 4px; flex-wrap: wrap; }
        .friend-item .actions .btn-sm {
          padding: 4px 12px; border: none; border-radius: 30px;
          font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        .friend-item .actions .btn-sm.primary { background: linear-gradient(135deg, #d4af37, #f9d976); color: #0a0a0a; }
        .friend-item .actions .btn-sm.primary:hover { transform: translateY(-2px); }
        .friend-item .actions .btn-sm.success { background: #27ae60; color: #fff; }
        .friend-item .actions .btn-sm.danger { background: #c0392b; color: #fff; }

        .chat-messages {
          background: rgba(30,30,30,0.3);
          border-radius: 12px; padding: 12px;
          max-height: 300px; overflow-y: auto; margin-bottom: 10px;
        }
        .chat-messages .msg { margin: 4px 0; padding: 6px 12px; border-radius: 8px; font-size: 13px; background: rgba(255,255,255,0.03); }
        .chat-messages .msg .sender { font-weight: 700; color: #d4af37; margin-right: 4px; }
        .chat-input { display: flex; gap: 8px; }
        .chat-input input {
          flex: 1; padding: 8px 14px; background: rgba(30,30,30,0.6);
          border: 2px solid transparent; border-radius: 30px; color: #fff;
          font-size: 13px; outline: none; transition: 0.3s;
        }
        .chat-input input:focus { border-color: #d4af37; }
        .chat-input button {
          padding: 8px 18px; background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none; border-radius: 30px; color: #0a0a0a; font-weight: 700;
          font-size: 13px; cursor: pointer; transition: 0.3s;
        }
        .chat-input button:hover { transform: translateY(-2px); }

        .admin-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;
        }
        .admin-stats .stat { background: rgba(30,30,30,0.4); padding: 10px; border-radius: 10px; text-align: center; }
        .admin-stats .stat .num { font-size: 18px; font-weight: 700; }
        .admin-stats .stat .label { font-size: 9px; color: #666; }
        .admin-stats .stat .num.primary { color: #d4af37; }
        .admin-stats .stat .num.green { color: #27ae60; }
        .admin-stats .stat .num.blue { color: #3498db; }
        .admin-stats .stat .num.gold { color: #d4af37; }

        .admin-item {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 0; border-bottom: 1px solid rgba(212,175,55,0.05);
        }
        .admin-item .info { flex: 1; }
        .admin-item .info .name { font-weight: 600; font-size: 13px; color: #fff; }
        .admin-item .info .sub { font-size: 10px; color: #666; }
        .admin-item .badge {
          font-size: 9px; padding: 2px 8px; border-radius: 20px; font-weight: 600;
        }
        .admin-item .badge.active { background: rgba(39,174,96,0.2); color: #27ae60; }
        .admin-item .badge.inactive { background: rgba(192,57,43,0.2); color: #e74c3c; }
        .admin-item .badge.gold { background: rgba(212,175,55,0.2); color: #d4af37; }
        .admin-item .actions { display: flex; gap: 4px; flex-wrap: wrap; }
        .admin-item .actions .btn-xs {
          padding: 2px 8px; border: none; border-radius: 20px;
          font-size: 9px; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        .admin-item .actions .btn-xs.danger { background: #c0392b; color: #fff; }
        .admin-item .actions .btn-xs.success { background: #27ae60; color: #fff; }
        .admin-item .actions .btn-xs.gold { background: #d4af37; color: #0a0a0a; }

        .empty { text-align: center; padding: 30px 0; color: #666; }
        .empty i { font-size: 30px; display: block; margin-bottom: 6px; opacity: 0.3; }

        .profile-header { text-align: center; padding: 10px 0; }
        .profile-header .avatar {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: 700; color: #0a0a0a;
          margin: 0 auto 10px;
        }
        .profile-header .name { font-size: 20px; font-weight: 700; color: #fff; }
        .profile-header .bio { color: #888; font-size: 13px; margin-top: 4px; }
        .profile-header .stats { display: flex; justify-content: center; gap: 24px; margin-top: 12px; }
        .profile-header .stats .stat { text-align: center; }
        .profile-header .stats .stat .num { font-size: 16px; font-weight: 700; color: #fff; }
        .profile-header .stats .stat .label { font-size: 10px; color: #666; }
        .profile-header .edit-btn {
          margin-top: 12px; padding: 6px 20px; background: rgba(30,30,30,0.6);
          border: 1px solid rgba(212,175,55,0.2); border-radius: 30px;
          color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
          transition: 0.3s;
        }
        .profile-header .edit-btn:hover { border-color: #d4af37; }

        @media (max-width: 480px) { .admin-stats { grid-template-columns: repeat(2, 1fr); } }
      </style>
    </head>
    <body>
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-crown"></i>Face<span>Love</span> Lite</div>
        <div class="actions">
          <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
          <a href="/logout"><i class="fas fa-sign-out-alt"></i></a>
        </div>
      </nav>

      <div class="content">
        <!-- Feed -->
        <div id="page-feed" class="page active">
          <div class="card post-box">
            <textarea id="postText" placeholder="What's on your mind?" rows="2"></textarea>
            <div class="actions">
              <button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> Post</button>
            </div>
          </div>
          <div id="feedContainer"></div>
        </div>

        <!-- Profile -->
        <div id="page-profile" class="page">
          <div class="card">
            <div class="profile-header">
              <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
              <div class="name">${user.username}</div>
              <div class="bio">${user.bio || 'Welcome to FaceLove Lite!'}</div>
              <div class="stats">
                <div class="stat"><div class="num" id="postCount">0</div><div class="label">Posts</div></div>
                <div class="stat"><div class="num" id="friendCount">0</div><div class="label">Friends</div></div>
                <div class="stat"><div class="num" id="likeCount">0</div><div class="label">Likes</div></div>
              </div>
              <button class="edit-btn" onclick="editProfile()"><i class="fas fa-edit"></i> Edit</button>
            </div>
          </div>
          <div id="profilePosts"></div>
        </div>

        <!-- Friends -->
        <div id="page-friends" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-user-friends"></i> Friends</div>
            <div id="friendsList"></div>
          </div>
          <div class="card">
            <div class="title"><i class="fas fa-handshake"></i> Requests</div>
            <div id="friendRequests"></div>
          </div>
          <div class="card">
            <div class="title"><i class="fas fa-user-plus"></i> Suggested</div>
            <div id="suggestedUsers"></div>
          </div>
        </div>

        <!-- Chat -->
        <div id="page-chat" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-comments"></i> Chats</div>
            <div id="chatList"></div>
            <div id="chatDetail" style="display:none;">
              <div id="chatMessages" class="chat-messages"></div>
              <div class="chat-input">
                <input type="text" id="chatInput" placeholder="Message..." onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
              </div>
              <button onclick="closeChat()" style="margin-top:6px;background:none;border:none;color:#d4af37;cursor:pointer;font-size:12px;"><i class="fas fa-arrow-left"></i> Back</button>
            </div>
          </div>
        </div>

        <!-- Admin -->
        <div id="page-admin" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-crown"></i> Admin Dashboard</div>
            <div id="adminStats" class="admin-stats"></div>
            <div id="adminContent"></div>
          </div>
        </div>
      </div>

      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>Feed</span></a>
        <a href="#" data-page="profile"><i class="fas fa-user"></i><span>Profile</span></a>
        <a href="#" data-page="friends"><i class="fas fa-users"></i><span>Friends</span></a>
        <a href="#" data-page="chat"><i class="fas fa-comment-dots"></i><span>Chat</span></a>
        ${user.role === 'admin' ? '<a href="#" data-page="admin"><i class="fas fa-crown"></i><span>Admin</span></a>' : ''}
      </nav>

      <script>
        const currentUser = { id: "${user.id}", username: "${user.username}", role: "${user.role || 'user'}" };
        let currentChatWith = null;

        // Navigation
        document.querySelectorAll('.bottom-nav a[data-page]').forEach(el => {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + page).classList.add('active');
            document.querySelectorAll('.bottom-nav a[data-page]').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            if (page === 'feed') loadFeed();
            if (page === 'friends') loadFriends();
            if (page === 'chat') loadChatList();
            if (page === 'admin' && currentUser.role === 'admin') loadAdmin();
            if (page === 'profile') loadProfile();
          });
        });

        // ========== FEED ==========
        async function loadFeed() {
          try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            document.getElementById('feedContainer').innerHTML = posts.length ?
              posts.map(p => renderPost(p)).join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>No posts yet</p></div>';
          } catch(e) { console.error(e); }
        }

        function renderPost(p) {
          const liked = p.likes && p.likes.includes(currentUser.id);
          return \`
            <div class="feed-post">
              <div class="header">
                <div class="avatar">\${p.userName ? p.userName.charAt(0).toUpperCase() : '?'}</div>
                <div class="info">
                  <div class="name">\${p.userName || 'User'}</div>
                  <div class="time"><i class="far fa-clock"></i> \${new Date(p.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <div class="body">\${p.text || ''}</div>
              <div class="actions">
                <button onclick="toggleLike('\${p.id}')" class="\${liked ? 'liked' : ''}">
                  <i class="\${liked ? 'fas' : 'far'} fa-heart"></i> <span>\${p.likes ? p.likes.length : 0}</span>
                </button>
                <button onclick="toggleComments('\${p.id}')">
                  <i class="far fa-comment"></i> <span>\${p.comments ? p.comments.length : 0}</span>
                </button>
              </div>
              <div class="comments" id="comments-\${p.id}" style="display:none;">
                \${(p.comments || []).map(c =>
                  '<div class="comment"><span class="cname">'+c.userName+':</span> <span class="ctext">'+c.text+'</span></div>'
                ).join('')}
                <input type="text" placeholder="Comment..." onkeypress="if(event.key==='Enter') addComment('\${p.id}', this.value); this.value='';">
              </div>
            </div>
          \`;
        }

        async function createPost() {
          const text = document.getElementById('postText').value;
          if (!text) return alert('Please enter text');
          try {
            await fetch('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            document.getElementById('postText').value = '';
            loadFeed();
          } catch(e) { alert('Failed to create post'); }
        }

        async function toggleLike(postId) {
          try {
            await fetch('/api/posts/'+postId+'/like', { method: 'POST' });
            loadFeed();
          } catch(e) { console.error(e); }
        }

        function toggleComments(postId) {
          const el = document.getElementById('comments-'+postId);
          el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }

        async function addComment(postId, text) {
          if (!text.trim()) return;
          try {
            await fetch('/api/posts/'+postId+'/comment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            loadFeed();
          } catch(e) { alert('Failed to add comment'); }
        }

        // ========== PROFILE ==========
        async function loadProfile() {
          try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            document.getElementById('postCount').textContent = data.posts || 0;
            document.getElementById('friendCount').textContent = data.friends || 0;
            document.getElementById('likeCount').textContent = data.likes || 0;
            document.getElementById('profilePosts').innerHTML = data.userPosts && data.userPosts.length ?
              data.userPosts.map(p => renderPost(p)).join('') :
              '<div class="empty"><i class="fas fa-camera"></i><p>No posts yet</p></div>';
          } catch(e) { console.error(e); }
        }

        function editProfile() {
          const newBio = prompt('Update your bio:', '${user.bio || 'Welcome to FaceLove Lite!'}');
          if (newBio !== null) {
            fetch('/api/profile/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bio: newBio })
            }).then(() => location.reload());
          }
        }

        // ========== FRIENDS ==========
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            document.getElementById('friendsList').innerHTML = data.friends.length ?
              data.friends.map(f => '<div class="friend-item"><div class="avatar">'+f.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+f.username+'</div><div class="status">Friend</div></div></div>').join('') :
              '<div class="empty"><i class="fas fa-user-friends"></i><p>No friends</p></div>';
            document.getElementById('friendRequests').innerHTML = data.requests.length ?
              data.requests.map(r => '<div class="friend-item"><div class="avatar">'+r.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+r.username+'</div><div class="status">Pending</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')">Accept</button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')">Decline</button></div></div>').join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>No requests</p></div>';
            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ?
              data.suggested.map(u => '<div class="friend-item"><div class="avatar">'+u.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.username+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')">Add</button></div></div>').join('') :
              '<div class="empty"><i class="fas fa-check"></i><p>All caught up</p></div>';
          } catch(e) { console.error(e); }
        }

        async function sendFriendRequest(userId) {
          try {
            await fetch('/api/friend-request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ toUserId: userId })
            });
            loadFriends();
          } catch(e) { alert('Failed to send request'); }
        }

        async function acceptFriend(userId) {
          try {
            await fetch('/api/friend-accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromUserId: userId })
            });
            loadFriends();
          } catch(e) { alert('Failed to accept'); }
        }

        async function rejectFriend(userId) {
          try {
            await fetch('/api/friend-reject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromUserId: userId })
            });
            loadFriends();
          } catch(e) { alert('Failed to reject'); }
        }

        // ========== CHAT ==========
        async function loadChatList() {
          try {
            const res = await fetch('/api/chat/list');
            const data = await res.json();
            document.getElementById('chatList').innerHTML = data.length ?
              data.map(u => '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.username+'</div><div class="status">Click to chat</div></div></div>').join('') :
              '<div class="empty"><i class="fas fa-comment-slash"></i><p>No chats</p></div>';
            document.getElementById('chatDetail').style.display = 'none';
          } catch(e) { console.error(e); }
        }

        async function openChat(userId) {
          currentChatWith = userId;
          document.getElementById('chatDetail').style.display = 'block';
          document.getElementById('chatList').style.display = 'none';
          await loadMessages(userId);
        }

        async function loadMessages(userId) {
          try {
            const res = await fetch('/api/chat/messages/'+userId);
            const msgs = await res.json();
            document.getElementById('chatMessages').innerHTML = msgs.length ?
              msgs.map(m => '<div class="msg"><span class="sender">'+m.senderName+':</span> <span class="text">'+m.text+'</span></div>').join('') :
              '<div class="empty" style="padding:15px 0;"><i class="fas fa-comment-dots"></i><p>No messages</p></div>';
          } catch(e) { console.error(e); }
        }

        async function sendChatMessage() {
          const input = document.getElementById('chatInput');
          const text = input.value.trim();
          if (!text || !currentChatWith) return;
          try {
            await fetch('/api/chat/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ toUserId: currentChatWith, text })
            });
            input.value = '';
            loadMessages(currentChatWith);
          } catch(e) { alert('Failed to send'); }
        }

        function closeChat() {
          document.getElementById('chatDetail').style.display = 'none';
          document.getElementById('chatList').style.display = 'block';
        }

        // ========== ADMIN ==========
        async function loadAdmin() {
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            document.getElementById('adminStats').innerHTML = \`
              <div class="stat"><div class="num primary">\${data.stats.totalUsers}</div><div class="label">Users</div></div>
              <div class="stat"><div class="num green">\${data.stats.totalPosts}</div><div class="label">Posts</div></div>
              <div class="stat"><div class="num blue">\${data.stats.totalLikes}</div><div class="label">Likes</div></div>
              <div class="stat"><div class="num gold">\${data.stats.activeUsers}</div><div class="label">Active</div></div>
            \`;
            let html = '';
            data.users.forEach(u => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+u.username+'</div><div class="sub">'+u.phone+'</div></div><div class="badge '+(u.active !== false ? 'active' : 'inactive')+'">'+(u.active !== false ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs '+(u.active !== false ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active !== false ? 'false' : 'true')+')">'+(u.active !== false ? 'Deactivate' : 'Activate')+'</button></div></div>';
            });
            html += '<div style="margin:10px 0 4px;"><strong style="color:#d4af37;">Posts</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+p.text.substring(0,30)+(p.text.length>30?'...':'')+'</div><div class="sub">by '+p.userName+'</div></div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">Delete</button></div></div>';
            });
            if (!data.posts.length) html += '<div class="empty"><i class="fas fa-inbox"></i><p>No posts</p></div>';
            document.getElementById('adminContent').innerHTML = html;
          } catch(e) { console.error(e); }
        }

        async function adminToggleUser(userId, active) {
          try {
            await fetch('/api/admin/user-toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, active })
            });
            loadAdmin();
          } catch(e) { alert('Failed to toggle'); }
        }

        async function adminDeletePost(postId) {
          if (!confirm('Delete this post?')) return;
          try {
            await fetch('/api/admin/post-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId })
            });
            loadAdmin();
          } catch(e) { alert('Failed to delete'); }
        }

        // ========== INIT ==========
        loadFeed();
        setInterval(loadFeed, 30000);
      </script>
    </body>
    </html>
  `);
});

// ========== LOGOUT ==========
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ========== API ROUTES ==========

// Posts
app.get('/api/posts', (req, res) => {
  const posts = db.posts.sort((a,b) => b.timestamp - a.timestamp);
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return { ...p, userName: user ? user.username : 'User' };
  });
  res.json(enriched);
});

app.post('/api/posts', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  const post = {
    id: 'p' + genId(),
    userId: req.session.userId,
    text: text || '',
    timestamp: Date.now(),
    likes: [],
    comments: []
  };
  db.posts.push(post);
  res.json({ success: true });
});

app.post('/api/posts/:postId/like', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const idx = post.likes.indexOf(req.session.userId);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(req.session.userId);
  res.json({ success: true });
});

app.post('/api/posts/:postId/comment', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const user = db.users.find(u => u.id === req.session.userId);
  post.comments.push({
    userId: req.session.userId,
    userName: user ? user.username : 'User',
    text: text,
    timestamp: Date.now()
  });
  res.json({ success: true });
});

// Profile
app.get('/api/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const userPosts = db.posts.filter(p => p.userId === req.session.userId);
  const friends = db.friendships.filter(f =>
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  );
  const totalLikes = userPosts.reduce((acc, p) => acc + (p.likes ? p.likes.length : 0), 0);
  res.json({
    user: user,
    posts: userPosts.length,
    friends: friends.length,
    likes: totalLikes,
    userPosts: userPosts.sort((a,b) => b.timestamp - a.timestamp)
  });
});

app.post('/api/profile/update', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { bio } = req.body;
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (bio !== undefined) user.bio = bio;
  res.json({ success: true });
});

// Friends
app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const friendsIds = db.friendships.filter(f =>
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const friends = db.users.filter(u => friendsIds.includes(u.id) && u.active !== false);
  const requests = db.friendships.filter(f => f.toUserId === req.session.userId && f.status === 'pending')
    .map(f => db.users.find(u => u.id === f.fromUserId)).filter(Boolean);
  const existing = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId));
  const existingIds = existing.map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const suggested = db.users.filter(u => u.id !== req.session.userId &&
    !existingIds.includes(u.id) && !requests.find(r => r.id === u.id));
  res.json({ friends, requests, suggested });
});

app.post('/api/friend-request', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId } = req.body;
  if (toUserId === req.session.userId) return res.status(400).json({ error: 'Cannot add yourself' });
  const exists = db.friendships.find(f =>
    (f.fromUserId === req.session.userId && f.toUserId === toUserId) ||
    (f.fromUserId === toUserId && f.toUserId === req.session.userId)
  );
  if (exists) return res.status(400).json({ error: 'Request already exists' });
  db.friendships.push({
    id: 'f' + genId(),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    status: 'pending'
  });
  res.json({ success: true });
});

app.post('/api/friend-accept', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const friendship = db.friendships.find(f =>
    f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending'
  );
  if (!friendship) return res.status(404).json({ error: 'Not found' });
  friendship.status = 'accepted';
  res.json({ success: true });
});

app.post('/api/friend-reject', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const idx = db.friendships.findIndex(f =>
    f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending'
  );
  if (idx > -1) { db.friendships.splice(idx, 1); }
  res.json({ success: true });
});

// Chat
app.get('/api/chat/list', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  // Get friends + anyone with messages
  const friendsIds = db.friendships.filter(f =>
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const msgUsers = db.messages.filter(m =>
    m.fromUserId === req.session.userId || m.toUserId === req.session.userId
  ).map(m => m.fromUserId === req.session.userId ? m.toUserId : m.fromUserId);
  const allIds = [...new Set([...friendsIds, ...msgUsers])];
  const users = db.users.filter(u => allIds.includes(u.id) && u.id !== req.session.userId);
  res.json(users);
});

app.get('/api/chat/messages/:userId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const msgs = db.messages.filter(m =>
    (m.fromUserId === req.session.userId && m.toUserId === userId) ||
    (m.fromUserId === userId && m.toUserId === req.session.userId)
  ).sort((a,b) => a.timestamp - b.timestamp);
  const enriched = msgs.map(m => {
    const sender = db.users.find(u => u.id === m.fromUserId);
    return { ...m, senderName: sender ? sender.username : 'User' };
  });
  res.json(enriched);
});

app.post('/api/chat/send', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId, text } = req.body;
  db.messages.push({
    id: 'm' + genId(),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    text: text,
    timestamp: Date.now()
  });
  res.json({ success: true });
});

// Admin
app.get('/api/admin/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const stats = {
    totalUsers: db.users.length,
    totalPosts: db.posts.length,
    totalLikes: db.posts.reduce((acc, p) => acc + (p.likes ? p.likes.length : 0), 0),
    activeUsers: new Set(db.posts.map(p => p.userId)).size
  };
  const users = db.users;
  const posts = db.posts.map(p => {
    const u = db.users.find(usr => usr.id === p.userId);
    return { ...p, userName: u ? u.username : 'Deleted' };
  });
  res.json({ stats, users, posts });
});

app.post('/api/admin/user-toggle', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { userId, active } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.active = active;
  res.json({ success: true });
});

app.post('/api/admin/post-delete', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { postId } = req.body;
  db.posts = db.posts.filter(p => p.id !== postId);
  res.json({ success: true });
});

// ========== START ==========
app.listen(PORT, () => {
  console.log('✅ FaceLove Lite running on port ' + PORT);
  console.log('🌐 Visit http://localhost:' + PORT);
});

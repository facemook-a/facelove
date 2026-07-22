// FaceLove - Ultra Simple Version
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: 'facelove_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], posts: [], friendships: [], messages: [] }, null, 2));
}

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch(e) { return { users: [], posts: [], friendships: [], messages: [] }; }
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function genId() { return Date.now() + Math.random().toString(36).substr(2, 6); }

// Home
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;}
        .splash{text-align:center;}
        .logo{width:100px;height:100px;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);border-radius:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 0 60px rgba(255,59,92,0.3);}
        .logo i{font-size:44px;color:#fff;}
        h1{font-size:40px;font-weight:800;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        p{color:#666;font-size:14px;letter-spacing:3px;margin-top:6px;}
        .loader{width:40px;height:40px;margin:30px auto 0;border:3px solid rgba(255,59,92,0.1);border-top:3px solid #ff3b5c;border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{100%{transform:rotate(360deg)}}
      </style>
    </head>
    <body>
      <div class="splash">
        <div class="logo"><i class="fas fa-heart"></i></div>
        <h1>FaceLove</h1>
        <p>Share • Connect • Inspire</p>
        <div class="loader"></div>
      </div>
      <script>setTimeout(()=>{window.location.href='/login'},2500);</script>
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
      <title>FaceLove - Login</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;padding:20px;}
        .auth{background:#141414;border-radius:24px;padding:40px 30px;width:100%;max-width:400px;border:1px solid #1f1f1f;}
        .brand{text-align:center;margin-bottom:30px;}
        .brand i{font-size:32px;color:#ff3b5c;margin-bottom:8px;}
        .brand h1{color:#fff;font-size:26px;font-weight:700;}
        .brand h1 span{color:#ff3b5c;}
        .brand p{color:#666;font-size:13px;}
        .error{background:rgba(255,59,92,0.1);color:#ff6b6b;padding:10px 14px;border-radius:10px;margin-bottom:16px;font-size:13px;display:${error?'block':'none'};}
        .form-group{margin-bottom:14px;}
        .form-group input{width:100%;padding:14px 16px;background:#1a1a1a;border:2px solid transparent;border-radius:12px;color:#fff;font-size:15px;outline:none;}
        .form-group input:focus{border-color:#ff3b5c;}
        .btn{width:100%;padding:14px;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;}
        .btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(255,59,92,0.3);}
        .links{text-align:center;margin-top:18px;color:#666;font-size:13px;}
        .links a{color:#ff3b5c;text-decoration:none;font-weight:600;}
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand"><i class="fas fa-heart"></i><h1>Face<span>Love</span></h1><p>Sign in to continue</p></div>
        <div class="error">${error}</div>
        <form action="/login" method="POST">
          <div class="form-group"><input type="text" name="username" placeholder="Username" required></div>
          <div class="form-group"><input type="password" name="password" placeholder="Password" required></div>
          <button type="submit" class="btn"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        </form>
        <div class="links"><a href="/register">Create Account</a></div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
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
      <title>FaceLove - Register</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;padding:20px;}
        .auth{background:#141414;border-radius:24px;padding:40px 30px;width:100%;max-width:400px;border:1px solid #1f1f1f;}
        .brand{text-align:center;margin-bottom:25px;}
        .brand i{font-size:32px;color:#ff3b5c;margin-bottom:8px;}
        .brand h1{color:#fff;font-size:26px;font-weight:700;}
        .brand h1 span{color:#ff3b5c;}
        .brand p{color:#666;font-size:13px;}
        .form-group{margin-bottom:12px;}
        .form-group input{width:100%;padding:14px 16px;background:#1a1a1a;border:2px solid transparent;border-radius:12px;color:#fff;font-size:15px;outline:none;}
        .form-group input:focus{border-color:#ff3b5c;}
        .btn{width:100%;padding:14px;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;}
        .btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(255,59,92,0.3);}
        .links{text-align:center;margin-top:16px;color:#666;font-size:13px;}
        .links a{color:#ff3b5c;text-decoration:none;font-weight:600;}
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand"><i class="fas fa-heart"></i><h1>Face<span>Love</span></h1><p>Create your account</p></div>
        <form action="/register" method="POST">
          <div class="form-group"><input type="text" name="username" placeholder="Username" required></div>
          <div class="form-group"><input type="text" name="phone" placeholder="Phone (optional)"></div>
          <div class="form-group"><input type="password" name="password" placeholder="Password" required minlength="6"></div>
          <button type="submit" class="btn"><i class="fas fa-user-plus"></i> Create Account</button>
        </form>
        <div class="links">Have an account? <a href="/login">Sign In</a></div>
      </div>
    </body>
    </html>
  `);
});

app.post('/register', (req, res) => {
  const { username, phone, password } = req.body;
  const db = readDB();
  if (db.users.find(u => u.username === username)) {
    return res.send('<script>alert("Username taken"); window.location="/register";</script>');
  }
  const newUser = {
    id: 'u' + genId(),
    username,
    phone: phone || '',
    password,
    joined: new Date().toISOString(),
    bio: 'Welcome to FaceLove!',
    role: 'user'
  };
  db.users.push(newUser);
  writeDB(db);
  req.session.userId = newUser.id;
  res.redirect('/dashboard');
});

// Dashboard (minimal)
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.redirect('/login');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0a0a0a;color:#fff;font-family:sans-serif;padding-bottom:70px;padding-top:60px;}
        .top-nav{position:fixed;top:0;left:0;right:0;height:55px;background:rgba(10,10,10,0.95);border-bottom:1px solid #1f1f1f;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:100;}
        .top-nav .brand{font-size:18px;font-weight:800;}
        .top-nav .brand i{color:#ff3b5c;margin-right:6px;}
        .top-nav .brand span{color:#ff3b5c;}
        .top-nav a{color:#888;font-size:16px;text-decoration:none;}
        .top-nav a:hover{color:#fff;}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;height:60px;background:rgba(10,10,10,0.97);border-top:1px solid #1f1f1f;display:flex;justify-content:space-around;align-items:center;z-index:100;}
        .bottom-nav a{color:#555;font-size:18px;text-decoration:none;text-align:center;}
        .bottom-nav a span{display:block;font-size:8px;color:#555;margin-top:2px;}
        .bottom-nav a.active{color:#ff3b5c;}
        .bottom-nav a.active span{color:#ff3b5c;}
        .content{max-width:700px;margin:0 auto;padding:0 12px;}
        .page{display:none;}
        .page.active{display:block;}
        .card{background:#141414;border-radius:14px;padding:14px 16px;margin-bottom:12px;border:1px solid #1f1f1f;}
        .card .title{font-size:14px;font-weight:700;margin-bottom:10px;}
        .card .title i{color:#ff3b5c;margin-right:6px;}
        .post-box textarea{width:100%;padding:10px 14px;background:#1a1a1a;border:2px solid transparent;border-radius:10px;color:#fff;font-size:14px;font-family:inherit;resize:vertical;min-height:50px;outline:none;}
        .post-box textarea:focus{border-color:#ff3b5c;}
        .post-box .actions{display:flex;justify-content:flex-end;margin-top:8px;}
        .post-box .actions .btn-post{background:linear-gradient(135deg,#ff3b5c,#ff6b8a);border:none;padding:6px 18px;border-radius:30px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;}
        .feed-post{background:#141414;border-radius:14px;padding:12px 14px;margin-bottom:10px;border:1px solid #1f1f1f;}
        .feed-post .header{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
        .feed-post .header .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;}
        .feed-post .header .info{flex:1;}
        .feed-post .header .info .name{font-weight:700;font-size:13px;}
        .feed-post .header .info .time{font-size:10px;color:#555;}
        .feed-post .body{font-size:13px;line-height:1.5;margin:4px 0 8px;}
        .feed-post .actions{display:flex;gap:14px;padding-top:6px;border-top:1px solid #1f1f1f;}
        .feed-post .actions button{background:none;border:none;color:#555;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}
        .feed-post .actions button:hover{color:#fff;}
        .feed-post .actions button.liked{color:#ff3b5c;}
        .feed-post .comments{margin-top:8px;padding-top:8px;border-top:1px solid #1f1f1f;}
        .feed-post .comments .comment{display:flex;gap:6px;margin:3px 0;font-size:12px;}
        .feed-post .comments .comment .cname{font-weight:700;color:#ff3b5c;}
        .feed-post .comments input{width:100%;padding:6px 12px;background:#1a1a1a;border:2px solid transparent;border-radius:30px;color:#fff;font-size:12px;outline:none;margin-top:4px;}
        .feed-post .comments input:focus{border-color:#ff3b5c;}
        .friend-item{display:flex;align-items:center;gap:10px;padding:6px 10px;background:#1a1a1a;border-radius:10px;margin-bottom:6px;cursor:pointer;}
        .friend-item .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex-shrink:0;}
        .friend-item .info{flex:1;}
        .friend-item .info .name{font-weight:600;font-size:13px;}
        .friend-item .info .status{font-size:10px;color:#555;}
        .friend-item .actions .btn-sm{padding:3px 10px;border:none;border-radius:30px;font-size:10px;font-weight:600;cursor:pointer;}
        .friend-item .actions .btn-sm.primary{background:#ff3b5c;color:#fff;}
        .friend-item .actions .btn-sm.primary:hover{background:#e63050;}
        .friend-item .actions .btn-sm.success{background:#27ae60;color:#fff;}
        .friend-item .actions .btn-sm.danger{background:#c0392b;color:#fff;}
        .chat-messages{background:#1a1a1a;border-radius:10px;padding:10px;max-height:250px;overflow-y:auto;margin-bottom:6px;}
        .chat-messages .msg{margin:2px 0;padding:3px 8px;border-radius:6px;font-size:12px;}
        .chat-messages .msg .sender{font-weight:700;color:#ff3b5c;margin-right:4px;}
        .chat-input{display:flex;gap:6px;}
        .chat-input input{flex:1;padding:6px 12px;background:#1a1a1a;border:2px solid transparent;border-radius:30px;color:#fff;font-size:12px;outline:none;}
        .chat-input input:focus{border-color:#ff3b5c;}
        .chat-input button{padding:6px 14px;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);border:none;border-radius:30px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;}
        .empty{text-align:center;padding:20px 0;color:#555;}
        .empty i{font-size:28px;display:block;margin-bottom:6px;opacity:0.3;}
        .profile-header{text-align:center;padding:10px 0;}
        .profile-header .avatar{width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#ff3b5c,#ff6b8a);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;margin:0 auto 8px;}
        .profile-header .name{font-size:18px;font-weight:700;}
        .profile-header .bio{color:#888;font-size:12px;margin-top:4px;}
        .profile-header .stats{display:flex;justify-content:center;gap:20px;margin-top:10px;}
        .profile-header .stats .stat{text-align:center;}
        .profile-header .stats .stat .num{font-size:14px;font-weight:700;}
        .profile-header .stats .stat .label{font-size:9px;color:#555;}
        .profile-header .edit-btn{margin-top:10px;padding:5px 16px;background:#1a1a1a;border:1px solid #1f1f1f;border-radius:30px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;}
        .admin-item{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #1f1f1f;}
        .admin-item .info{flex:1;}
        .admin-item .info .name{font-weight:600;font-size:12px;}
        .admin-item .info .sub{font-size:9px;color:#555;}
        .admin-item .badge{font-size:8px;padding:2px 6px;border-radius:20px;font-weight:600;}
        .admin-item .badge.active{background:rgba(39,174,96,0.2);color:#27ae60;}
        .admin-item .badge.inactive{background:rgba(192,57,43,0.2);color:#e74c3c;}
        .admin-item .actions .btn-xs{padding:2px 6px;border:none;border-radius:20px;font-size:8px;font-weight:600;cursor:pointer;}
        .admin-item .actions .btn-xs.danger{background:#c0392b;color:#fff;}
        .admin-item .actions .btn-xs.success{background:#27ae60;color:#fff;}
        .admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;}
        .admin-stats .stat{background:#1a1a1a;padding:8px;border-radius:8px;text-align:center;}
        .admin-stats .stat .num{font-size:16px;font-weight:700;}
        .admin-stats .stat .label{font-size:8px;color:#555;}
        .admin-stats .stat .num.primary{color:#ff3b5c;}
        .admin-stats .stat .num.green{color:#27ae60;}
        .admin-stats .stat .num.blue{color:#3498db;}
        .admin-stats .stat .num.gold{color:#f1c40f;}
      </style>
    </head>
    <body>
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-heart"></i>Face<span>Love</span></div>
        <a href="/logout"><i class="fas fa-sign-out-alt"></i></a>
      </nav>
      <div class="content">
        <div id="page-feed" class="page active">
          <div class="card post-box">
            <textarea id="postText" placeholder="What's on your mind?" rows="2"></textarea>
            <div class="actions"><button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> Post</button></div>
          </div>
          <div id="feedContainer"></div>
        </div>
        <div id="page-friends" class="page"><div class="card"><div class="title"><i class="fas fa-user-friends"></i> Friends</div><div id="friendsList"></div></div><div class="card"><div class="title"><i class="fas fa-handshake"></i> Requests</div><div id="friendRequests"></div></div><div class="card"><div class="title"><i class="fas fa-user-plus"></i> Suggested</div><div id="suggestedUsers"></div></div></div>
        <div id="page-chat" class="page"><div class="card"><div class="title"><i class="fas fa-comments"></i> Chats</div><div id="chatList"></div><div id="chatDetail" style="display:none;"><div id="chatMessages" class="chat-messages"></div><div class="chat-input"><input type="text" id="chatInput" placeholder="Message..." onkeypress="if(event.key==='Enter') sendChatMessage()"><button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button></div><button onclick="closeChat()" style="margin-top:4px;background:none;border:none;color:#ff3b5c;cursor:pointer;font-size:11px;"><i class="fas fa-arrow-left"></i> Back</button></div></div></div>
        <div id="page-profile" class="page"><div class="card"><div class="profile-header"><div class="avatar">${user.username.charAt(0).toUpperCase()}</div><div class="name">@${user.username}</div><div class="bio">${user.bio || 'Welcome!'}</div><div class="stats"><div class="stat"><div class="num" id="postCount">0</div><div class="label">Posts</div></div><div class="stat"><div class="num" id="friendCount">0</div><div class="label">Friends</div></div><div class="stat"><div class="num" id="likeCount">0</div><div class="label">Likes</div></div></div><button class="edit-btn" onclick="editProfile()"><i class="fas fa-edit"></i> Edit</button></div></div><div id="profilePosts"></div></div>
        <div id="page-admin" class="page"><div class="card"><div class="title"><i class="fas fa-crown"></i> Admin</div><div id="adminStats" class="admin-stats"></div><div id="adminContent"></div></div></div>
      </div>
      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>Feed</span></a>
        <a href="#" data-page="friends"><i class="fas fa-users"></i><span>Friends</span></a>
        <a href="#" data-page="chat"><i class="fas fa-comment-dots"></i><span>Chat</span></a>
        <a href="#" data-page="profile"><i class="fas fa-user"></i><span>Profile</span></a>
        ${user.role === 'admin' ? '<a href="#" data-page="admin"><i class="fas fa-crown"></i><span>Admin</span></a>' : ''}
      </nav>
      <script>
        const currentUser = { id: "${user.id}", username: "${user.username}", role: "${user.role || 'user'}" };
        let currentChatWith = null;

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

        async function loadFeed() {
          try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            document.getElementById('feedContainer').innerHTML = posts.length ? posts.map(p => renderPost(p)).join('') : '<div class="empty"><i class="fas fa-inbox"></i><p>No posts yet</p></div>';
          } catch(e) { console.error(e); }
        }
        function renderPost(p) {
          const liked = p.likes && p.likes.includes(currentUser.id);
          return '<div class="feed-post"><div class="header"><div class="avatar">' + (p.userName ? p.userName.charAt(0).toUpperCase() : '?') + '</div><div class="info"><div class="name">' + (p.userName || 'User') + '</div><div class="time"><i class="far fa-clock"></i> ' + new Date(p.timestamp).toLocaleString() + '</div></div></div><div class="body">' + (p.text || '') + '</div><div class="actions"><button onclick="toggleLike(\'' + p.id + '\')" class="' + (liked ? 'liked' : '') + '"><i class="' + (liked ? 'fas' : 'far') + ' fa-heart"></i> <span>' + (p.likes ? p.likes.length : 0) + '</span></button><button onclick="toggleComments(\'' + p.id + '\')"><i class="far fa-comment"></i> <span>' + (p.comments ? p.comments.length : 0) + '</span></button></div><div class="comments" id="comments-' + p.id + '" style="display:none;">' + (p.comments || []).map(c => '<div class="comment"><span class="cname">'+c.userName+':</span> <span class="ctext">'+c.text+'</span></div>').join('') + '<input type="text" placeholder="Comment..." onkeypress="if(event.key===\'Enter\') addComment(\'' + p.id + '\', this.value); this.value=\'\';"></div></div>';
        }
        async function createPost() {
          const text = document.getElementById('postText').value;
          if (!text) return alert('Please enter some text');
          try {
            await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            document.getElementById('postText').value = '';
            loadFeed();
          } catch(e) { alert('Failed to create post'); }
        }
        async function toggleLike(postId) {
          try { await fetch('/api/posts/'+postId+'/like', { method: 'POST' }); loadFeed(); } catch(e) { console.error(e); }
        }
        function toggleComments(postId) {
          const el = document.getElementById('comments-'+postId);
          el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
        async function addComment(postId, text) {
          if (!text.trim()) return;
          try { await fetch('/api/posts/'+postId+'/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); loadFeed(); } catch(e) { alert('Failed to add comment'); }
        }
        async function loadProfile() {
          try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            document.getElementById('postCount').textContent = data.posts || 0;
            document.getElementById('friendCount').textContent = data.friends || 0;
            document.getElementById('likeCount').textContent = data.likes || 0;
            document.getElementById('profilePosts').innerHTML = data.userPosts && data.userPosts.length ? data.userPosts.map(p => renderPost(p)).join('') : '<div class="empty"><i class="fas fa-camera"></i><p>No posts yet</p></div>';
          } catch(e) { console.error(e); }
        }
        function editProfile() {
          const newBio = prompt('Update your bio:', '${user.bio || 'Welcome!'}');
          if (newBio !== null) {
            fetch('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: newBio }) }).then(() => location.reload());
          }
        }
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            document.getElementById('friendsList').innerHTML = data.friends.length ? data.friends.map(f => '<div class="friend-item"><div class="avatar">'+f.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+f.username+'</div><div class="status">Friend</div></div></div>').join('') : '<div class="empty"><i class="fas fa-user-friends"></i><p>No friends</p></div>';
            document.getElementById('friendRequests').innerHTML = data.requests.length ? data.requests.map(r => '<div class="friend-item"><div class="avatar">'+r.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+r.username+'</div><div class="status">Pending</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')">Accept</button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')">Decline</button></div></div>').join('') : '<div class="empty"><i class="fas fa-inbox"></i><p>No requests</p></div>';
            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ? data.suggested.map(u => '<div class="friend-item"><div class="avatar">'+u.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.username+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')">Add</button></div></div>').join('') : '<div class="empty"><i class="fas fa-check"></i><p>All caught up</p></div>';
          } catch(e) { console.error(e); }
        }
        async function sendFriendRequest(userId) {
          try { await fetch('/api/friend-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: userId }) }); loadFriends(); } catch(e) { alert('Failed to send request'); }
        }
        async function acceptFriend(userId) {
          try { await fetch('/api/friend-accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromUserId: userId }) }); loadFriends(); } catch(e) { alert('Failed to accept'); }
        }
        async function rejectFriend(userId) {
          try { await fetch('/api/friend-reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromUserId: userId }) }); loadFriends(); } catch(e) { alert('Failed to reject'); }
        }
        async function loadChatList() {
          try {
            const res = await fetch('/api/chat/list');
            const data = await res.json();
            document.getElementById('chatList').innerHTML = data.length ? data.map(u => '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.username.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.username+'</div><div class="status">Click to chat</div></div></div>').join('') : '<div class="empty"><i class="fas fa-comment-slash"></i><p>No chats</p></div>';
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
            document.getElementById('chatMessages').innerHTML = msgs.length ? msgs.map(m => '<div class="msg"><span class="sender">'+m.senderName+':</span> <span class="text">'+m.text+'</span></div>').join('') : '<div class="empty" style="padding:15px 0;"><i class="fas fa-comment-dots"></i><p>No messages</p></div>';
          } catch(e) { console.error(e); }
        }
        async function sendChatMessage() {
          const input = document.getElementById('chatInput');
          const text = input.value.trim();
          if (!text || !currentChatWith) return;
          try { await fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: currentChatWith, text }) }); input.value = ''; loadMessages(currentChatWith); } catch(e) { alert('Failed to send'); }
        }
        function closeChat() {
          document.getElementById('chatDetail').style.display = 'none';
          document.getElementById('chatList').style.display = 'block';
        }
        async function loadAdmin() {
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            document.getElementById('adminStats').innerHTML = '<div class="stat"><div class="num primary">'+data.stats.totalUsers+'</div><div class="label">Users</div></div><div class="stat"><div class="num green">'+data.stats.totalPosts+'</div><div class="label">Posts</div></div><div class="stat"><div class="num blue">'+data.stats.totalLikes+'</div><div class="label">Likes</div></div><div class="stat"><div class="num gold">'+data.stats.activeUsers+'</div><div class="label">Active</div></div>';
            let html = '';
            data.users.forEach(u => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+u.username+'</div><div class="sub">'+u.phone+'</div></div><div class="badge '+(u.active !== false ? 'active' : 'inactive')+'">'+(u.active !== false ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs '+(u.active !== false ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active !== false ? 'false' : 'true')+')">'+(u.active !== false ? 'Deactivate' : 'Activate')+'</button></div></div>';
            });
            html += '<div style="margin:8px 0 4px;"><strong style="color:#ff3b5c;">Posts</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+p.text.substring(0,30)+(p.text.length>30?'...':'')+'</div><div class="sub">by '+p.userName+'</div></div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">Delete</button></div></div>';
            });
            if (!data.posts.length) html += '<div class="empty"><i class="fas fa-inbox"></i><p>No posts</p></div>';
            document.getElementById('adminContent').innerHTML = html;
          } catch(e) { console.error(e); }
        }
        async function adminToggleUser(userId, active) {
          try { await fetch('/api/admin/user-toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, active }) }); loadAdmin(); } catch(e) { alert('Failed to toggle'); }
        }
        async function adminDeletePost(postId) {
          if (!confirm('Delete this post?')) return;
          try { await fetch('/api/admin/post-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId }) }); loadAdmin(); } catch(e) { alert('Failed to delete'); }
        }
        loadFeed();
        setInterval(loadFeed, 30000);
      </script>
    </body>
    </html>
  `);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API Routes (same as before)
app.get('/api/posts', (req, res) => {
  const db = readDB();
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
  const db = readDB();
  db.posts.push({ id: 'p' + genId(), userId: req.session.userId, text: text || '', timestamp: Date.now(), likes: [], comments: [] });
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/posts/:postId/like', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const idx = post.likes.indexOf(req.session.userId);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(req.session.userId);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/posts/:postId/comment', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const user = db.users.find(u => u.id === req.session.userId);
  post.comments.push({ userId: req.session.userId, userName: user ? user.username : 'User', text: text, timestamp: Date.now() });
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const userPosts = db.posts.filter(p => p.userId === req.session.userId);
  const friends = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted');
  const totalLikes = userPosts.reduce((acc, p) => acc + (p.likes ? p.likes.length : 0), 0);
  res.json({ user, posts: userPosts.length, friends: friends.length, likes: totalLikes, userPosts: userPosts.sort((a,b) => b.timestamp - a.timestamp) });
});

app.post('/api/profile/update', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { bio } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (bio !== undefined) user.bio = bio;
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const friendsIds = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted').map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const friends = db.users.filter(u => friendsIds.includes(u.id) && (u.active !== false));
  const requests = db.friendships.filter(f => f.toUserId === req.session.userId && f.status === 'pending').map(f => db.users.find(u => u.id === f.fromUserId)).filter(Boolean);
  const existing = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId));
  const existingIds = existing.map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const suggested = db.users.filter(u => u.id !== req.session.userId && !existingIds.includes(u.id) && !requests.find(r => r.id === u.id));
  res.json({ friends, requests, suggested });
});

app.post('/api/friend-request', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId } = req.body;
  const db = readDB();
  if (toUserId === req.session.userId) return res.status(400).json({ error: 'Cannot add yourself' });
  if (db.friendships.find(f => (f.fromUserId === req.session.userId && f.toUserId === toUserId) || (f.fromUserId === toUserId && f.toUserId === req.session.userId))) {
    return res.status(400).json({ error: 'Request already exists' });
  }
  db.friendships.push({ id: 'f' + genId(), fromUserId: req.session.userId, toUserId: toUserId, status: 'pending' });
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/friend-accept', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const db = readDB();
  const friendship = db.friendships.find(f => f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending');
  if (!friendship) return res.status(404).json({ error: 'Not found' });
  friendship.status = 'accepted';
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/friend-reject', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const db = readDB();
  const idx = db.friendships.findIndex(f => f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending');
  if (idx > -1) { db.friendships.splice(idx, 1); writeDB(db); }
  res.json({ success: true });
});

app.get('/api/chat/list', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const friendsIds = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted').map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  res.json(db.users.filter(u => friendsIds.includes(u.id) && (u.active !== false)));
});

app.get('/api/chat/messages/:userId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const db = readDB();
  const msgs = db.messages.filter(m => (m.fromUserId === req.session.userId && m.toUserId === userId) || (m.fromUserId === userId && m.toUserId === req.session.userId)).sort((a,b) => a.timestamp - b.timestamp);
  const enriched = msgs.map(m => {
    const sender = db.users.find(u => u.id === m.fromUserId);
    return { ...m, senderName: sender ? sender.username : 'User' };
  });
  res.json(enriched);
});

app.post('/api/chat/send', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId, text } = req.body;
  const db = readDB();
  db.messages.push({ id: 'm' + genId(), fromUserId: req.session.userId, toUserId: toUserId, text: text, timestamp: Date.now() });
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/admin/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
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
  const db = readDB();
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { userId, active } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.active = active;
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/admin/post-delete', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { postId } = req.body;
  db.posts = db.posts.filter(p => p.id !== postId);
  writeDB(db);
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log('✅ FaceLove running on port ' + PORT);
});

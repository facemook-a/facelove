// FaceLove Pro - Instagram Style Social Platform
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== FILE UPLOAD SETUP ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// ========== TWILIO CONFIG ==========
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';

let twilioClient = null;
let twilioEnabled = false;

if (twilioAccountSid && twilioAuthToken && twilioAccountSid !== '') {
  try {
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    twilioEnabled = true;
    console.log('✅ Twilio configured');
  } catch (e) {
    console.log('⚠️ Twilio not configured');
  }
}

// ========== MIDDLEWARE ==========
app.use(session({
  secret: 'facelove_pro_secret_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 * 30 }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// ========== DATABASE ==========
const DB_FILE = path.join(__dirname, 'db.json');

function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [],
      otps: [],
      posts: [],
      stories: [],
      friendships: [],
      messages: [],
      notifications: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}
initDB();

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE));
  } catch (e) {
    return { users: [], otps: [], posts: [], stories: [], friendships: [], messages: [], notifications: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ========== HELPERS ==========
function generateId() {
  return Date.now() + Math.random().toString(36).substr(2, 6);
}

async function sendOTP(phone, otp) {
  if (!twilioEnabled) {
    console.log(`[MOCK] OTP: ${otp} for ${phone}`);
    return { success: true, mock: true };
  }
  try {
    await twilioClient.messages.create({
      body: `Your FaceLove code: ${otp}`,
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== HTML ==========
const splashHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FaceLove</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background: linear-gradient(135deg, #0a0a0a, #1a0a0a, #0a0a1a);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    .splash{ text-align: center; animation: float 3s ease-in-out infinite; }
    .splash .logo{
      width: 100px; height: 100px;
      background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
      border-radius: 28px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
      box-shadow: 0 0 60px rgba(255,59,92,0.3);
    }
    .splash .logo i{ font-size: 44px; color: #fff; }
    .splash h1{
      font-size: 40px; font-weight: 800;
      background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .splash p{ color: #666; font-size: 14px; letter-spacing: 3px; margin-top: 6px; }
    .loader{
      width: 40px; height: 40px; margin: 30px auto 0;
      border: 3px solid rgba(255,59,92,0.1);
      border-top: 3px solid #ff3b5c;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin{ 100%{transform:rotate(360deg)} }
    @keyframes float{ 0%{transform:translateY(0)} 50%{transform:translateY(-8px)} 100%{transform:translateY(0)} }
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
`;

// ========== ROUTES ==========
app.get('/', (req, res) => res.send(splashHTML));

// LOGIN
app.get('/login', (req, res) => {
  const error = req.query.error || '';
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
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        .auth{
          background: #141414;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #1f1f1f;
        }
        .auth .brand{ text-align: center; margin-bottom: 30px; }
        .auth .brand i{ font-size: 32px; color: #ff3b5c; margin-bottom: 8px; }
        .auth .brand h1{ color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 13px; }
        .auth .error{
          background: rgba(255,59,92,0.1);
          color: #ff6b6b;
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
          display: ${error ? 'block' : 'none'};
        }
        .auth .form-group{ margin-bottom: 14px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: #1f1f1f; }
        .auth .btn{
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{
          text-align: center;
          margin-top: 18px;
          color: #666;
          font-size: 13px;
        }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
        .auth .divider{ color: #333; margin: 0 8px; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Sign in to continue</p>
        </div>
        <div class="error">${error}</div>
        <form action="/login" method="POST">
          <div class="form-group">
            <input type="text" name="phone" placeholder="Phone number" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create Account</a>
          <span class="divider">•</span>
          <a href="/forgot-password">Forgot Password?</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.password === password && u.verified);
  if (!user) return res.redirect('/login?error=Invalid credentials');
  if (!user.active) return res.redirect('/login?error=Account deactivated');
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

// REGISTER
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
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        .auth{
          background: #141414;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #1f1f1f;
        }
        .auth .brand{ text-align: center; margin-bottom: 25px; }
        .auth .brand i{ font-size: 32px; color: #ff3b5c; margin-bottom: 8px; }
        .auth .brand h1{ color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 13px; }
        .auth .form-group{ margin-bottom: 12px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: #1f1f1f; }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 12px;
          color: #4a9eff;
          margin: 10px 0;
          text-align: center;
          border: 1px solid rgba(74,158,255,0.1);
        }
        .auth .btn{
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{
          text-align: center;
          margin-top: 16px;
          color: #666;
          font-size: 13px;
        }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Create your account</p>
        </div>
        <form action="/register" method="POST">
          <div class="form-group">
            <input type="text" name="name" placeholder="Full name" required>
          </div>
          <div class="form-group">
            <input type="text" name="phone" placeholder="Phone number" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="Password (min 6 chars)" required minlength="6">
          </div>
          <div class="info"><i class="fas fa-info-circle"></i> Verification code will be sent via WhatsApp</div>
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

app.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;
  const db = readDB();
  if (db.users.find(u => u.phone === phone)) {
    return res.send('<script>alert("Phone already registered"); window.location="/register";</script>');
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  const result = await sendOTP(phone, otp);
  req.session.tempUser = { name, phone, password };
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify - FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        .auth{
          background: #141414;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #1f1f1f;
          text-align: center;
        }
        .auth .brand i{ font-size: 36px; color: #ff3b5c; margin-bottom: 10px; }
        .auth .brand h1{ color: #fff; font-size: 24px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 13px; }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(241,196,15,0.1);
        }
        .auth .info i{ margin-right: 6px; }
        .auth .form-group input{
          width: 100%;
          padding: 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 22px;
          text-align: center;
          letter-spacing: 10px;
          font-weight: 700;
          transition: 0.3s;
          outline: none;
          margin: 16px 0;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: #1f1f1f; }
        .auth .btn{
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{ margin-top: 16px; color: #666; font-size: 13px; }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
        .auth .note{ font-size: 11px; color: #444; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-shield-alt"></i>
          <h1>Face<span>Love</span></h1>
          <p>Enter verification code</p>
        </div>
        ${result.mock ? '<div class="info"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
        <form action="/verify-otp" method="POST">
          <div class="form-group">
            <input type="text" name="otp" placeholder="000000" maxlength="6" required autofocus>
          </div>
          <input type="hidden" name="phone" value="${phone}">
          <button type="submit" class="btn"><i class="fas fa-check-circle"></i> Verify</button>
        </form>
        <div class="links"><a href="/register"><i class="fas fa-arrow-left"></i> Change number</a></div>
        <div class="note"><i class="fas fa-whatsapp"></i> Code sent via WhatsApp</div>
      </div>
    </body>
    </html>
  `);
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const db = readDB();
  const record = db.otps.find(o => o.phone === phone && o.code === otp && o.expires > Date.now());
  if (!record) return res.send('<script>alert("Invalid or expired code"); window.location="/register";</script>');
  const temp = req.session.tempUser;
  if (!temp || temp.phone !== phone) return res.send('<script>alert("Session error"); window.location="/register";</script>');
  const newUser = {
    id: 'u' + generateId(),
    name: temp.name,
    phone: temp.phone,
    password: temp.password,
    verified: true,
    active: true,
    role: 'user',
    joined: new Date().toISOString(),
    bio: 'Welcome to FaceLove!',
    avatar: '',
    username: temp.name.toLowerCase().replace(/\s/g, '') + Math.floor(Math.random() * 1000)
  };
  db.users.push(newUser);
  db.otps = db.otps.filter(o => o.phone !== phone);
  writeDB(db);
  req.session.tempUser = null;
  req.session.userId = newUser.id;
  res.redirect('/dashboard');
});

// ========== DASHBOARD ==========
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <title>FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        :root{
          --primary: #ff3b5c;
          --bg: #0a0a0a;
          --card: #141414;
          --border: #1f1f1f;
          --text: #ffffff;
          --text-secondary: #aaa;
          --text-muted: #555;
          --shadow: 0 8px 32px rgba(0,0,0,0.6);
          --radius: 16px;
        }
        body{
          background: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding-bottom: 75px;
          padding-top: 60px;
        }
        ::-webkit-scrollbar{ width: 4px; }
        ::-webkit-scrollbar-track{ background: var(--bg); }
        ::-webkit-scrollbar-thumb{ background: var(--primary); border-radius: 10px; }

        /* Top Nav */
        .top-nav{
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 100;
        }
        .top-nav .brand{
          font-size: 20px;
          font-weight: 800;
          color: #fff;
        }
        .top-nav .brand i{ color: var(--primary); margin-right: 6px; }
        .top-nav .brand span{ color: var(--primary); }
        .top-nav .actions{
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .top-nav .actions .avatar{
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: #fff;
          cursor: pointer;
        }
        .top-nav .actions a{
          color: var(--text-secondary);
          font-size: 20px;
          transition: 0.3s;
          text-decoration: none;
        }
        .top-nav .actions a:hover{ color: #fff; }

        /* Bottom Nav */
        .bottom-nav{
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 68px;
          background: rgba(10,10,10,0.97);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 100;
        }
        .bottom-nav a{
          color: var(--text-muted);
          font-size: 22px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          transition: 0.3s;
          padding: 4px 12px;
          border-radius: 10px;
        }
        .bottom-nav a span{
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }
        .bottom-nav a:hover{ color: #fff; }
        .bottom-nav a.active{ color: var(--primary); }
        .bottom-nav a.active span{ color: var(--primary); }

        /* Content */
        .content{ max-width: 700px; margin: 0 auto; padding: 0 12px; }
        .page{ display: none; animation: fadeUp 0.3s ease; }
        .page.active{ display: block; }
        @keyframes fadeUp{ 0%{opacity:0;transform:translateY(16px)} 100%{opacity:1;transform:translateY(0)} }

        /* Card */
        .card{
          background: var(--card);
          border-radius: var(--radius);
          padding: 16px 18px;
          margin-bottom: 14px;
          border: 1px solid var(--border);
          transition: 0.3s;
        }
        .card:hover{ border-color: rgba(255,59,92,0.15); }
        .card .title{
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card .title i{ color: var(--primary); }

        /* Post Box */
        .post-box textarea{
          width: 100%;
          padding: 14px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          resize: vertical;
          min-height: 70px;
          outline: none;
          transition: 0.3s;
        }
        .post-box textarea:focus{ border-color: var(--primary); background: #1f1f1f; }
        .post-box .actions{
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .post-box .actions .media-options{
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .post-box .actions .media-options label{
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
          transition: 0.3s;
        }
        .post-box .actions .media-options label:hover{ color: var(--primary); }
        .post-box .actions .btn-post{
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          border: none;
          padding: 10px 24px;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: 0.3s;
        }
        .post-box .actions .btn-post:hover{
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255,59,92,0.3);
        }
        .post-box .actions .btn-post i{ margin-right: 6px; }

        /* Feed Post */
        .feed-post{
          background: var(--card);
          border-radius: var(--radius);
          padding: 16px 18px;
          margin-bottom: 14px;
          border: 1px solid var(--border);
        }
        .feed-post .header{
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .feed-post .header .avatar{
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: #fff;
          flex-shrink: 0;
        }
        .feed-post .header .info{ flex: 1; }
        .feed-post .header .info .name{
          font-weight: 700;
          font-size: 14px;
          color: #fff;
        }
        .feed-post .header .info .time{
          font-size: 11px;
          color: var(--text-muted);
        }
        .feed-post .body{
          font-size: 14px;
          line-height: 1.7;
          margin: 4px 0 10px;
        }
        .feed-post .body .media{
          margin-top: 10px;
          border-radius: 12px;
          overflow: hidden;
          background: #1a1a1a;
        }
        .feed-post .body .media img,
        .feed-post .body .media video{
          width: 100%;
          max-height: 400px;
          object-fit: cover;
          display: block;
        }
        .feed-post .actions{
          display: flex;
          gap: 20px;
          padding-top: 10px;
          border-top: 1px solid var(--border);
        }
        .feed-post .actions button{
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 14px;
          cursor: pointer;
          transition: 0.3s;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }
        .feed-post .actions button:hover{ color: #fff; }
        .feed-post .actions button.liked{ color: var(--primary); }
        .feed-post .comments{
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .feed-post .comments .comment{
          display: flex;
          gap: 8px;
          margin: 4px 0;
          font-size: 13px;
        }
        .feed-post .comments .comment .cname{
          font-weight: 700;
          color: var(--primary);
        }
        .feed-post .comments .comment .ctext{ color: #ccc; }
        .feed-post .comments input{
          width: 100%;
          padding: 10px 14px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 13px;
          outline: none;
          margin-top: 8px;
          transition: 0.3s;
        }
        .feed-post .comments input:focus{ border-color: var(--primary); }

        /* Profile */
        .profile-header{
          text-align: center;
          padding: 20px 0;
        }
        .profile-header .avatar{
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          color: #fff;
          margin: 0 auto 12px;
          box-shadow: 0 0 40px rgba(255,59,92,0.15);
          cursor: pointer;
          position: relative;
        }
        .profile-header .avatar .camera{
          position: absolute;
          bottom: 0;
          right: 0;
          background: var(--primary);
          border-radius: 50%;
          padding: 6px;
          font-size: 12px;
          border: 3px solid var(--bg);
        }
        .profile-header .name{ font-size: 22px; font-weight: 700; }
        .profile-header .username{
          color: var(--text-muted);
          font-size: 13px;
        }
        .profile-header .bio{
          color: var(--text-secondary);
          font-size: 14px;
          margin-top: 6px;
        }
        .profile-header .stats{
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 16px;
        }
        .profile-header .stats .stat{ text-align: center; }
        .profile-header .stats .stat .num{
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }
        .profile-header .stats .stat .label{
          font-size: 11px;
          color: var(--text-muted);
        }
        .profile-header .edit-btn{
          margin-top: 14px;
          padding: 8px 28px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 30px;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: 0.3s;
        }
        .profile-header .edit-btn:hover{ border-color: var(--primary); }

        /* Friends & Chat */
        .friend-item{
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #1a1a1a;
          border-radius: 12px;
          margin-bottom: 8px;
          transition: 0.3s;
          cursor: pointer;
        }
        .friend-item:hover{ background: #1f1f1f; }
        .friend-item .avatar{
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
          color: #fff;
          flex-shrink: 0;
        }
        .friend-item .info{ flex: 1; }
        .friend-item .info .name{ font-weight: 600; font-size: 14px; color: #fff; }
        .friend-item .info .status{ font-size: 11px; color: var(--text-muted); }
        .friend-item .actions{
          display: flex;
          gap: 4px;
        }
        .friend-item .actions .btn-sm{
          padding: 5px 14px;
          border: none;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.3s;
        }
        .friend-item .actions .btn-sm.primary{ background: var(--primary); color: #fff; }
        .friend-item .actions .btn-sm.primary:hover{ background: #e63050; }
        .friend-item .actions .btn-sm.success{ background: #27ae60; color: #fff; }
        .friend-item .actions .btn-sm.success:hover{ background: #2ecc71; }
        .friend-item .actions .btn-sm.danger{ background: #c0392b; color: #fff; }
        .friend-item .actions .btn-sm.danger:hover{ background: #e74c3c; }
        .friend-item .actions i{
          font-size: 18px;
          color: var(--text-muted);
          cursor: pointer;
          transition: 0.3s;
          padding: 4px;
        }
        .friend-item .actions i:hover{ color: var(--primary); }

        /* Chat */
        .chat-messages{
          background: #1a1a1a;
          border-radius: 12px;
          padding: 14px;
          max-height: 320px;
          overflow-y: auto;
          margin-bottom: 10px;
        }
        .chat-messages .msg{
          margin: 3px 0;
          padding: 6px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          font-size: 13px;
        }
        .chat-messages .msg .sender{
          font-weight: 700;
          color: var(--primary);
          margin-right: 4px;
        }
        .chat-messages .msg .text{ color: #ccc; }
        .chat-input{
          display: flex;
          gap: 8px;
        }
        .chat-input input{
          flex: 1;
          padding: 10px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: 0.3s;
        }
        .chat-input input:focus{ border-color: var(--primary); }
        .chat-input button{
          padding: 10px 20px;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          border: none;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .chat-input button:hover{ transform: translateY(-2px); }

        /* Admin */
        .admin-stats{
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .admin-stats .stat{
          background: #1a1a1a;
          padding: 14px;
          border-radius: 12px;
          text-align: center;
        }
        .admin-stats .stat .num{
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }
        .admin-stats .stat .label{
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .admin-stats .stat .num.primary{ color: var(--primary); }
        .admin-stats .stat .num.green{ color: #27ae60; }
        .admin-stats .stat .num.blue{ color: #3498db; }
        .admin-stats .stat .num.gold{ color: #f1c40f; }

        .admin-item{
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        .admin-item .info{ flex: 1; }
        .admin-item .info .name{ font-weight: 600; font-size: 14px; color: #fff; }
        .admin-item .info .sub{ font-size: 11px; color: var(--text-muted); }
        .admin-item .badge{
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 20px;
          font-weight: 600;
        }
        .admin-item .badge.active{ background: rgba(39,174,96,0.2); color: #27ae60; }
        .admin-item .badge.inactive{ background: rgba(192,57,43,0.2); color: #e74c3c; }
        .admin-item .actions{ display: flex; gap: 4px; }
        .admin-item .actions .btn-xs{
          padding: 3px 10px;
          border: none;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.3s;
        }
        .admin-item .actions .btn-xs.danger{ background: #c0392b; color: #fff; }
        .admin-item .actions .btn-xs.danger:hover{ background: #e74c3c; }
        .admin-item .actions .btn-xs.success{ background: #27ae60; color: #fff; }
        .admin-item .actions .btn-xs.success:hover{ background: #2ecc71; }

        .empty{
          text-align: center;
          padding: 30px 0;
          color: var(--text-muted);
        }
        .empty i{ font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.3; }
        .empty p{ font-size: 13px; }

        /* Modal */
        .modal{
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .modal.active{ display: flex; }
        .modal .modal-content{
          background: var(--card);
          border-radius: var(--radius);
          padding: 30px 25px;
          max-width: 420px;
          width: 100%;
          border: 1px solid var(--border);
        }
        .modal .modal-content .title{
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
          text-align: center;
        }
        .modal .modal-content .title i{ color: var(--primary); margin-right: 8px; }
        .modal .modal-content .form-group{ margin-bottom: 12px; }
        .modal .modal-content .form-group input,
        .modal .modal-content .form-group textarea{
          width: 100%;
          padding: 12px 14px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: 0.3s;
          font-family: inherit;
        }
        .modal .modal-content .form-group input:focus,
        .modal .modal-content .form-group textarea:focus{ border-color: var(--primary); }
        .modal .modal-content .btn{
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, var(--primary), #ff6b8a);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: 0.3s;
        }
        .modal .modal-content .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .modal .modal-content .btn.cancel{
          background: transparent;
          border: 1px solid var(--border);
          margin-top: 8px;
        }
        .modal .modal-content .btn.cancel:hover{ border-color: #ff6b6b; transform: none; box-shadow: none; }

        @media (max-width: 480px){
          .content{ padding: 0 8px; }
          .card{ padding: 14px; }
          .bottom-nav a{ font-size: 18px; padding: 2px 8px; }
          .bottom-nav a span{ font-size: 8px; }
          .top-nav .brand{ font-size: 17px; }
          .profile-header .stats{ gap: 20px; }
          .admin-stats{ grid-template-columns: repeat(2, 1fr); }
        }
      </style>
    </head>
    <body>
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-heart"></i>Face<span>Love</span></div>
        <div class="actions">
          <div class="avatar" onclick="showPage('profile')">${user.name.charAt(0).toUpperCase()}</div>
          <a href="/logout"><i class="fas fa-sign-out-alt"></i></a>
        </div>
      </nav>

      <div class="content">
        <!-- Feed -->
        <div id="page-feed" class="page active">
          <div class="card post-box">
            <textarea id="postText" placeholder="What's on your mind?" rows="2"></textarea>
            <div class="actions">
              <div class="media-options">
                <label for="imageInput"><i class="fas fa-image"></i></label>
                <label for="videoInput"><i class="fas fa-video"></i></label>
                <input type="file" id="imageInput" accept="image/*" style="display:none" onchange="uploadMedia(this, 'image')">
                <input type="file" id="videoInput" accept="video/*" style="display:none" onchange="uploadMedia(this, 'video')">
                <span id="fileName" style="font-size:12px;color:var(--text-muted);"></span>
              </div>
              <button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> Post</button>
            </div>
          </div>
          <div id="feedContainer"></div>
        </div>

        <!-- Profile -->
        <div id="page-profile" class="page">
          <div class="card">
            <div class="profile-header">
              <div class="avatar" onclick="changeAvatar()">
                ${user.name.charAt(0).toUpperCase()}
                <div class="camera"><i class="fas fa-camera"></i></div>
              </div>
              <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
              <div class="name">${user.name}</div>
              <div class="username">@${user.username || user.name.toLowerCase().replace(/\s/g, '')}</div>
              <div class="bio">${user.bio || 'Welcome to FaceLove!'}</div>
              <div class="stats">
                <div class="stat"><div class="num" id="postCount">0</div><div class="label">Posts</div></div>
                <div class="stat"><div class="num" id="friendCount">0</div><div class="label">Friends</div></div>
                <div class="stat"><div class="num" id="likeCount">0</div><div class="label">Likes</div></div>
              </div>
              <button class="edit-btn" onclick="openEditProfile()"><i class="fas fa-edit"></i> Edit Profile</button>
              <button class="edit-btn" style="margin-top:8px;border-color:var(--primary);" onclick="openChangePassword()"><i class="fas fa-key"></i> Change Password</button>
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
              <button onclick="closeChat()" style="margin-top:8px;background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;"><i class="fas fa-arrow-left"></i> Back</button>
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

      <!-- Edit Profile Modal -->
      <div id="editProfileModal" class="modal">
        <div class="modal-content">
          <div class="title"><i class="fas fa-user-edit"></i> Edit Profile</div>
          <form id="editProfileForm">
            <div class="form-group">
              <input type="text" id="editName" placeholder="Full name" value="${user.name}">
            </div>
            <div class="form-group">
              <input type="text" id="editUsername" placeholder="Username" value="${user.username || ''}">
            </div>
            <div class="form-group">
              <textarea id="editBio" placeholder="Bio" rows="2">${user.bio || ''}</textarea>
            </div>
            <button type="submit" class="btn"><i class="fas fa-save"></i> Save</button>
            <button type="button" class="btn cancel" onclick="closeEditProfile()">Cancel</button>
          </form>
        </div>
      </div>

      <!-- Change Password Modal -->
      <div id="changePasswordModal" class="modal">
        <div class="modal-content">
          <div class="title"><i class="fas fa-key"></i> Change Password</div>
          <form id="changePasswordForm">
            <div class="form-group">
              <input type="password" id="currentPassword" placeholder="Current password" required>
            </div>
            <div class="form-group">
              <input type="password" id="newPassword" placeholder="New password" required minlength="6">
            </div>
            <div class="form-group">
              <input type="password" id="confirmPassword" placeholder="Confirm new password" required minlength="6">
            </div>
            <button type="submit" class="btn"><i class="fas fa-save"></i> Update Password</button>
            <button type="button" class="btn cancel" onclick="closeChangePassword()">Cancel</button>
          </form>
        </div>
      </div>

      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>Feed</span></a>
        <a href="#" data-page="friends"><i class="fas fa-users"></i><span>Friends</span></a>
        <a href="#" data-page="chat"><i class="fas fa-comment-dots"></i><span>Chat</span></a>
        <a href="#" data-page="profile"><i class="fas fa-user"></i><span>Profile</span></a>
        ${user.role === 'admin' ? '<a href="#" data-page="admin"><i class="fas fa-crown"></i><span>Admin</span></a>' : ''}
      </nav>

      <script>
        const currentUser = { id: "${user.id}", name: "${user.name}", role: "${user.role || 'user'}" };
        let currentChatWith = null;
        let uploadedFile = null;

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

        function showPage(page) {
          document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
          document.getElementById('page-' + page).classList.add('active');
          document.querySelectorAll('.bottom-nav a[data-page]').forEach(a => a.classList.remove('active'));
          document.querySelector('.bottom-nav a[data-page="'+page+'"]').classList.add('active');
          if (page === 'feed') loadFeed();
          if (page === 'friends') loadFriends();
          if (page === 'chat') loadChatList();
          if (page === 'admin' && currentUser.role === 'admin') loadAdmin();
          if (page === 'profile') loadProfile();
        }

        // Upload media
        function uploadMedia(input, type) {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(e) {
            uploadedFile = { data: e.target.result, type: type, name: file.name };
            document.getElementById('fileName').textContent = '📎 ' + file.name;
          };
          reader.readAsDataURL(file);
        }

        // Avatar upload
        function changeAvatar() {
          document.getElementById('avatarInput').click();
        }

        function uploadAvatar(input) {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(e) {
            fetch('/api/profile/avatar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ avatar: e.target.result })
            }).then(() => location.reload());
          };
          reader.readAsDataURL(file);
        }

        // Create post
        async function createPost() {
          const text = document.getElementById('postText').value;
          let media = null;
          if (uploadedFile) {
            media = uploadedFile;
          }
          if (!text && !media) return alert('Please enter text or add media');
          try {
            const res = await fetch('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, media })
            });
            if (res.ok) {
              document.getElementById('postText').value = '';
              document.getElementById('fileName').textContent = '';
              uploadedFile = null;
              loadFeed();
            }
          } catch(e) { alert('Failed to create post'); }
        }

        // Feed
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
          const mediaHtml = p.media ? 
            (p.mediaType === 'video' ? 
              '<div class="media"><video controls src="'+p.media+'"></video></div>' : 
              '<div class="media"><img src="'+p.media+'" alt="post"></div>') : '';
          return \`
            <div class="feed-post">
              <div class="header">
                <div class="avatar">\${p.userName ? p.userName.charAt(0).toUpperCase() : '?'}</div>
                <div class="info">
                  <div class="name">\${p.userName || 'User'}</div>
                  <div class="time"><i class="far fa-clock"></i> \${new Date(p.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <div class="body">
                \${p.text || ''}
                \${mediaHtml}
              </div>
              <div class="actions">
                <button onclick="toggleLike('\${p.id}')" class="\${liked ? 'liked' : ''}">
                  <i class="\${liked ? 'fas' : 'far'} fa-heart"></i> <span>\${p.likes ? p.likes.length : 0}</span>
                </button>
                <button onclick="toggleComments('\${p.id}')">
                  <i class="far fa-comment"></i> <span>\${p.comments ? p.comments.length : 0}</span>
                </button>
                <button onclick="sharePost('\${p.id}')"><i class="fas fa-share"></i></button>
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

        function sharePost(postId) {
          const url = window.location.origin + '/post/' + postId;
          if (navigator.share) {
            navigator.share({ title: 'FaceLove Post', text: 'Check this out!', url: url });
          } else {
            navigator.clipboard.writeText(url);
            alert('Link copied!');
          }
        }

        // Profile
        async function loadProfile() {
          try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            document.getElementById('postCount').textContent = data.posts || 0;
            document.getElementById('friendCount').textContent = data.friends || 0;
            document.getElementById('likeCount').textContent = data.likes || 0;
            const container = document.getElementById('profilePosts');
            container.innerHTML = data.userPosts && data.userPosts.length ? 
              data.userPosts.map(p => renderPost(p)).join('') : 
              '<div class="empty"><i class="fas fa-camera"></i><p>No posts yet</p></div>';
          } catch(e) { console.error(e); }
        }

        // Edit Profile Modal
        function openEditProfile() {
          document.getElementById('editProfileModal').classList.add('active');
          document.getElementById('editName').value = '${user.name}';
          document.getElementById('editUsername').value = '${user.username || ''}';
          document.getElementById('editBio').value = '${user.bio || ''}';
        }

        function closeEditProfile() {
          document.getElementById('editProfileModal').classList.remove('active');
        }

        document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const name = document.getElementById('editName').value;
          const username = document.getElementById('editUsername').value;
          const bio = document.getElementById('editBio').value;
          try {
            await fetch('/api/profile/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, username, bio })
            });
            closeEditProfile();
            location.reload();
          } catch(e) { alert('Failed to update profile'); }
        });

        // Change Password Modal
        function openChangePassword() {
          document.getElementById('changePasswordModal').classList.add('active');
        }

        function closeChangePassword() {
          document.getElementById('changePasswordModal').classList.remove('active');
        }

        document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const current = document.getElementById('currentPassword').value;
          const newPass = document.getElementById('newPassword').value;
          const confirm = document.getElementById('confirmPassword').value;
          if (newPass !== confirm) return alert('Passwords do not match');
          try {
            const res = await fetch('/api/profile/password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ current, newPassword: newPass })
            });
            const data = await res.json();
            if (data.success) {
              alert('Password updated!');
              closeChangePassword();
            } else {
              alert(data.error || 'Failed');
            }
          } catch(e) { alert('Failed to update password'); }
        });

        // Friends
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            document.getElementById('friendsList').innerHTML = data.friends.length ? 
              data.friends.map(f => '<div class="friend-item"><div class="avatar">'+f.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+f.name+'</div><div class="status"><i class="fas fa-check-circle" style="color:#27ae60;"></i> Friend</div></div></div>').join('') :
              '<div class="empty"><i class="fas fa-user-friends"></i><p>No friends</p></div>';
            document.getElementById('friendRequests').innerHTML = data.requests.length ?
              data.requests.map(r => '<div class="friend-item"><div class="avatar">'+r.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+r.name+'</div><div class="status"><i class="fas fa-clock" style="color:#f1c40f;"></i> Pending</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')">Accept</button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')">Decline</button></div></div>').join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>No requests</p></div>';
            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ?
              data.suggested.map(u => '<div class="friend-item"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')">Add</button></div></div>').join('') :
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

        // Chat
        async function loadChatList() {
          try {
            const res = await fetch('/api/chat/list');
            const data = await res.json();
            document.getElementById('chatList').innerHTML = data.length ?
              data.map(u => '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">Click to chat</div></div></div>').join('') :
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
            const container = document.getElementById('chatMessages');
            container.innerHTML = msgs.length ?
              msgs.map(m => '<div class="msg"><span class="sender">'+m.senderName+':</span> <span class="text">'+m.text+'</span></div>').join('') :
              '<div class="empty" style="padding:20px 0;"><i class="fas fa-comment-dots"></i><p>No messages</p></div>';
            container.scrollTop = container.scrollHeight;
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

        // Admin
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
            let html = '<div style="margin:12px 0;"><strong style="color:var(--primary);">Users</strong></div>';
            data.users.forEach(u => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+u.name+'</div><div class="sub">'+u.phone+'</div></div><div class="badge '+(u.active ? 'active' : 'inactive')+'">'+(u.active ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs '+(u.active ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active ? 'false' : 'true')+')">'+(u.active ? 'Deactivate' : 'Activate')+'</button></div></div>';
            });
            html += '<div style="margin:16px 0 8px;"><strong style="color:var(--primary);">Posts</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+p.text.substring(0,40)+(p.text.length>40?'...':'')+'</div><div class="sub">by '+p.userName+'</div></div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">Delete</button></div></div>';
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

        // Initial load
        loadFeed();
        setInterval(loadFeed, 30000);
      </script>
    </body>
    </html>
  `);
});

// ========== API ROUTES ==========

// Posts
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const posts = db.posts.sort((a,b) => b.timestamp - a.timestamp);
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return { ...p, userName: user ? user.name : 'User' };
  });
  res.json(enriched);
});

app.post('/api/posts', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text, media } = req.body;
  const db = readDB();
  const post = {
    id: 'p' + generateId(),
    userId: req.session.userId,
    text: text || '',
    media: media ? media.data : null,
    mediaType: media ? media.type : null,
    timestamp: Date.now(),
    likes: [],
    comments: []
  };
  db.posts.push(post);
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
  post.comments.push({
    userId: req.session.userId,
    userName: user ? user.name : 'User',
    text: text,
    timestamp: Date.now()
  });
  writeDB(db);
  res.json({ success: true });
});

// Profile
app.get('/api/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
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
  const { name, username, bio } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (name) user.name = name;
  if (username) user.username = username;
  if (bio !== undefined) user.bio = bio;
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/profile/avatar', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { avatar } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.avatar = avatar;
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/profile/password', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { current, newPassword } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.password !== current) return res.status(400).json({ error: 'Current password is incorrect' });
  user.password = newPassword;
  writeDB(db);
  res.json({ success: true });
});

// Friends
app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const friendsIds = db.friendships.filter(f => 
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const friends = db.users.filter(u => friendsIds.includes(u.id) && u.active);
  const requests = db.friendships.filter(f => f.toUserId === req.session.userId && f.status === 'pending')
    .map(f => db.users.find(u => u.id === f.fromUserId)).filter(Boolean);
  const existing = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId));
  const existingIds = existing.map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const suggested = db.users.filter(u => u.verified && u.active && u.id !== req.session.userId && 
    !existingIds.includes(u.id) && !requests.find(r => r.id === u.id));
  res.json({ friends, requests, suggested });
});

app.post('/api/friend-request', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId } = req.body;
  const db = readDB();
  if (toUserId === req.session.userId) return res.status(400).json({ error: 'Cannot add yourself' });
  const exists = db.friendships.find(f => 
    (f.fromUserId === req.session.userId && f.toUserId === toUserId) || 
    (f.fromUserId === toUserId && f.toUserId === req.session.userId)
  );
  if (exists) return res.status(400).json({ error: 'Request already exists' });
  db.friendships.push({ 
    id: 'f' + generateId(), 
    fromUserId: req.session.userId, 
    toUserId: toUserId, 
    status: 'pending' 
  });
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/friend-accept', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const db = readDB();
  const friendship = db.friendships.find(f => 
    f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending'
  );
  if (!friendship) return res.status(404).json({ error: 'Not found' });
  friendship.status = 'accepted';
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/friend-reject', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { fromUserId } = req.body;
  const db = readDB();
  const idx = db.friendships.findIndex(f => 
    f.fromUserId === fromUserId && f.toUserId === req.session.userId && f.status === 'pending'
  );
  if (idx > -1) { db.friendships.splice(idx, 1); writeDB(db); }
  res.json({ success: true });
});

// Chat
app.get('/api/chat/list', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const friendsIds = db.friendships.filter(f => 
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  res.json(db.users.filter(u => friendsIds.includes(u.id) && u.active));
});

app.get('/api/chat/messages/:userId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const db = readDB();
  const msgs = db.messages.filter(m => 
    (m.fromUserId === req.session.userId && m.toUserId === userId) || 
    (m.fromUserId === userId && m.toUserId === req.session.userId)
  ).sort((a,b) => a.timestamp - b.timestamp);
  const enriched = msgs.map(m => {
    const sender = db.users.find(u => u.id === m.fromUserId);
    return { ...m, senderName: sender ? sender.name : 'User' };
  });
  res.json(enriched);
});

app.post('/api/chat/send', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId, text } = req.body;
  const db = readDB();
  const msg = {
    id: 'm' + generateId(),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    text: text,
    timestamp: Date.now()
  };
  db.messages.push(msg);
  writeDB(db);
  res.json({ success: true });
});

// Admin
app.get('/api/admin/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const stats = {
    totalUsers: db.users.filter(u => u.verified).length,
    totalPosts: db.posts.length,
    totalLikes: db.posts.reduce((acc, p) => acc + (p.likes ? p.likes.length : 0), 0),
    activeUsers: new Set(db.posts.map(p => p.userId)).size
  };
  const users = db.users.filter(u => u.verified);
  const posts = db.posts.map(p => {
    const u = db.users.find(usr => usr.id === p.userId);
    return { ...p, userName: u ? u.name : 'Deleted' };
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

// Forgot password
app.get('/forgot-password', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove - Forgot Password</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        .auth{
          background: #141414;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #1f1f1f;
        }
        .auth .brand{ text-align: center; margin-bottom: 30px; }
        .auth .brand i{ font-size: 32px; color: #ff3b5c; margin-bottom: 8px; }
        .auth .brand h1{ color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 13px; }
        .auth .form-group{ margin-bottom: 16px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: #1f1f1f; }
        .auth .btn{
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{ text-align: center; margin-top: 18px; color: #666; font-size: 13px; }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-key"></i>
          <h1>Face<span>Love</span></h1>
          <p>Reset your password</p>
        </div>
        <form action="/forgot-password" method="POST">
          <div class="form-group">
            <input type="text" name="phone" placeholder="Phone number" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-paper-plane"></i> Send Reset Code</button>
        </form>
        <div class="links"><a href="/login">Back to Sign In</a></div>
      </div>
    </body>
    </html>
  \`);
});

app.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.verified);
  if (!user) return res.send('<script>alert("Phone not found"); window.location="/forgot-password";</script>');
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  const result = await sendOTP(phone, otp);
  res.send(\`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove - Reset Password</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        .auth{
          background: #141414;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #1f1f1f;
        }
        .auth .brand{ text-align: center; margin-bottom: 25px; }
        .auth .brand i{ font-size: 32px; color: #ff3b5c; margin-bottom: 8px; }
        .auth .brand h1{ color: #fff; font-size: 26px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 13px; }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(241,196,15,0.1);
          text-align: center;
        }
        .auth .info i{ margin-right: 6px; }
        .auth .form-group{ margin-bottom: 16px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: #1f1f1f; }
        .auth .btn{
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .note{ font-size: 11px; color: #444; text-align: center; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-undo-alt"></i>
          <h1>Face<span>Love</span></h1>
          <p>Enter new password</p>
        </div>
        \${result.mock ? '<div class="info"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
        <form action="/reset-password" method="POST">
          <input type="hidden" name="phone" value="\${phone}">
          <div class="form-group">
            <input type="password" name="newPassword" placeholder="New password" required minlength="6">
          </div>
          <button type="submit" class="btn"><i class="fas fa-save"></i> Update Password</button>
        </form>
        <div class="note"><i class="fas fa-whatsapp"></i> Code sent via WhatsApp</div>
      </div>
    </body>
    </html>
  \`);
});

app.post('/reset-password', (req, res) => {
  const { phone, newPassword } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.verified);
  if (!user) return res.send('<script>alert("Error"); window.location="/login";</script>');
  user.password = newPassword;
  writeDB(db);
  res.send('<script>alert("Password updated successfully!"); window.location="/login";</script>');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('🚀 FaceLove Pro running on port ' + PORT);
  console.log('📱 Visit http://localhost:' + PORT);
});

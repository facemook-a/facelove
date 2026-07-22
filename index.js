// FaceLove Pro Max - Ultimate Social Platform
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CONFIG ==========
const SESSION_SECRET = 'facelove_promax_secret';
const UPLOAD_DIR = './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Twilio (optional)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
let twilioClient = null;
let twilioEnabled = false;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    twilioEnabled = true;
  } catch (e) { console.log('Twilio not configured'); }
}

// ========== MIDDLEWARE ==========
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

// ========== DATABASE ==========
const DB_FILE = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: [],
    otps: [],
    posts: [],
    friendships: [],
    messages: [],
    notifications: [],
    settings: {
      theme: 'dark', // 'dark' or 'light'
      defaultLanguage: 'ar',
      musicEnabled: true,
      quranEnabled: true
    },
    musicLibrary: [
      { id: 'm1', title: 'Peaceful Moments', artist: 'Nature', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
      { id: 'm2', title: 'Chill Vibes', artist: 'Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
      { id: 'm3', title: 'Relaxing Piano', artist: 'Classical', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
      { id: 'm4', title: 'Upbeat', artist: 'Pop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
      { id: 'm5', title: 'Focus', artist: 'Study', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' }
    ],
    quranLibrary: [
      { id: 'q1', surah: 'Al-Fatiha', url: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/001.mp3' },
      { id: 'q2', surah: 'Al-Baqarah (first part)', url: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/002.mp3' },
      { id: 'q3', surah: 'Al-Ikhlas', url: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/112.mp3' },
      { id: 'q4', surah: 'Al-Falaq', url: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/113.mp3' },
      { id: 'q5', surah: 'An-Nas', url: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/114.mp3' }
    ]
  }, null, 2));
}

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE)); }
  catch (e) { return { users: [], otps: [], posts: [], friendships: [], messages: [], notifications: [], settings: { theme: 'dark', defaultLanguage: 'ar', musicEnabled: true, quranEnabled: true }, musicLibrary: [], quranLibrary: [] }; }
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

// ========== HELPERS ==========
async function sendOTP(phone, otp) {
  if (!twilioEnabled) {
    console.log(`[MOCK] OTP for ${phone}: ${otp}`);
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

// ========== ROUTES ==========

// --- SPLASH ---
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove Pro Max</title>
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
          overflow: hidden;
        }
        .splash { text-align: center; animation: float 4s ease-in-out infinite; }
        .splash .logo {
          width: 130px; height: 130px;
          background: linear-gradient(145deg, #d4af37, #f9d976, #d4af37);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 25px;
          box-shadow: 0 0 80px rgba(212,175,55,0.4), 0 0 150px rgba(212,175,55,0.2);
          animation: pulseGold 2s infinite;
        }
        .splash .logo i { font-size: 60px; color: #0a0a0a; }
        .splash h1 {
          font-size: 48px; font-weight: 800;
          background: linear-gradient(135deg, #d4af37, #f9d976, #d4af37);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(212,175,55,0.3);
        }
        .splash p { color: #888; font-size: 16px; letter-spacing: 4px; margin-top: 8px; text-transform: uppercase; }
        .splash .loader {
          width: 60px; height: 60px; margin: 30px auto 0;
          border: 4px solid rgba(212,175,55,0.1);
          border-top: 4px solid #d4af37;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes pulseGold { 0%,100% { box-shadow: 0 0 80px rgba(212,175,55,0.4), 0 0 150px rgba(212,175,55,0.2); } 50% { box-shadow: 0 0 100px rgba(212,175,55,0.6), 0 0 200px rgba(212,175,55,0.3); } }
      </style>
    </head>
    <body>
      <div class="splash">
        <div class="logo"><i class="fas fa-crown"></i></div>
        <h1>FaceLove Pro Max</h1>
        <p>Ultimate Social Experience</p>
        <div class="loader"></div>
      </div>
      <script>setTimeout(()=>{window.location.href='/login'},2800);</script>
    </body>
    </html>
  `);
});

// --- LOGIN ---
app.get('/login', (req, res) => {
  const error = req.query.error || '';
  const lang = req.query.lang || 'ar';
  const texts = {
    ar: { title: 'تسجيل الدخول', username: 'اسم المستخدم أو رقم الهاتف', password: 'كلمة المرور', signin: 'دخول', create: 'إنشاء حساب', forgot: 'نسيت كلمة المرور؟' },
    en: { title: 'Sign In', username: 'Username or Phone', password: 'Password', signin: 'Sign In', create: 'Create Account', forgot: 'Forgot Password?' },
    fr: { title: 'Connexion', username: 'Nom d\'utilisateur ou téléphone', password: 'Mot de passe', signin: 'Se connecter', create: 'Créer un compte', forgot: 'Mot de passe oublié ?' }
  };
  const t = texts[lang] || texts.ar;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove Pro Max - Login</title>
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
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.05);
        }
        .auth .brand { text-align: center; margin-bottom: 35px; }
        .auth .brand i { font-size: 38px; color: #d4af37; margin-bottom: 10px; text-shadow: 0 0 30px rgba(212,175,55,0.3); }
        .auth .brand h1 { color: #fff; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #888; font-size: 14px; margin-top: 4px; letter-spacing: 2px; }
        .auth .error {
          background: rgba(255,59,92,0.1);
          color: #ff6b6b;
          padding: 12px 16px;
          border-radius: 14px;
          margin-bottom: 20px;
          font-size: 14px;
          display: ${error ? 'block' : 'none'};
        }
        .auth .form-group { margin-bottom: 16px; }
        .auth .form-group input {
          width: 100%;
          padding: 16px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus {
          border-color: #d4af37;
          background: rgba(40,40,40,0.9);
          box-shadow: 0 0 20px rgba(212,175,55,0.1);
        }
        .auth .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 14px;
          color: #0a0a0a;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 6px;
        }
        .auth .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 35px rgba(212, 175, 55, 0.3); }
        .auth .btn i { margin-right: 8px; }
        .auth .links {
          text-align: center;
          margin-top: 22px;
          color: #666;
          font-size: 14px;
        }
        .auth .links a {
          color: #d4af37;
          text-decoration: none;
          font-weight: 600;
          transition: 0.2s;
        }
        .auth .links a:hover { text-decoration: underline; }
        .auth .divider { color: #333; margin: 0 8px; }
        .lang-switch {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 15px;
        }
        .lang-switch a {
          color: #888;
          text-decoration: none;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #333;
          transition: 0.3s;
        }
        .lang-switch a:hover { border-color: #d4af37; color: #d4af37; }
        @media (max-width: 480px) { .auth { padding: 30px 20px; } }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-crown"></i>
          <h1>Face<span>Love</span> Pro Max</h1>
          <p>${t.title}</p>
        </div>
        <div class="error">${error}</div>
        <form action="/login" method="POST">
          <input type="hidden" name="lang" value="${lang}">
          <div class="form-group">
            <input type="text" name="username" placeholder="${t.username}" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="${t.password}" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-sign-in-alt"></i> ${t.signin}</button>
        </form>
        <div class="links">
          <a href="/register?lang=${lang}">${t.create}</a>
          <span class="divider">•</span>
          <a href="/forgot-password?lang=${lang}">${t.forgot}</a>
        </div>
        <div class="lang-switch">
          <a href="?lang=ar">العربية</a>
          <a href="?lang=en">English</a>
          <a href="?lang=fr">Français</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password, lang } = req.body;
  const db = readDB();
  const user = db.users.find(u => (u.username === username || u.phone === username) && u.password === password);
  if (!user) return res.redirect('/login?error=Invalid credentials&lang=' + (lang || 'ar'));
  if (user.active === false) return res.redirect('/login?error=Account deactivated&lang=' + (lang || 'ar'));
  req.session.userId = user.id;
  req.session.lang = lang || user.language || 'ar';
  res.redirect('/dashboard');
});

// --- REGISTER ---
app.get('/register', (req, res) => {
  const lang = req.query.lang || 'ar';
  const texts = {
    ar: { title: 'إنشاء حساب', username: 'اسم المستخدم', phone: 'رقم الهاتف مع الرمز الدولي', password: 'كلمة المرور (6 أحرف)', create: 'إنشاء حساب', have: 'لديك حساب؟', signin: 'تسجيل الدخول', info: 'سيتم إرسال رمز التحقق عبر واتساب' },
    en: { title: 'Create Account', username: 'Username', phone: 'Phone with country code', password: 'Password (min 6 chars)', create: 'Create Account', have: 'Have an account?', signin: 'Sign In', info: 'A verification code will be sent via WhatsApp' },
    fr: { title: 'Créer un compte', username: "Nom d'utilisateur", phone: 'Téléphone avec indicatif', password: 'Mot de passe (6 caractères min)', create: 'Créer un compte', have: 'Vous avez un compte ?', signin: 'Se connecter', info: 'Un code de vérification sera envoyé par WhatsApp' }
  };
  const t = texts[lang] || texts.ar;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FaceLove Pro Max - Register</title>
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
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand { text-align: center; margin-bottom: 30px; }
        .auth .brand i { font-size: 38px; color: #d4af37; margin-bottom: 10px; }
        .auth .brand h1 { color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #888; font-size: 14px; margin-top: 4px; letter-spacing: 2px; }
        .auth .form-group { margin-bottom: 14px; }
        .auth .form-group input {
          width: 100%;
          padding: 16px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus { border-color: #d4af37; background: rgba(40,40,40,0.9); box-shadow: 0 0 20px rgba(212,175,55,0.1); }
        .auth .info-box {
          background: rgba(212,175,55,0.05);
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 13px;
          color: #d4af37;
          margin: 12px 0;
          border: 1px solid rgba(212,175,55,0.1);
          text-align: center;
        }
        .auth .info-box i { margin-right: 8px; }
        .auth .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 14px;
          color: #0a0a0a;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 6px;
        }
        .auth .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 35px rgba(212, 175, 55, 0.3); }
        .auth .btn i { margin-right: 8px; }
        .auth .links { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .auth .links a { color: #d4af37; text-decoration: none; font-weight: 600; }
        .auth .links a:hover { text-decoration: underline; }
        .lang-switch {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 15px;
        }
        .lang-switch a {
          color: #888;
          text-decoration: none;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #333;
          transition: 0.3s;
        }
        .lang-switch a:hover { border-color: #d4af37; color: #d4af37; }
        @media (max-width: 480px) { .auth { padding: 30px 20px; } }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-crown"></i>
          <h1>Face<span>Love</span> Pro Max</h1>
          <p>${t.title}</p>
        </div>
        <form action="/register" method="POST">
          <input type="hidden" name="lang" value="${lang}">
          <div class="form-group">
            <input type="text" name="username" placeholder="${t.username}" required>
          </div>
          <div class="form-group">
            <input type="text" name="phone" placeholder="${t.phone}" required>
          </div>
          <div class="form-group">
            <input type="password" name="password" placeholder="${t.password}" required minlength="6">
          </div>
          <div class="info-box"><i class="fas fa-info-circle"></i> ${t.info}</div>
          <button type="submit" class="btn"><i class="fas fa-user-plus"></i> ${t.create}</button>
        </form>
        <div class="links">
          ${t.have} <a href="/login?lang=${lang}">${t.signin}</a>
        </div>
        <div class="lang-switch">
          <a href="?lang=ar">العربية</a>
          <a href="?lang=en">English</a>
          <a href="?lang=fr">Français</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/register', async (req, res) => {
  const { username, phone, password, lang } = req.body;
  const db = readDB();
  if (db.users.find(u => u.username === username)) {
    return res.send(`<script>alert("Username already taken"); window.location="/register?lang=${lang || 'ar'}";</script>`);
  }
  if (db.users.find(u => u.phone === phone)) {
    return res.send(`<script>alert("Phone already registered"); window.location="/register?lang=${lang || 'ar'}";</script>`);
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  const result = await sendOTP(phone, otp);
  req.session.tempUser = { username, phone, password, language: lang || 'ar' };
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify - FaceLove Pro Max</title>
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
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
          text-align: center;
        }
        .auth .brand i { font-size: 44px; color: #d4af37; margin-bottom: 12px; }
        .auth .brand h1 { color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #888; font-size: 14px; margin-top: 4px; }
        .auth .info-box {
          background: rgba(212,175,55,0.05);
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 14px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(212,175,55,0.1);
        }
        .auth .info-box i { margin-right: 8px; }
        .auth .form-group input {
          width: 100%;
          padding: 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 24px;
          text-align: center;
          letter-spacing: 12px;
          font-weight: 700;
          transition: 0.3s;
          outline: none;
          margin: 16px 0;
        }
        .auth .form-group input:focus { border-color: #d4af37; }
        .auth .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 14px;
          color: #0a0a0a;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 35px rgba(212, 175, 55, 0.3); }
        .auth .btn i { margin-right: 8px; }
        .auth .links { margin-top: 18px; color: #666; font-size: 14px; }
        .auth .links a { color: #d4af37; text-decoration: none; font-weight: 600; }
        .auth .links a:hover { text-decoration: underline; }
        .auth .note { font-size: 12px; color: #444; margin-top: 12px; }
        @media (max-width: 480px) { .auth { padding: 30px 20px; } }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-shield-alt"></i>
          <h1>Face<span>Love</span> Pro Max</h1>
          <p>Enter verification code</p>
        </div>
        ${result.mock ? '<div class="info-box"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
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
    id: 'u' + genId(),
    username: temp.username,
    phone: temp.phone,
    password: temp.password,
    verified: true,
    active: true,
    role: 'user',
    gold: false,
    joined: new Date().toISOString(),
    bio: 'Welcome to FaceLove Pro Max!',
    avatar: '',
    cover: '',
    language: temp.language || 'ar',
    theme: 'dark',
    verifiedBadge: false // request pending
  };
  db.users.push(newUser);
  db.otps = db.otps.filter(o => o.phone !== phone);
  writeDB(db);
  req.session.tempUser = null;
  req.session.userId = newUser.id;
  req.session.lang = newUser.language;
  res.redirect('/dashboard');
});

// --- DASHBOARD ---
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.redirect('/login');
  if (user.active === false) return res.redirect('/login?error=Account deactivated');

  const lang = req.session.lang || user.language || 'ar';
  const settings = db.settings || { theme: 'dark', defaultLanguage: 'ar', musicEnabled: true, quranEnabled: true };
  const theme = user.theme || settings.theme || 'dark';
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0a0a0a' : '#f5f5f5';
  const cardBg = isDark ? 'rgba(20,20,20,0.8)' : 'rgba(255,255,255,0.9)';
  const textColor = isDark ? '#e0e0e0' : '#1a1a1a';
  const borderColor = isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.3)';
  const inputBg = isDark ? 'rgba(30,30,30,0.8)' : 'rgba(240,240,240,0.9)';

  // Language texts (simplified for brevity, we'll use a large object)
  const L = {
    ar: {
      feed: 'الرئيسية', search: 'بحث', profile: 'الملف الشخصي', friends: 'الأصدقاء', chat: 'المحادثات',
      admin: 'لوحة الأدمن', post: 'نشر', what: 'ما الذي يخطر ببالك؟', addMedia: 'إضافة وسائط',
      noPosts: 'لا توجد منشورات بعد', editProfile: 'تعديل الملف', changePassword: 'تغيير كلمة المرور',
      bio: 'السيرة الذاتية', username: 'اسم المستخدم', currentPass: 'كلمة المرور الحالية',
      newPass: 'كلمة المرور الجديدة', confirmPass: 'تأكيد كلمة المرور', save: 'حفظ',
      cancel: 'إلغاء', friendRequests: 'طلبات الصداقة', suggested: 'مقترحون',
      accept: 'قبول', decline: 'رفض', add: 'إضافة', noFriends: 'لا يوجد أصدقاء',
      noRequests: 'لا توجد طلبات', noSuggested: 'لا يوجد اقتراحات', noChats: 'لا توجد محادثات',
      typeMsg: 'اكتب رسالة...', send: 'إرسال', back: 'رجوع', noMessages: 'لا توجد رسائل',
      adminUsers: 'المستخدمين', adminPosts: 'المنشورات', grantGold: 'منح العلامة الذهبية',
      removeGold: 'إزالة العلامة الذهبية', deactivate: 'تعطيل', activate: 'تفعيل',
      delete: 'حذف', totalUsers: 'إجمالي المستخدمين', totalPosts: 'إجمالي المنشورات',
      totalLikes: 'إجمالي الإعجابات', activeUsers: 'المستخدمين النشطين',
      themeLabel: 'المظهر', light: 'فاتح', dark: 'داكن', music: 'الموسيقى',
      quran: 'القرآن الكريم', selectMusic: 'اختر أغنية', selectSurah: 'اختر سورة',
      verificationRequest: 'طلب توثيق الحساب', sendRequest: 'إرسال طلب توثيق',
      pending: 'قيد الانتظار', verified: 'موثق'
    },
    en: {
      feed: 'Feed', search: 'Search', profile: 'Profile', friends: 'Friends', chat: 'Chat',
      admin: 'Admin Dashboard', post: 'Post', what: 'What\'s on your mind?', addMedia: 'Add Media',
      noPosts: 'No posts yet', editProfile: 'Edit Profile', changePassword: 'Change Password',
      bio: 'Bio', username: 'Username', currentPass: 'Current Password',
      newPass: 'New Password', confirmPass: 'Confirm Password', save: 'Save',
      cancel: 'Cancel', friendRequests: 'Friend Requests', suggested: 'Suggested',
      accept: 'Accept', decline: 'Decline', add: 'Add', noFriends: 'No friends',
      noRequests: 'No requests', noSuggested: 'No suggestions', noChats: 'No chats',
      typeMsg: 'Type a message...', send: 'Send', back: 'Back', noMessages: 'No messages',
      adminUsers: 'Users', adminPosts: 'Posts', grantGold: 'Grant Gold Badge',
      removeGold: 'Remove Gold Badge', deactivate: 'Deactivate', activate: 'Activate',
      delete: 'Delete', totalUsers: 'Total Users', totalPosts: 'Total Posts',
      totalLikes: 'Total Likes', activeUsers: 'Active Users',
      themeLabel: 'Theme', light: 'Light', dark: 'Dark', music: 'Music',
      quran: 'Holy Quran', selectMusic: 'Select a song', selectSurah: 'Select a Surah',
      verificationRequest: 'Account Verification Request', sendRequest: 'Send Verification Request',
      pending: 'Pending', verified: 'Verified'
    },
    fr: {
      feed: 'Fil d\'actualité', search: 'Recherche', profile: 'Profil', friends: 'Amis', chat: 'Discussion',
      admin: 'Tableau de bord Admin', post: 'Publier', what: 'Quoi de neuf ?', addMedia: 'Ajouter des médias',
      noPosts: 'Aucune publication', editProfile: 'Modifier le profil', changePassword: 'Changer le mot de passe',
      bio: 'Biographie', username: 'Nom d\'utilisateur', currentPass: 'Mot de passe actuel',
      newPass: 'Nouveau mot de passe', confirmPass: 'Confirmer le mot de passe', save: 'Enregistrer',
      cancel: 'Annuler', friendRequests: 'Demandes d\'amis', suggested: 'Suggestions',
      accept: 'Accepter', decline: 'Refuser', add: 'Ajouter', noFriends: 'Pas d\'amis',
      noRequests: 'Pas de demandes', noSuggested: 'Pas de suggestions', noChats: 'Pas de discussions',
      typeMsg: 'Écrivez un message...', send: 'Envoyer', back: 'Retour', noMessages: 'Pas de messages',
      adminUsers: 'Utilisateurs', adminPosts: 'Publications', grantGold: 'Accorder le badge Or',
      removeGold: 'Retirer le badge Or', deactivate: 'Désactiver', activate: 'Activer',
      delete: 'Supprimer', totalUsers: 'Total utilisateurs', totalPosts: 'Total publications',
      totalLikes: 'Total likes', activeUsers: 'Utilisateurs actifs',
      themeLabel: 'Thème', light: 'Clair', dark: 'Sombre', music: 'Musique',
      quran: 'Saint Coran', selectMusic: 'Choisir une chanson', selectSurah: 'Choisir une Sourate',
      verificationRequest: 'Demande de vérification de compte', sendRequest: 'Envoyer une demande de vérification',
      pending: 'En attente', verified: 'Vérifié'
    }
  };
  const t = L[lang] || L.ar;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <title>FaceLove Pro Max</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        :root {
          --bg: ${bgColor};
          --card-bg: ${cardBg};
          --text: ${textColor};
          --border: ${borderColor};
          --input-bg: ${inputBg};
          --gold: #d4af37;
          --gold-grad: linear-gradient(135deg, #d4af37, #f9d976);
        }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-bottom: 80px;
          padding-top: 70px;
          transition: background 0.3s, color 0.3s;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 10px; }

        .top-nav {
          position: fixed; top: 0; left: 0; right: 0; height: 65px;
          background: var(--card-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; z-index: 100;
        }
        .top-nav .brand { font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
        .top-nav .brand i { color: var(--gold); }
        .top-nav .brand span { color: var(--gold); }
        .top-nav .actions { display: flex; align-items: center; gap: 16px; }
        .top-nav .actions .user-badge {
          display: flex; align-items: center; gap: 8px;
          background: rgba(30,30,30,0.6); padding: 4px 14px 4px 6px;
          border-radius: 30px; border: 1px solid var(--border);
        }
        .top-nav .actions .user-badge .avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--gold-grad);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #0a0a0a;
        }
        .top-nav .actions .user-badge .name { font-size: 13px; font-weight: 500; color: var(--text); }
        .top-nav .actions .user-badge .gold-badge { color: var(--gold); font-size: 14px; text-shadow: 0 0 20px rgba(212,175,55,0.5); }
        .top-nav .actions a { color: #888; font-size: 18px; transition: 0.3s; text-decoration: none; }
        .top-nav .actions a:hover { color: var(--gold); }

        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; height: 72px;
          background: var(--card-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid var(--border);
          display: flex; justify-content: space-around; align-items: center; z-index: 100;
        }
        .bottom-nav a {
          color: #555; font-size: 22px; text-decoration: none;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          transition: 0.3s; padding: 4px 12px; border-radius: 12px; position: relative;
        }
        .bottom-nav a span { font-size: 9px; font-weight: 600; letter-spacing: 0.5px; color: #555; transition: 0.3s; }
        .bottom-nav a:hover { color: var(--gold); }
        .bottom-nav a:hover span { color: var(--gold); }
        .bottom-nav a.active { color: var(--gold); }
        .bottom-nav a.active span { color: var(--gold); }

        .content { max-width: 780px; margin: 0 auto; padding: 0 16px; }
        .page { display: none; animation: fadeUp 0.4s ease; }
        .page.active { display: block; }
        @keyframes fadeUp { 0% { opacity:0; transform:translateY(20px); } 100% { opacity:1; transform:translateY(0); } }

        .card {
          background: var(--card-bg);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 20px 22px;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          transition: 0.4s;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .card:hover { border-color: var(--gold); box-shadow: 0 8px 40px rgba(212,175,55,0.05); }
        .card .title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
        .card .title i { color: var(--gold); }

        .post-box textarea {
          width: 100%; padding: 16px 18px; background: var(--input-bg);
          border: 2px solid transparent; border-radius: 16px; color: var(--text);
          font-size: 15px; font-family: inherit; resize: vertical; min-height: 80px;
          outline: none; transition: 0.3s;
        }
        .post-box textarea:focus { border-color: var(--gold); background: var(--input-bg); box-shadow: 0 0 25px rgba(212,175,55,0.05); }
        .post-box .actions {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 14px; flex-wrap: wrap; gap: 10px;
        }
        .post-box .actions .media-options { display: flex; gap: 16px; align-items: center; }
        .post-box .actions .media-options label { color: #888; font-size: 20px; cursor: pointer; transition: 0.3s; }
        .post-box .actions .media-options label:hover { color: var(--gold); }
        .post-box .actions .media-options .file-name { font-size: 12px; color: #666; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .post-box .actions .btn-post {
          background: var(--gold-grad);
          border: none; padding: 12px 32px; border-radius: 30px;
          color: #0a0a0a; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.3s;
        }
        .post-box .actions .btn-post:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(212, 175, 55, 0.3); }

        .feed-post {
          background: var(--card-bg);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-radius: 20px; padding: 18px 20px; margin-bottom: 14px;
          border: 1px solid var(--border); transition: 0.4s;
        }
        .feed-post:hover { border-color: var(--gold); box-shadow: 0 8px 30px rgba(212,175,55,0.04); }
        .feed-post .header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .feed-post .header .avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: var(--gold-grad);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: #0a0a0a;
          flex-shrink: 0; position: relative;
        }
        .feed-post .header .avatar .gold-badge {
          position: absolute; bottom: -2px; right: -2px;
          font-size: 14px; color: var(--gold); text-shadow: 0 0 20px rgba(212,175,55,0.6);
        }
        .feed-post .header .info { flex: 1; }
        .feed-post .header .info .name {
          font-weight: 700; font-size: 15px; color: #fff;
          display: flex; align-items: center; gap: 6px;
        }
        .feed-post .header .info .name .gold-icon { color: var(--gold); font-size: 14px; text-shadow: 0 0 20px rgba(212,175,55,0.4); }
        .feed-post .header .info .time { font-size: 12px; color: #666; margin-top: 2px; }
        .feed-post .body { margin: 6px 0 14px; line-height: 1.8; font-size: 15px; }
        .feed-post .body .media { margin-top: 12px; border-radius: 16px; overflow: hidden; background: #1a1a1a; }
        .feed-post .body .media img, .feed-post .body .media video { width: 100%; max-height: 450px; object-fit: cover; display: block; }
        .feed-post .actions { display: flex; gap: 24px; padding-top: 14px; border-top: 1px solid var(--border); }
        .feed-post .actions button {
          background: none; border: none; color: #777; font-size: 15px;
          cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 6px; font-weight: 500;
        }
        .feed-post .actions button:hover { color: var(--gold); }
        .feed-post .actions button.liked { color: var(--gold); }
        .feed-post .comments { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
        .feed-post .comments .comment { display: flex; gap: 10px; margin: 6px 0; font-size: 14px; }
        .feed-post .comments .comment .cname { font-weight: 700; color: var(--gold); }
        .feed-post .comments .comment .ctext { color: #ccc; }
        .feed-post .comments input {
          width: 100%; padding: 10px 16px; background: var(--input-bg);
          border: 2px solid transparent; border-radius: 30px; color: var(--text);
          font-size: 14px; outline: none; margin-top: 8px; transition: 0.3s;
        }
        .feed-post .comments input:focus { border-color: var(--gold); }

        .profile-header { text-align: center; padding: 20px 0; }
        .profile-header .avatar {
          width: 100px; height: 100px; border-radius: 50%;
          background: var(--gold-grad);
          display: flex; align-items: center; justify-content: center;
          font-size: 36px; font-weight: 700; color: #0a0a0a;
          margin: 0 auto 16px; box-shadow: 0 0 50px rgba(212,175,55,0.2);
          position: relative; cursor: pointer;
        }
        .profile-header .avatar .camera {
          position: absolute; bottom: 0; right: 0;
          background: var(--gold); border-radius: 50%; padding: 6px;
          font-size: 14px; border: 3px solid var(--bg); color: #0a0a0a;
        }
        .profile-header .name { font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .profile-header .name .gold-icon { color: var(--gold); font-size: 20px; text-shadow: 0 0 30px rgba(212,175,55,0.5); }
        .profile-header .bio { color: #888; font-size: 14px; margin-top: 4px; }
        .profile-header .stats { display: flex; justify-content: center; gap: 40px; margin-top: 20px; }
        .profile-header .stats .stat { text-align: center; }
        .profile-header .stats .stat .num { font-size: 20px; font-weight: 700; color: #fff; }
        .profile-header .stats .stat .label { font-size: 12px; color: #666; }
        .profile-header .edit-btn {
          margin-top: 16px; padding: 10px 30px;
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 30px; color: #fff; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        .profile-header .edit-btn:hover { border-color: var(--gold); background: var(--card-bg); }

        .friend-item {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 16px; background: var(--input-bg);
          border-radius: 14px; margin-bottom: 10px; transition: 0.3s; cursor: pointer;
        }
        .friend-item:hover { background: var(--card-bg); }
        .friend-item .avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--gold-grad);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; color: #0a0a0a;
          flex-shrink: 0; position: relative;
        }
        .friend-item .avatar .gold-badge-sm { position: absolute; bottom: -2px; right: -2px; font-size: 12px; color: var(--gold); text-shadow: 0 0 20px rgba(212,175,55,0.5); }
        .friend-item .info { flex: 1; }
        .friend-item .info .name { font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px; }
        .friend-item .info .name .gold-icon-sm { color: var(--gold); font-size: 12px; }
        .friend-item .info .status { font-size: 12px; color: #666; }
        .friend-item .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .friend-item .actions .btn-sm {
          padding: 6px 16px; border: none; border-radius: 30px;
          font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        .friend-item .actions .btn-sm.primary { background: var(--gold-grad); color: #0a0a0a; }
        .friend-item .actions .btn-sm.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212,175,55,0.3); }
        .friend-item .actions .btn-sm.success { background: #27ae60; color: #fff; }
        .friend-item .actions .btn-sm.success:hover { background: #2ecc71; }
        .friend-item .actions .btn-sm.danger { background: #c0392b; color: #fff; }
        .friend-item .actions .btn-sm.danger:hover { background: #e74c3c; }
        .friend-item .actions .btn-sm.secondary { background: #555; color: #fff; }
        .friend-item .actions .btn-sm.secondary:hover { background: #666; }
        .friend-item .actions i { font-size: 18px; color: #666; cursor: pointer; transition: 0.3s; padding: 6px; }
        .friend-item .actions i:hover { color: var(--gold); }

        .chat-messages {
          background: var(--input-bg);
          border-radius: 14px; padding: 16px;
          max-height: 350px; overflow-y: auto; margin-bottom: 12px;
        }
        .chat-messages .msg { margin: 4px 0; padding: 8px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); font-size: 14px; }
        .chat-messages .msg .sender { font-weight: 700; color: var(--gold); margin-right: 6px; }
        .chat-messages .msg .text { color: #ccc; }
        .chat-input { display: flex; gap: 10px; }
        .chat-input input {
          flex: 1; padding: 12px 18px; background: var(--input-bg);
          border: 2px solid transparent; border-radius: 30px; color: var(--text);
          font-size: 14px; outline: none; transition: 0.3s;
        }
        .chat-input input:focus { border-color: var(--gold); }
        .chat-input button {
          padding: 12px 24px; background: var(--gold-grad);
          border: none; border-radius: 30px; color: #0a0a0a;
          font-weight: 700; cursor: pointer; transition: 0.3s;
        }
        .chat-input button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212,175,55,0.3); }

        .admin-stats {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        .admin-stats .stat { background: var(--input-bg); padding: 16px; border-radius: 14px; text-align: center; }
        .admin-stats .stat .num { font-size: 24px; font-weight: 700; color: #fff; }
        .admin-stats .stat .label { font-size: 11px; color: #666; margin-top: 4px; }
        .admin-stats .stat .num.primary { color: var(--gold); }
        .admin-stats .stat .num.green { color: #27ae60; }
        .admin-stats .stat .num.blue { color: #3498db; }
        .admin-stats .stat .num.gold { color: var(--gold); }

        .admin-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .admin-item .info { flex: 1; }
        .admin-item .info .name { font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px; }
        .admin-item .info .name .gold-icon-sm { color: var(--gold); font-size: 14px; }
        .admin-item .info .sub { font-size: 12px; color: #666; }
        .admin-item .badge {
          font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 600;
        }
        .admin-item .badge.active { background: rgba(39,174,96,0.2); color: #27ae60; }
        .admin-item .badge.inactive { background: rgba(192,57,43,0.2); color: #e74c3c; }
        .admin-item .badge.gold { background: rgba(212,175,55,0.2); color: #d4af37; }
        .admin-item .badge.pending { background: rgba(241,196,15,0.2); color: #f1c40f; }
        .admin-item .actions { display: flex; gap: 4px; flex-wrap: wrap; }
        .admin-item .actions .btn-xs {
          padding: 4px 12px; border: none; border-radius: 20px;
          font-size: 11px; font-weight: 600; cursor: pointer; transition: 0.3s;
        }
        .admin-item .actions .btn-xs.danger { background: #c0392b; color: #fff; }
        .admin-item .actions .btn-xs.danger:hover { background: #e74c3c; }
        .admin-item .actions .btn-xs.success { background: #27ae60; color: #fff; }
        .admin-item .actions .btn-xs.success:hover { background: #2ecc71; }
        .admin-item .actions .btn-xs.gold { background: var(--gold); color: #0a0a0a; }
        .admin-item .actions .btn-xs.gold:hover { background: #f9d976; transform: translateY(-2px); }
        .admin-item .actions .btn-xs.secondary { background: #555; color: #fff; }

        .empty { text-align: center; padding: 40px 0; color: #666; }
        .empty i { font-size: 40px; display: block; margin-bottom: 12px; opacity: 0.3; }
        .empty p { font-size: 14px; }

        .search-bar {
          display: flex; align-items: center; background: var(--input-bg);
          border-radius: 30px; padding: 4px 18px; margin-bottom: 16px;
          border: 2px solid transparent; transition: 0.3s;
        }
        .search-bar:focus-within { border-color: var(--gold); box-shadow: 0 0 30px rgba(212,175,55,0.03); }
        .search-bar i { color: #666; font-size: 16px; }
        .search-bar input {
          flex: 1; background: transparent; border: none; padding: 12px 14px;
          color: var(--text); font-size: 14px; outline: none;
        }

        .modal {
          display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          align-items: center; justify-content: center; z-index: 200; padding: 20px;
        }
        .modal.active { display: flex; }
        .modal .modal-content {
          background: var(--card-bg); border-radius: 24px; padding: 30px 28px;
          max-width: 440px; width: 100%; border: 1px solid var(--border);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .modal .modal-content .title { font-size: 18px; font-weight: 700; margin-bottom: 16px; text-align: center; }
        .modal .modal-content .title i { color: var(--gold); margin-right: 8px; }
        .modal .modal-content .form-group { margin-bottom: 12px; }
        .modal .modal-content .form-group input,
        .modal .modal-content .form-group textarea {
          width: 100%; padding: 12px 16px; background: var(--input-bg);
          border: 2px solid transparent; border-radius: 12px; color: var(--text);
          font-size: 14px; outline: none; transition: 0.3s; font-family: inherit;
        }
        .modal .modal-content .form-group input:focus,
        .modal .modal-content .form-group textarea:focus { border-color: var(--gold); }
        .modal .modal-content .btn {
          width: 100%; padding: 14px; background: var(--gold-grad);
          border: none; border-radius: 12px; color: #0a0a0a;
          font-weight: 700; font-size: 15px; cursor: pointer; transition: 0.3s;
        }
        .modal .modal-content .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(212,175,55,0.3); }
        .modal .modal-content .btn.cancel {
          background: transparent; border: 1px solid var(--border); color: #888; margin-top: 8px;
        }
        .modal .modal-content .btn.cancel:hover { border-color: var(--gold); color: #fff; transform: none; box-shadow: none; }

        /* Music & Quran player */
        .player-bar {
          background: var(--card-bg);
          border-radius: 16px;
          padding: 12px 16px;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .player-bar select {
          background: var(--input-bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 30px;
          padding: 6px 14px;
          font-size: 13px;
          outline: none;
          flex: 1;
          min-width: 120px;
        }
        .player-bar audio {
          width: 100%;
          max-width: 200px;
          height: 30px;
        }
        .player-bar .player-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .player-bar .player-controls button {
          background: var(--gold-grad);
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          color: #0a0a0a;
          font-size: 16px;
          cursor: pointer;
          transition: 0.3s;
        }
        .player-bar .player-controls button:hover { transform: scale(1.05); }

        .lang-switch-top {
          display: flex;
          gap: 6px;
        }
        .lang-switch-top a {
          color: #888;
          text-decoration: none;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 20px;
          border: 1px solid #333;
          transition: 0.3s;
        }
        .lang-switch-top a:hover { border-color: var(--gold); color: var(--gold); }

        @media (max-width: 640px) {
          .content { padding: 0 10px; }
          .card { padding: 16px; }
          .top-nav { padding: 0 14px; height: 58px; }
          .top-nav .brand { font-size: 17px; }
          .top-nav .actions .user-badge .name { display: none; }
          .bottom-nav { height: 65px; }
          .bottom-nav a { font-size: 18px; padding: 2px 8px; }
          .bottom-nav a span { font-size: 8px; }
          .profile-header .stats { gap: 20px; }
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .post-box .actions { flex-direction: column; align-items: stretch; }
          .post-box .actions .media-options { flex-wrap: wrap; }
          .player-bar { flex-direction: column; align-items: stretch; }
          .player-bar audio { max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <!-- TOP NAV -->
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-crown"></i>Face<span>Love</span> Pro Max</div>
        <div class="actions">
          <div class="lang-switch-top">
            <a href="#" onclick="changeLang('ar')">ع</a>
            <a href="#" onclick="changeLang('en')">En</a>
            <a href="#" onclick="changeLang('fr')">Fr</a>
          </div>
          <div class="user-badge">
            <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
            <span class="name">${user.username}</span>
            ${user.gold ? '<span class="gold-badge"><i class="fas fa-crown"></i></span>' : ''}
          </div>
          <a href="/logout"><i class="fas fa-sign-out-alt"></i></a>
        </div>
      </nav>

      <!-- CONTENT -->
      <div class="content">
        <!-- FEED -->
        <div id="page-feed" class="page active">
          <!-- Player Bar -->
          <div class="player-bar">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; flex:1;">
              <i class="fas fa-music" style="color:var(--gold);"></i>
              <select id="musicSelect" onchange="playMusic()">
                <option value="">${t.selectMusic}</option>
                ${db.musicLibrary.map(m => `<option value="${m.url}">${m.title} - ${m.artist}</option>`).join('')}
              </select>
              <i class="fas fa-quran" style="color:var(--gold);"></i>
              <select id="quranSelect" onchange="playQuran()">
                <option value="">${t.selectSurah}</option>
                ${db.quranLibrary.map(q => `<option value="${q.url}">${q.surah}</option>`).join('')}
              </select>
            </div>
            <div class="player-controls">
              <button onclick="togglePlayer()"><i id="playerIcon" class="fas fa-play"></i></button>
              <button onclick="stopPlayer()"><i class="fas fa-stop"></i></button>
            </div>
            <audio id="audioPlayer" style="display:none;"></audio>
          </div>

          <div class="card post-box">
            <textarea id="postText" placeholder="${t.what}" rows="3"></textarea>
            <div class="actions">
              <div class="media-options">
                <label for="imageInput" title="${t.addMedia}"><i class="fas fa-image"></i></label>
                <label for="videoInput" title="${t.addMedia}"><i class="fas fa-video"></i></label>
                <input type="file" id="imageInput" accept="image/*" style="display:none" onchange="uploadMedia(this, 'image')">
                <input type="file" id="videoInput" accept="video/*" style="display:none" onchange="uploadMedia(this, 'video')">
                <span class="file-name" id="fileName"></span>
              </div>
              <button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> ${t.post}</button>
            </div>
          </div>
          <div id="feedContainer"></div>
        </div>

        <!-- SEARCH -->
        <div id="page-search" class="page">
          <div class="search-bar">
            <i class="fas fa-search"></i>
            <input type="text" id="searchInput" placeholder="${t.search}..." oninput="searchContent()">
          </div>
          <div id="searchResults"></div>
        </div>

        <!-- PROFILE -->
        <div id="page-profile" class="page">
          <div class="card">
            <div class="profile-header">
              <div class="avatar" onclick="document.getElementById('avatarInput').click()">
                ${user.username.charAt(0).toUpperCase()}
                <div class="camera"><i class="fas fa-camera"></i></div>
              </div>
              <input type="file" id="avatarInput" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
              <div class="name">
                ${user.username}
                ${user.gold ? '<span class="gold-icon"><i class="fas fa-crown"></i></span>' : ''}
                ${user.verifiedBadge ? '<span style="color:#3498db;font-size:18px;"><i class="fas fa-check-circle"></i></span>' : ''}
              </div>
              <div class="bio">${user.bio || ''}</div>
              <div class="stats">
                <div class="stat"><div class="num" id="postCount">0</div><div class="label">${t.totalPosts}</div></div>
                <div class="stat"><div class="num" id="friendCount">0</div><div class="label">${t.friends}</div></div>
                <div class="stat"><div class="num" id="likeCount">0</div><div class="label">${t.totalLikes}</div></div>
              </div>
              <button class="edit-btn" onclick="openEditProfile()"><i class="fas fa-edit"></i> ${t.editProfile}</button>
              <button class="edit-btn" style="margin-top:8px;" onclick="openChangePassword()"><i class="fas fa-key"></i> ${t.changePassword}</button>
              <button class="edit-btn" style="margin-top:8px;border-color:var(--gold);" onclick="requestVerification()">
                ${user.verifiedBadge ? '<i class="fas fa-check-circle" style="color:#3498db;"></i> ' + t.verified : '<i class="fas fa-certificate"></i> ' + t.sendRequest}
              </button>
            </div>
          </div>
          <div id="profilePosts"></div>
        </div>

        <!-- FRIENDS -->
        <div id="page-friends" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-user-friends"></i> ${t.friends}</div>
            <div id="friendsList"></div>
          </div>
          <div class="card">
            <div class="title"><i class="fas fa-handshake"></i> ${t.friendRequests}</div>
            <div id="friendRequests"></div>
          </div>
          <div class="card">
            <div class="title"><i class="fas fa-user-plus"></i> ${t.suggested}</div>
            <div id="suggestedUsers"></div>
          </div>
        </div>

        <!-- CHAT -->
        <div id="page-chat" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-comments"></i> ${t.chat}</div>
            <div id="chatList"></div>
            <div id="chatDetail" style="display:none;">
              <div id="chatMessages" class="chat-messages"></div>
              <div class="chat-input">
                <input type="text" id="chatInput" placeholder="${t.typeMsg}" onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
              </div>
              <button onclick="closeChat()" style="margin-top:10px;background:none;border:none;color:var(--gold);cursor:pointer;font-size:13px;"><i class="fas fa-arrow-left"></i> ${t.back}</button>
            </div>
          </div>
        </div>

        <!-- ADMIN -->
        <div id="page-admin" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-crown"></i> ${t.admin}</div>
            <div id="adminStats" class="admin-stats"></div>
            <div id="adminContent"></div>
          </div>
        </div>
      </div>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>${t.feed}</span></a>
        <a href="#" data-page="search"><i class="fas fa-search"></i><span>${t.search}</span></a>
        <a href="#" data-page="profile"><i class="fas fa-user"></i><span>${t.profile}</span></a>
        <a href="#" data-page="friends"><i class="fas fa-users"></i><span>${t.friends}</span></a>
        <a href="#" data-page="chat"><i class="fas fa-comment-dots"></i><span>${t.chat}</span></a>
        ${user.role === 'admin' ? '<a href="#" data-page="admin"><i class="fas fa-crown"></i><span>'+t.admin+'</span></a>' : ''}
      </nav>

      <!-- MODALS -->
      <div id="editProfileModal" class="modal">
        <div class="modal-content">
          <div class="title"><i class="fas fa-user-edit"></i> ${t.editProfile}</div>
          <form id="editProfileForm">
            <div class="form-group">
              <input type="text" id="editUsername" placeholder="${t.username}" value="${user.username}">
            </div>
            <div class="form-group">
              <textarea id="editBio" placeholder="${t.bio}" rows="2">${user.bio || ''}</textarea>
            </div>
            <button type="submit" class="btn"><i class="fas fa-save"></i> ${t.save}</button>
            <button type="button" class="btn cancel" onclick="closeEditProfile()">${t.cancel}</button>
          </form>
        </div>
      </div>

      <div id="changePasswordModal" class="modal">
        <div class="modal-content">
          <div class="title"><i class="fas fa-key"></i> ${t.changePassword}</div>
          <form id="changePasswordForm">
            <div class="form-group">
              <input type="password" id="currentPassword" placeholder="${t.currentPass}" required>
            </div>
            <div class="form-group">
              <input type="password" id="newPassword" placeholder="${t.newPass}" required minlength="6">
            </div>
            <div class="form-group">
              <input type="password" id="confirmPassword" placeholder="${t.confirmPass}" required minlength="6">
            </div>
            <button type="submit" class="btn"><i class="fas fa-save"></i> ${t.save}</button>
            <button type="button" class="btn cancel" onclick="closeChangePassword()">${t.cancel}</button>
          </form>
        </div>
      </div>

      <script>
        // ========== CONFIG ==========
        const currentUser = {
          id: "${user.id}",
          username: "${user.username}",
          role: "${user.role || 'user'}",
          gold: ${user.gold || false},
          verifiedBadge: ${user.verifiedBadge || false}
        };
        let currentChatWith = null;
        let uploadedFile = null;
        let audioPlayer = document.getElementById('audioPlayer');
        let isPlaying = false;

        // ========== NAVIGATION ==========
        document.querySelectorAll('.bottom-nav a[data-page]').forEach(el => {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + page).classList.add('active');
            document.querySelectorAll('.bottom-nav a[data-page]').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            if (page === 'feed') loadFeed();
            if (page === 'search') searchContent();
            if (page === 'profile') loadProfile();
            if (page === 'friends') loadFriends();
            if (page === 'chat') loadChatList();
            if (page === 'admin' && currentUser.role === 'admin') loadAdmin();
          });
        });

        // ========== LANGUAGE ==========
        function changeLang(lang) {
          fetch('/api/set-lang', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang })
          }).then(() => location.reload());
        }

        // ========== MEDIA UPLOAD ==========
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

        // ========== POSTS ==========
        async function createPost() {
          const text = document.getElementById('postText').value;
          let media = uploadedFile;
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

        async function loadFeed() {
          try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            document.getElementById('feedContainer').innerHTML = posts.length ?
              posts.map(p => renderPost(p)).join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>${t.noPosts}</p></div>';
          } catch(e) { console.error(e); }
        }

        function renderPost(p) {
          const liked = p.likes && p.likes.includes(currentUser.id);
          const mediaHtml = p.media ?
            (p.mediaType === 'video' ?
              '<div class="media"><video controls src="'+p.media+'"></video></div>' :
              '<div class="media"><img src="'+p.media+'" alt="post"></div>') : '';
          const goldBadge = p.userGold ? '<span class="gold-icon"><i class="fas fa-crown"></i></span>' : '';
          return \`
            <div class="feed-post">
              <div class="header">
                <div class="avatar">
                  \${p.userName ? p.userName.charAt(0).toUpperCase() : '?'}
                  \${p.userGold ? '<span class="gold-badge"><i class="fas fa-crown"></i></span>' : ''}
                </div>
                <div class="info">
                  <div class="name">
                    \${p.userName || 'User'}
                    \${p.userGold ? '<span class="gold-icon"><i class="fas fa-crown"></i></span>' : ''}
                    \${p.userVerified ? '<span style="color:#3498db;font-size:14px;"><i class="fas fa-check-circle"></i></span>' : ''}
                  </div>
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
                <input type="text" placeholder="${t.typeMsg}" onkeypress="if(event.key==='Enter') addComment('\${p.id}', this.value); this.value='';">
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
            navigator.share({ title: 'FaceLove Pro Max Post', text: 'Check this out!', url: url });
          } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
          }
        }

        // ========== SEARCH ==========
        async function searchContent() {
          const q = document.getElementById('searchInput').value;
          if (!q.trim()) { document.getElementById('searchResults').innerHTML = ''; return; }
          try {
            const res = await fetch('/api/search?q='+encodeURIComponent(q));
            const data = await res.json();
            let html = '';
            if (data.users && data.users.length) {
              html += '<div style="margin-bottom:12px;"><strong style="color:var(--gold);"><i class="fas fa-users"></i> ${t.friends}</strong></div>';
              html += data.users.map(u =>
                '<div class="friend-item"><div class="avatar">'+u.username.charAt(0).toUpperCase()+(u.gold ? '<span class="gold-badge-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="info"><div class="name">'+u.username+(u.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+(u.verifiedBadge ? ' <span style="color:#3498db;font-size:12px;"><i class="fas fa-check-circle"></i></span>' : '')+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><i class="fas fa-user-plus" onclick="sendFriendRequest(\\''+u.id+'\\')" title="${t.add}"></i><i class="fas fa-comment" onclick="startChat(\\''+u.id+'\\')" title="${t.chat}"></i></div></div>'
              ).join('');
            }
            if (data.posts && data.posts.length) {
              if (html) html += '<div style="margin:16px 0 8px;"><strong style="color:var(--gold);"><i class="fas fa-newspaper"></i> ${t.totalPosts}</strong></div>';
              html += data.posts.map(p => renderPost(p)).join('');
            }
            if (!html) html = '<div class="empty"><i class="fas fa-search"></i><p>No results found</p></div>';
            document.getElementById('searchResults').innerHTML = html;
          } catch(e) { console.error(e); }
        }

        // ========== PROFILE ==========
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

        function openEditProfile() {
          document.getElementById('editProfileModal').classList.add('active');
          document.getElementById('editUsername').value = '${user.username}';
          document.getElementById('editBio').value = '${user.bio || ''}';
        }
        function closeEditProfile() {
          document.getElementById('editProfileModal').classList.remove('active');
        }

        document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const username = document.getElementById('editUsername').value;
          const bio = document.getElementById('editBio').value;
          try {
            await fetch('/api/profile/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, bio })
            });
            closeEditProfile();
            location.reload();
          } catch(e) { alert('Failed to update profile'); }
        });

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
              alert('Password updated successfully!');
              closeChangePassword();
            } else {
              alert(data.error || 'Failed');
            }
          } catch(e) { alert('Failed to update password'); }
        });

        function requestVerification() {
          if (currentUser.verifiedBadge) {
            alert('Your account is already verified.');
            return;
          }
          fetch('/api/request-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).then(res => res.json()).then(data => {
            if (data.success) alert('Verification request sent to admin.');
            else alert('Failed to send request');
          }).catch(() => alert('Error'));
        }

        // ========== FRIENDS ==========
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            document.getElementById('friendsList').innerHTML = data.friends.length ?
              data.friends.map(f =>
                '<div class="friend-item"><div class="avatar">'+f.username.charAt(0).toUpperCase()+(f.gold ? '<span class="gold-badge-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="info"><div class="name">'+f.username+(f.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+(f.verifiedBadge ? ' <span style="color:#3498db;font-size:12px;"><i class="fas fa-check-circle"></i></span>' : '')+'</div><div class="status"><i class="fas fa-check-circle" style="color:#27ae60;"></i> ${t.friends}</div></div><div class="actions"><i class="fas fa-comment" onclick="startChat(\\''+f.id+'\\')" title="${t.chat}"></i><i class="fas fa-user-minus" onclick="unfriend(\\''+f.id+'\\')" title="${t.decline}" style="color:#c0392b;"></i></div></div>'
              ).join('') :
              '<div class="empty"><i class="fas fa-user-friends"></i><p>${t.noFriends}</p></div>';

            document.getElementById('friendRequests').innerHTML = data.requests.length ?
              data.requests.map(r =>
                '<div class="friend-item"><div class="avatar">'+r.username.charAt(0).toUpperCase()+(r.gold ? '<span class="gold-badge-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="info"><div class="name">'+r.username+(r.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="status"><i class="fas fa-clock" style="color:#f1c40f;"></i> ${t.pending}</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')">${t.accept}</button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')">${t.decline}</button></div></div>'
              ).join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>${t.noRequests}</p></div>';

            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ?
              data.suggested.map(u =>
                '<div class="friend-item"><div class="avatar">'+u.username.charAt(0).toUpperCase()+(u.gold ? '<span class="gold-badge-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="info"><div class="name">'+u.username+(u.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+(u.verifiedBadge ? ' <span style="color:#3498db;font-size:12px;"><i class="fas fa-check-circle"></i></span>' : '')+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')">${t.add}</button><button class="btn-sm secondary" onclick="startChat(\\''+u.id+'\\')"><i class="fas fa-comment"></i></button></div></div>'
              ).join('') :
              '<div class="empty"><i class="fas fa-check"></i><p>${t.noSuggested}</p></div>';
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

        async function unfriend(userId) {
          if (!confirm('Are you sure you want to remove this friend?')) return;
          try {
            await fetch('/api/unfriend', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            });
            loadFriends();
          } catch(e) { alert('Failed to unfriend'); }
        }

        // ========== CHAT ==========
        async function loadChatList() {
          try {
            const res = await fetch('/api/chat/list');
            const data = await res.json();
            document.getElementById('chatList').innerHTML = data.length ?
              data.map(u =>
                '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.username.charAt(0).toUpperCase()+(u.gold ? '<span class="gold-badge-sm"><i class="fas fa-crown"></i></span>' : '')+'</div><div class="info"><div class="name">'+u.username+(u.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+(u.verifiedBadge ? ' <span style="color:#3498db;font-size:12px;"><i class="fas fa-check-circle"></i></span>' : '')+'</div><div class="status"><i class="fas fa-comment"></i> ${t.chat}</div></div></div>'
              ).join('') :
              '<div class="empty"><i class="fas fa-comment-slash"></i><p>${t.noChats}</p></div>';
            document.getElementById('chatDetail').style.display = 'none';
          } catch(e) { console.error(e); }
        }

        function startChat(userId) {
          // Switch to chat page and open chat with user
          document.querySelector('.bottom-nav a[data-page="chat"]').click();
          setTimeout(() => openChat(userId), 200);
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
              '<div class="empty" style="padding:20px 0;"><i class="fas fa-comment-dots"></i><p>${t.noMessages}</p></div>';
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
          } catch(e) { alert('Failed to send message'); }
        }

        function closeChat() {
          document.getElementById('chatDetail').style.display = 'none';
          document.getElementById('chatList').style.display = 'block';
        }

        // ========== MUSIC & QURAN ==========
        function playMusic() {
          const select = document.getElementById('musicSelect');
          const url = select.value;
          if (!url) return;
          audioPlayer.src = url;
          audioPlayer.play();
          isPlaying = true;
          document.getElementById('playerIcon').className = 'fas fa-pause';
        }

        function playQuran() {
          const select = document.getElementById('quranSelect');
          const url = select.value;
          if (!url) return;
          audioPlayer.src = url;
          audioPlayer.play();
          isPlaying = true;
          document.getElementById('playerIcon').className = 'fas fa-pause';
        }

        function togglePlayer() {
          if (isPlaying) {
            audioPlayer.pause();
            isPlaying = false;
            document.getElementById('playerIcon').className = 'fas fa-play';
          } else {
            audioPlayer.play();
            isPlaying = true;
            document.getElementById('playerIcon').className = 'fas fa-pause';
          }
        }

        function stopPlayer() {
          audioPlayer.pause();
          audioPlayer.currentTime = 0;
          isPlaying = false;
          document.getElementById('playerIcon').className = 'fas fa-play';
        }

        // ========== ADMIN ==========
        async function loadAdmin() {
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            document.getElementById('adminStats').innerHTML = \`
              <div class="stat"><div class="num primary">\${data.stats.totalUsers}</div><div class="label">${t.totalUsers}</div></div>
              <div class="stat"><div class="num green">\${data.stats.totalPosts}</div><div class="label">${t.totalPosts}</div></div>
              <div class="stat"><div class="num blue">\${data.stats.totalLikes}</div><div class="label">${t.totalLikes}</div></div>
              <div class="stat"><div class="num gold">\${data.stats.activeUsers}</div><div class="label">${t.activeUsers}</div></div>
            \`;
            let html = '';
            html += '<div style="margin:16px 0 8px;"><strong style="color:var(--gold);"><i class="fas fa-users"></i> ${t.adminUsers}</strong></div>';
            data.users.forEach(u => {
              const verifiedStatus = u.verifiedBadge === true ? '✅' : (u.verifiedBadge === 'pending' ? '⏳' : '');
              html += '<div class="admin-item"><div class="info"><div class="name">'+u.username+(u.gold ? ' <span class="gold-icon-sm"><i class="fas fa-crown"></i></span>' : '')+(u.verifiedBadge === true ? ' <span style="color:#3498db;"><i class="fas fa-check-circle"></i></span>' : '')+'</div><div class="sub">'+u.phone+' • '+verifiedStatus+'</div></div><div class="badge '+(u.active !== false ? 'active' : 'inactive')+'">'+(u.active !== false ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs gold" onclick="adminToggleGold(\\''+u.id+'\\', '+(u.gold ? 'false' : 'true')+')">'+(u.gold ? 'Remove Gold' : 'Grant Gold')+'</button><button class="btn-xs '+(u.active !== false ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active !== false ? 'false' : 'true')+')">'+(u.active !== false ? 'Deactivate' : 'Activate')+'</button><button class="btn-xs success" onclick="adminVerifyUser(\\''+u.id+'\\')">Verify</button></div></div>';
            });
            html += '<div style="margin:20px 0 8px;"><strong style="color:var(--gold);"><i class="fas fa-newspaper"></i> ${t.adminPosts}</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+p.text.substring(0,60)+(p.text.length>60?'...':'')+'</div><div class="sub">by '+p.userName+'</div></div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">${t.delete}</button></div></div>';
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
          } catch(e) { alert('Failed to toggle user'); }
        }

        async function adminToggleGold(userId, gold) {
          try {
            await fetch('/api/admin/gold-toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, gold })
            });
            loadAdmin();
          } catch(e) { alert('Failed to toggle gold badge'); }
        }

        async function adminVerifyUser(userId) {
          try {
            await fetch('/api/admin/verify-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            });
            loadAdmin();
          } catch(e) { alert('Failed to verify user'); }
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
          } catch(e) { alert('Failed to delete post'); }
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

// ========== FORGOT PASSWORD (short) ==========
app.get('/forgot-password', (req, res) => {
  const lang = req.query.lang || 'ar';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Forgot Password</title>
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
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand { text-align: center; margin-bottom: 30px; }
        .auth .brand i { font-size: 38px; color: #d4af37; margin-bottom: 10px; }
        .auth .brand h1 { color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #888; font-size: 14px; margin-top: 4px; }
        .auth .form-group { margin-bottom: 16px; }
        .auth .form-group input {
          width: 100%;
          padding: 16px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus { border-color: #d4af37; }
        .auth .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 14px;
          color: #0a0a0a;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 35px rgba(212, 175, 55, 0.3); }
        .auth .links { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .auth .links a { color: #d4af37; text-decoration: none; font-weight: 600; }
        @media (max-width: 480px) { .auth { padding: 30px 20px; } }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-key"></i>
          <h1>Face<span>Love</span> Pro Max</h1>
          <p>Reset password</p>
        </div>
        <form action="/forgot-password" method="POST">
          <input type="hidden" name="lang" value="${lang}">
          <div class="form-group">
            <input type="text" name="phone" placeholder="Phone number" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-paper-plane"></i> Send Reset Code</button>
        </form>
        <div class="links"><a href="/login?lang=${lang}">Back to Sign In</a></div>
      </div>
    </body>
    </html>
  `);
});

app.post('/forgot-password', async (req, res) => {
  const { phone, lang } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.verified);
  if (!user) return res.send(`<script>alert("Phone not found"); window.location="/forgot-password?lang=${lang || 'ar'}";</script>`);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  const result = await sendOTP(phone, otp);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password</title>
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
          background: rgba(20,20,20,0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand { text-align: center; margin-bottom: 25px; }
        .auth .brand i { font-size: 38px; color: #d4af37; margin-bottom: 10px; }
        .auth .brand h1 { color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span { color: #d4af37; }
        .auth .brand p { color: #888; font-size: 14px; }
        .auth .info-box {
          background: rgba(212,175,55,0.05);
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 14px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(212,175,55,0.1);
          text-align: center;
        }
        .auth .form-group { margin-bottom: 16px; }
        .auth .form-group input {
          width: 100%;
          padding: 16px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus { border-color: #d4af37; }
        .auth .btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #d4af37, #f9d976);
          border: none;
          border-radius: 14px;
          color: #0a0a0a;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 35px rgba(212, 175, 55, 0.3); }
        .auth .note { font-size: 12px; color: #444; text-align: center; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-undo-alt"></i>
          <h1>Face<span>Love</span> Pro Max</h1>
          <p>Enter new password</p>
        </div>
        ${result.mock ? '<div class="info-box"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
        <form action="/reset-password" method="POST">
          <input type="hidden" name="phone" value="${phone}">
          <div class="form-group">
            <input type="password" name="newPassword" placeholder="New password" required minlength="6">
          </div>
          <button type="submit" class="btn"><i class="fas fa-save"></i> Update Password</button>
        </form>
        <div class="note"><i class="fas fa-whatsapp"></i> Code sent via WhatsApp</div>
      </div>
    </body>
    </html>
  `);
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

// ========== API ROUTES ==========

// --- SET LANGUAGE ---
app.post('/api/set-lang', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { lang } = req.body;
  req.session.lang = lang;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (user) {
    user.language = lang;
    writeDB(db);
  }
  res.json({ success: true });
});

// --- POSTS ---
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const posts = db.posts.sort((a,b) => b.timestamp - a.timestamp);
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return {
      ...p,
      userName: user ? user.username : 'User',
      userGold: user ? user.gold || false : false,
      userVerified: user ? user.verifiedBadge === true : false
    };
  });
  res.json(enriched);
});

app.post('/api/posts', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text, media } = req.body;
  const db = readDB();
  const post = {
    id: 'p' + genId(),
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
    userName: user ? user.username : 'User',
    text: text,
    timestamp: Date.now()
  });
  writeDB(db);
  res.json({ success: true });
});

// --- SEARCH ---
app.get('/api/search', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase() : '';
  const db = readDB();
  if (!q) return res.json({ users: [], posts: [] });
  const users = db.users.filter(u => u.verified && u.active !== false && u.id !== req.session.userId &&
    (u.username.toLowerCase().includes(q) || u.phone.includes(q)));
  const posts = db.posts.filter(p => p.text.toLowerCase().includes(q));
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return { ...p, userName: user ? user.username : 'User', userGold: user ? user.gold || false : false, userVerified: user ? user.verifiedBadge === true : false };
  });
  res.json({ users, posts: enriched });
});

// --- PROFILE ---
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
  const { username, bio } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (username) {
    const existing = db.users.find(u => u.username === username && u.id !== req.session.userId);
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    user.username = username;
  }
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

app.post('/api/request-verification', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.verifiedBadge) return res.status(400).json({ error: 'Already verified' });
  user.verifiedBadge = 'pending';
  writeDB(db);
  res.json({ success: true });
});

// --- FRIENDS ---
app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const friendsIds = db.friendships.filter(f =>
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const friends = db.users.filter(u => friendsIds.includes(u.id) && u.active !== false);
  const requests = db.friendships.filter(f => f.toUserId === req.session.userId && f.status === 'pending')
    .map(f => db.users.find(u => u.id === f.fromUserId)).filter(Boolean);
  const existing = db.friendships.filter(f => (f.fromUserId === req.session.userId || f.toUserId === req.session.userId));
  const existingIds = existing.map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  const suggested = db.users.filter(u => u.verified && u.active !== false && u.id !== req.session.userId &&
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
  if (exists) {
    if (exists.status === 'pending') return res.status(400).json({ error: 'Request already sent' });
    if (exists.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
  }
  db.friendships.push({
    id: 'f' + genId(),
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

app.post('/api/unfriend', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.body;
  const db = readDB();
  const idx = db.friendships.findIndex(f =>
    ((f.fromUserId === req.session.userId && f.toUserId === userId) ||
     (f.fromUserId === userId && f.toUserId === req.session.userId)) && f.status === 'accepted'
  );
  if (idx > -1) { db.friendships.splice(idx, 1); writeDB(db); }
  res.json({ success: true });
});

// --- CHAT ---
app.get('/api/chat/list', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  // Get all friends plus any user with whom there are messages (even if not friends)
  const friendsIds = db.friendships.filter(f =>
    (f.fromUserId === req.session.userId || f.toUserId === req.session.userId) && f.status === 'accepted'
  ).map(f => f.fromUserId === req.session.userId ? f.toUserId : f.fromUserId);
  // Also add users who have exchanged messages (for chat with non-friends)
  const msgUsers = db.messages.filter(m =>
    m.fromUserId === req.session.userId || m.toUserId === req.session.userId
  ).map(m => m.fromUserId === req.session.userId ? m.toUserId : m.fromUserId);
  const allIds = [...new Set([...friendsIds, ...msgUsers])];
  const users = db.users.filter(u => allIds.includes(u.id) && u.active !== false && u.id !== req.session.userId);
  res.json(users);
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
    return { ...m, senderName: sender ? sender.username : 'User' };
  });
  res.json(enriched);
});

app.post('/api/chat/send', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { toUserId, text } = req.body;
  const db = readDB();
  db.messages.push({
    id: 'm' + genId(),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    text: text,
    timestamp: Date.now()
  });
  writeDB(db);
  res.json({ success: true });
});

// --- ADMIN ---
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

app.post('/api/admin/gold-toggle', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { userId, gold } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.gold = gold;
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/admin/verify-user', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const admin = db.users.find(u => u.id === req.session.userId);
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { userId } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.verifiedBadge = true;
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

// --- THEME ---
app.post('/api/theme', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { theme } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (user) {
    user.theme = theme;
    writeDB(db);
    res.json({ success: true });
  } else res.status(404).json({ error: 'User not found' });
});

// ========== START ==========
app.listen(PORT, () => {
  console.log('👑 FaceLove Pro Max running on port ' + PORT);
  console.log('🌟 Ultimate Social Platform with all features');
});

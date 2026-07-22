// FaceLove Pro - Advanced Social Platform with AI
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== TWILIO CONFIG ==========
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC95d5f9dc91f11807734a883869ffc46d';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '4922f43a66a4af3dc8629a9194a7b7a7';
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';

let twilioClient = null;
let twilioEnabled = false;

try {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  twilioEnabled = true;
  console.log('✅ Twilio configured');
} catch (e) {
  console.log('⚠️ Twilio not configured');
}

// ========== MIDDLEWARE ==========
app.use(session({
  secret: 'facelove_pro_secret_key_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 * 30 }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));

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
      notifications: [],
      reports: [],
      aiAnalytics: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}
initDB();

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE));
  } catch (e) {
    return { users: [], otps: [], posts: [], stories: [], friendships: [], messages: [], notifications: [], reports: [], aiAnalytics: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ========== AI SIMULATION ==========
function analyzeText(text) {
  const sentiments = ['positive', 'neutral', 'negative'];
  const words = text.split(' ');
  let score = 0;
  const positiveWords = ['❤️', '♥️', 'love', 'happy', 'great', 'amazing', 'beautiful', 'wonderful', 'perfect', 'awesome'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'disappointed', 'angry', 'upset'];

  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (positiveWords.includes(clean)) score += 1;
    if (negativeWords.includes(clean)) score -= 1;
  });

  let sentiment = 'neutral';
  if (score > 0) sentiment = 'positive';
  if (score < 0) sentiment = 'negative';

  const suggestions = [];
  if (sentiment === 'positive') suggestions.push('✨ Keep spreading the positivity!');
  if (sentiment === 'negative') suggestions.push('💪 Stay strong, things will get better!');
  if (text.length > 100) suggestions.push('📝 Great detailed post!');
  if (text.includes('?') || text.includes('؟')) suggestions.push('🤔 Interesting question!');
  if (suggestions.length === 0) suggestions.push('🌟 Nice share!');

  return { sentiment, suggestions };
}

function generateSummary(text) {
  if (text.length <= 50) return text;
  const words = text.split(' ');
  const summary = words.slice(0, 15).join(' ');
  return summary + '...';
}

function suggestHashtags(text) {
  const words = text.split(' ');
  const common = ['love', 'life', 'happy', 'friends', 'family', 'travel', 'food', 'work', 'music', 'art', 'tech', 'nature'];
  const found = common.filter(w => words.some(word => word.toLowerCase().includes(w)));
  if (found.length === 0) return ['#facelove', '#social', '#community'];
  return found.map(w => '#' + w);
}

function getAIAnalytics(db) {
  const totalUsers = db.users.filter(u => u.verified).length;
  const totalPosts = db.posts.length;
  const totalMessages = db.messages.length;
  const totalLikes = db.posts.reduce((acc, p) => acc + (p.likes ? p.likes.length : 0), 0);

  const sentimentSummary = { positive: 0, neutral: 0, negative: 0 };
  db.posts.forEach(p => {
    const analysis = analyzeText(p.text || '');
    if (analysis.sentiment === 'positive') sentimentSummary.positive++;
    else if (analysis.sentiment === 'negative') sentimentSummary.negative++;
    else sentimentSummary.neutral++;
  });

  const activeUsers = new Set();
  db.posts.forEach(p => activeUsers.add(p.userId));
  db.messages.forEach(m => { activeUsers.add(m.fromUserId); activeUsers.add(m.toUserId); });

  return {
    totalUsers,
    totalPosts,
    totalMessages,
    totalLikes,
    activeUsers: activeUsers.size,
    sentimentSummary,
    engagementRate: totalUsers > 0 ? Math.round((totalLikes / totalUsers) * 10) / 10 : 0
  };
}

// ========== SEND OTP ==========
async function sendOTP(phone, otp) {
  if (!twilioEnabled) {
    console.log(`[MOCK] OTP for ${phone}: ${otp}`);
    return { success: true, mock: true };
  }
  try {
    await twilioClient.messages.create({
      body: `🔐 Your FaceLove verification code: ${otp}`,
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== ROUTES ==========

// SPLASH
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
        body{
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          overflow: hidden;
        }
        .splash{
          text-align: center;
          animation: float 3s ease-in-out infinite;
        }
        .splash .logo{
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 0 60px rgba(255,59,92,0.3);
        }
        .splash .logo i{
          font-size: 50px;
          color: #fff;
        }
        .splash h1{
          color: #fff;
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .splash p{
          color: #888;
          font-size: 16px;
          margin-top: 8px;
          letter-spacing: 2px;
        }
        .loader{
          width: 60px;
          height: 60px;
          margin: 30px auto 0;
          border: 3px solid rgba(255,59,92,0.1);
          border-top: 3px solid #ff3b5c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin{ 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes float{ 0%{transform:translateY(0)} 50%{transform:translateY(-10px)} 100%{transform:translateY(0)} }
      </style>
    </head>
    <body>
      <div class="splash">
        <div class="logo"><i class="fas fa-heart"></i></div>
        <h1>FaceLove</h1>
        <p>Connect • Share • Inspire</p>
        <div class="loader"></div>
      </div>
      <script>setTimeout(()=>{window.location.href='/login'},2500);</script>
    </body>
    </html>
  `);
});

// LOGIN
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
        body{
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth{
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          border: 1px solid rgba(255,59,92,0.1);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand{ text-align: center; margin-bottom: 35px; }
        .auth .brand i{
          font-size: 35px;
          color: #ff3b5c;
          margin-bottom: 10px;
        }
        .auth .brand h1{
          color: #fff;
          font-size: 28px;
          font-weight: 700;
        }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 14px; margin-top: 4px; }
        .auth .error{
          background: rgba(255,59,92,0.1);
          color: #ff6b6b;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 14px;
          display: ${error ? 'block' : 'none'};
        }
        .auth .form-group{ margin-bottom: 16px; }
        .auth .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .auth .form-group label i{ color: #ff3b5c; margin-right: 6px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{
          border-color: #ff3b5c;
          background: rgba(40,40,40,0.9);
          box-shadow: 0 0 20px rgba(255,59,92,0.1);
        }
        .auth .btn{
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 6px;
        }
        .auth .btn:hover{
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255,59,92,0.3);
        }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
        .auth .links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
          transition: 0.2s;
        }
        .auth .links a:hover{ text-decoration: underline; }
        .auth .divider{ color: #333; margin: 0 8px; }
        @media (max-width: 480px){
          .auth{ padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Welcome back</p>
        </div>
        <div class="error">${error}</div>
        <form action="/login" method="POST">
          <div class="form-group">
            <label><i class="fas fa-phone"></i> Phone Number</label>
            <input type="text" name="phone" placeholder="+966512345678" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" name="password" placeholder="Enter your password" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        </form>
        <div class="links">
          <a href="/register"><i class="fas fa-user-plus"></i> Create Account</a>
          <span class="divider">•</span>
          <a href="/forgot-password"><i class="fas fa-key"></i> Forgot Password?</a>
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
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth{
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          border: 1px solid rgba(255,59,92,0.1);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand{ text-align: center; margin-bottom: 30px; }
        .auth .brand i{ font-size: 35px; color: #ff3b5c; margin-bottom: 10px; }
        .auth .brand h1{ color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 14px; margin-top: 4px; }
        .auth .form-group{ margin-bottom: 14px; }
        .auth .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .auth .form-group label i{ color: #ff3b5c; margin-right: 6px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{
          border-color: #ff3b5c;
          background: rgba(40,40,40,0.9);
        }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          color: #4a9eff;
          margin: 12px 0;
          border: 1px solid rgba(74,158,255,0.1);
          text-align: center;
        }
        .auth .info i{ margin-right: 8px; }
        .auth .btn{
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 6px;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
        .auth .links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
        }
        .auth .links a:hover{ text-decoration: underline; }
        @media (max-width: 480px){ .auth{ padding: 30px 20px; } }
      </style>
    </head>
    <body>
      <div class="auth">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Join the community</p>
        </div>
        <form action="/register" method="POST">
          <div class="form-group">
            <label><i class="fas fa-user"></i> Full Name</label>
            <input type="text" name="name" placeholder="Ahmed Mohamed" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-phone"></i> Phone Number</label>
            <input type="text" name="phone" placeholder="+966512345678" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" name="password" placeholder="Min 6 characters" required minlength="6">
          </div>
          <div class="info"><i class="fas fa-info-circle"></i> A verification code will be sent via WhatsApp</div>
          <button type="submit" class="btn"><i class="fas fa-user-plus"></i> Create Account</button>
        </form>
        <div class="links">
          Already have an account? <a href="/login"><i class="fas fa-sign-in-alt"></i> Sign In</a>
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
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth{
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          border: 1px solid rgba(255,59,92,0.1);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
          text-align: center;
        }
        .auth .brand i{ font-size: 40px; color: #ff3b5c; margin-bottom: 15px; }
        .auth .brand h1{ color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 14px; margin-top: 4px; }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(241,196,15,0.1);
        }
        .auth .info i{ margin-right: 8px; }
        .auth .form-group input{
          width: 100%;
          padding: 16px;
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
        .auth .form-group input:focus{ border-color: #ff3b5c; background: rgba(40,40,40,0.9); }
        .auth .btn{
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{ margin-top: 18px; color: #666; font-size: 14px; }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
        .auth .note{ font-size: 12px; color: #444; margin-top: 12px; }
        @media (max-width: 480px){ .auth{ padding: 30px 20px; } }
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
    id: 'u' + Date.now() + Math.random().toString(36).substr(2, 6),
    name: temp.name,
    phone: temp.phone,
    password: temp.password,
    verified: true,
    active: true,
    role: 'user',
    joined: new Date().toISOString(),
    bio: 'Welcome to FaceLove!',
    avatar: '',
    cover: '',
    location: '',
    website: ''
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
      <title>FaceLove Pro</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        :root{
          --primary: #ff3b5c;
          --primary-dark: #e63050;
          --primary-light: #ff6b8a;
          --bg-dark: #0a0a0a;
          --bg-card: #141414;
          --bg-card-hover: #1a1a1a;
          --text-primary: #ffffff;
          --text-secondary: #aaa;
          --text-muted: #555;
          --border-color: #1f1f1f;
          --shadow: 0 8px 32px rgba(0,0,0,0.6);
          --radius: 18px;
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: var(--bg-dark);
          color: var(--text-primary);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-bottom: 90px;
          padding-top: 75px;
        }
        ::-webkit-scrollbar{ width: 6px; }
        ::-webkit-scrollbar-track{ background: var(--bg-dark); }
        ::-webkit-scrollbar-thumb{ background: var(--primary); border-radius: 10px; }

        /* Top Nav */
        .top-nav{
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 70px;
          background: rgba(10,10,10,0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 100;
        }
        .top-nav .brand{
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .top-nav .brand i{ color: var(--primary); font-size: 24px; }
        .top-nav .brand span{ color: var(--primary); }
        .top-nav .actions{
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .top-nav .actions .user-badge{
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          padding: 6px 14px 6px 10px;
          background: var(--bg-card);
          border-radius: 30px;
          border: 1px solid var(--border-color);
        }
        .top-nav .actions .user-badge .avatar{
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: #fff;
        }
        .top-nav .actions a{
          color: var(--text-secondary);
          font-size: 20px;
          transition: var(--transition);
        }
        .top-nav .actions a:hover{ color: var(--primary); }

        /* Bottom Nav */
        .bottom-nav{
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 75px;
          background: rgba(10,10,10,0.97);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 100;
          padding: 0 8px;
        }
        .bottom-nav a{
          color: var(--text-muted);
          font-size: 22px;
          transition: var(--transition);
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 6px 14px;
          border-radius: 12px;
          position: relative;
        }
        .bottom-nav a span{
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }
        .bottom-nav a:hover{ color: var(--text-primary); }
        .bottom-nav a.active{
          color: var(--primary);
        }
        .bottom-nav a.active span{ color: var(--primary); }
        .bottom-nav a .badge{
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--primary);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 20px;
          min-width: 18px;
          text-align: center;
        }

        /* Content */
        .content{
          max-width: 780px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .page{ display: none; animation: fadeUp 0.4s ease; }
        .page.active{ display: block; }
        @keyframes fadeUp{ 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }

        /* Cards */
        .card{
          background: var(--bg-card);
          border-radius: var(--radius);
          padding: 22px 24px;
          margin-bottom: 16px;
          border: 1px solid var(--border-color);
          transition: var(--transition);
        }
        .card:hover{ border-color: rgba(255,59,92,0.2); }
        .card .title{
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card .title i{ color: var(--primary); }

        /* Post Box */
        .post-box textarea{
          width: 100%;
          padding: 16px 18px;
          background: rgba(30,30,30,0.6);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
          outline: none;
          transition: var(--transition);
        }
        .post-box textarea:focus{
          border-color: var(--primary);
          background: rgba(40,40,40,0.8);
        }
        .post-box .actions{
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .post-box .actions .media-options{
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .post-box .actions .media-options i{
          color: var(--text-muted);
          font-size: 18px;
          cursor: pointer;
          transition: var(--transition);
        }
        .post-box .actions .media-options i:hover{ color: var(--primary); }
        .post-box .actions .media-options input{
          background: rgba(30,30,30,0.6);
          border: 1px solid var(--border-color);
          border-radius: 30px;
          padding: 8px 16px;
          color: #fff;
          font-size: 13px;
          outline: none;
          width: 160px;
          transition: var(--transition);
        }
        .post-box .actions .media-options input:focus{ border-color: var(--primary); }
        .post-box .actions .btn-post{
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border: none;
          padding: 12px 32px;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: var(--transition);
        }
        .post-box .actions .btn-post:hover{
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255,59,92,0.3);
        }
        .post-box .actions .btn-post i{ margin-right: 6px; }

        /* Feed Post */
        .feed-post{
          background: var(--bg-card);
          border-radius: var(--radius);
          padding: 20px 22px;
          margin-bottom: 14px;
          border: 1px solid var(--border-color);
          transition: var(--transition);
        }
        .feed-post:hover{ border-color: rgba(255,59,92,0.15); }
        .feed-post .header{
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
        }
        .feed-post .header .avatar{
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
          cursor: pointer;
        }
        .feed-post .header .info{ flex: 1; }
        .feed-post .header .info .name{
          font-weight: 700;
          font-size: 15px;
          color: #fff;
          cursor: pointer;
        }
        .feed-post .header .info .name:hover{ color: var(--primary); }
        .feed-post .header .info .time{
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .feed-post .header .info .time i{ margin-right: 4px; }
        .feed-post .body{
          margin: 6px 0 14px;
          line-height: 1.8;
          font-size: 15px;
        }
        .feed-post .body .media{
          margin-top: 12px;
          border-radius: 14px;
          overflow: hidden;
        }
        .feed-post .body .media img,
        .feed-post .body .media video{
          width: 100%;
          max-height: 450px;
          object-fit: cover;
          display: block;
        }
        .feed-post .body .ai-badge{
          display: inline-block;
          background: rgba(255,59,92,0.1);
          color: var(--primary);
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 20px;
          margin-top: 8px;
          font-weight: 600;
        }
        .feed-post .body .ai-badge i{ margin-right: 4px; }
        .feed-post .actions{
          display: flex;
          gap: 24px;
          padding-top: 14px;
          border-top: 1px solid var(--border-color);
        }
        .feed-post .actions button{
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 15px;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }
        .feed-post .actions button:hover{ color: #fff; }
        .feed-post .actions button.liked{ color: var(--primary); }
        .feed-post .comments{
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border-color);
        }
        .feed-post .comments .comment{
          display: flex;
          gap: 10px;
          margin: 6px 0;
          font-size: 14px;
        }
        .feed-post .comments .comment .cname{
          font-weight: 700;
          color: var(--primary);
        }
        .feed-post .comments .comment .ctext{ color: #ccc; }
        .feed-post .comments input{
          width: 100%;
          padding: 10px 16px;
          background: rgba(30,30,30,0.6);
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          outline: none;
          margin-top: 8px;
          transition: var(--transition);
        }
        .feed-post .comments input:focus{ border-color: var(--primary); }

        /* Profile */
        .profile-header{
          text-align: center;
          padding: 30px 0;
        }
        .profile-header .avatar{
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 700;
          color: #fff;
          margin: 0 auto 16px;
          box-shadow: 0 0 40px rgba(255,59,92,0.2);
        }
        .profile-header .name{
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }
        .profile-header .bio{
          color: var(--text-secondary);
          font-size: 14px;
          margin-top: 4px;
        }
        .profile-header .stats{
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 20px;
        }
        .profile-header .stats .stat{
          text-align: center;
        }
        .profile-header .stats .stat .num{
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }
        .profile-header .stats .stat .label{
          font-size: 12px;
          color: var(--text-muted);
        }
        .profile-header .edit-btn{
          margin-top: 16px;
          padding: 10px 30px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 30px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }
        .profile-header .edit-btn:hover{ border-color: var(--primary); }

        /* Friends & Chat */
        .friend-item{
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          background: rgba(30,30,30,0.4);
          border-radius: 14px;
          margin-bottom: 10px;
          transition: var(--transition);
          cursor: pointer;
        }
        .friend-item:hover{ background: rgba(40,40,40,0.6); }
        .friend-item .avatar{
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: #fff;
          flex-shrink: 0;
        }
        .friend-item .info{ flex: 1; }
        .friend-item .info .name{ font-weight: 600; color: #fff; }
        .friend-item .info .status{ font-size: 12px; color: var(--text-muted); }
        .friend-item .actions{
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .friend-item .actions .btn-sm{
          padding: 6px 16px;
          border: none;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }
        .friend-item .actions .btn-sm.primary{ background: var(--primary); color: #fff; }
        .friend-item .actions .btn-sm.primary:hover{ background: var(--primary-dark); }
        .friend-item .actions .btn-sm.secondary{ background: rgba(255,255,255,0.05); color: #aaa; }
        .friend-item .actions .btn-sm.secondary:hover{ background: rgba(255,255,255,0.1); }
        .friend-item .actions .btn-sm.success{ background: #27ae60; color: #fff; }
        .friend-item .actions .btn-sm.success:hover{ background: #2ecc71; }
        .friend-item .actions .btn-sm.danger{ background: #c0392b; color: #fff; }
        .friend-item .actions .btn-sm.danger:hover{ background: #e74c3c; }
        .friend-item .actions i{
          font-size: 18px;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition);
          padding: 6px;
        }
        .friend-item .actions i:hover{ color: var(--primary); }

        /* Chat */
        .chat-messages{
          background: rgba(30,30,30,0.3);
          border-radius: 14px;
          padding: 16px;
          max-height: 350px;
          overflow-y: auto;
          margin-bottom: 12px;
        }
        .chat-messages .msg{
          margin: 4px 0;
          padding: 8px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          font-size: 14px;
        }
        .chat-messages .msg .sender{ font-weight: 700; color: var(--primary); margin-right: 6px; }
        .chat-messages .msg .text{ color: #ccc; }
        .chat-input{
          display: flex;
          gap: 10px;
        }
        .chat-input input{
          flex: 1;
          padding: 12px 18px;
          background: rgba(30,30,30,0.6);
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: var(--transition);
        }
        .chat-input input:focus{ border-color: var(--primary); }
        .chat-input button{
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border: none;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition);
        }
        .chat-input button:hover{ transform: translateY(-2px); }

        /* Admin */
        .admin-stats{
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .admin-stats .stat{
          background: rgba(30,30,30,0.4);
          padding: 16px;
          border-radius: 14px;
          text-align: center;
        }
        .admin-stats .stat .num{
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }
        .admin-stats .stat .label{
          font-size: 11px;
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
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-color);
        }
        .admin-item .info{ flex: 1; }
        .admin-item .info .name{ font-weight: 600; color: #fff; }
        .admin-item .info .sub{ font-size: 12px; color: var(--text-muted); }
        .admin-item .badge{
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
        }
        .admin-item .badge.active{ background: rgba(39,174,96,0.2); color: #27ae60; }
        .admin-item .badge.inactive{ background: rgba(192,57,43,0.2); color: #e74c3c; }
        .admin-item .badge.pending{ background: rgba(241,196,15,0.2); color: #f1c40f; }
        .admin-item .actions{ display: flex; gap: 4px; }
        .admin-item .actions .btn-xs{
          padding: 4px 12px;
          border: none;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
        }
        .admin-item .actions .btn-xs.danger{ background: #c0392b; color: #fff; }
        .admin-item .actions .btn-xs.danger:hover{ background: #e74c3c; }
        .admin-item .actions .btn-xs.success{ background: #27ae60; color: #fff; }
        .admin-item .actions .btn-xs.success:hover{ background: #2ecc71; }

        /* Empty state */
        .empty{
          text-align: center;
          padding: 40px 0;
          color: var(--text-muted);
        }
        .empty i{ font-size: 40px; display: block; margin-bottom: 12px; opacity: 0.3; }
        .empty p{ font-size: 14px; }

        /* Search */
        .search-bar{
          display: flex;
          align-items: center;
          background: rgba(30,30,30,0.6);
          border-radius: 30px;
          padding: 4px 18px;
          margin-bottom: 16px;
          border: 2px solid transparent;
          transition: var(--transition);
        }
        .search-bar:focus-within{ border-color: var(--primary); }
        .search-bar i{ color: var(--text-muted); font-size: 16px; }
        .search-bar input{
          flex: 1;
          background: transparent;
          border: none;
          padding: 12px 14px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        /* Responsive */
        @media (max-width: 640px){
          .content{ padding: 0 12px; }
          .card{ padding: 16px; }
          .top-nav{ padding: 0 16px; height: 60px; }
          .top-nav .brand{ font-size: 18px; }
          .top-nav .actions .user-badge{ display: none; }
          .bottom-nav{ height: 65px; }
          .bottom-nav a{ font-size: 18px; padding: 4px 10px; }
          .bottom-nav a span{ font-size: 9px; }
          .post-box .actions{ flex-direction: column; align-items: stretch; }
          .post-box .actions .media-options{ flex-wrap: wrap; }
          .post-box .actions .media-options input{ width: 100%; }
          .profile-header .stats{ gap: 20px; }
          .admin-stats{ grid-template-columns: repeat(2, 1fr); }
          .feed-post{ padding: 16px; }
        }
      </style>
    </head>
    <body>
      <!-- Top Navigation -->
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-heart"></i>Face<span>Love</span></div>
        <div class="actions">
          <div class="user-badge">
            <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
            ${user.name}
          </div>
          <a href="/logout" title="Sign Out"><i class="fas fa-sign-out-alt"></i></a>
        </div>
      </nav>

      <!-- Content -->
      <div class="content">
        <!-- Feed -->
        <div id="page-feed" class="page active">
          <div class="card post-box">
            <textarea id="postText" placeholder="What's on your mind? Share your thoughts..." rows="3"></textarea>
            <div class="actions">
              <div class="media-options">
                <i class="fas fa-image" onclick="document.getElementById('mediaInput').focus()" title="Add Image"></i>
                <i class="fas fa-video" onclick="document.getElementById('mediaInput').focus()" title="Add Video"></i>
                <input type="text" id="mediaInput" placeholder="Paste media URL">
              </div>
              <button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> Post</button>
            </div>
          </div>
          <div id="feedContainer"></div>
        </div>

        <!-- Search -->
        <div id="page-search" class="page">
          <div class="search-bar">
            <i class="fas fa-search"></i>
            <input type="text" id="searchInput" placeholder="Search users, posts, or hashtags..." oninput="searchContent()">
          </div>
          <div id="searchResults"></div>
        </div>

        <!-- Profile -->
        <div id="page-profile" class="page">
          <div class="card">
            <div class="profile-header">
              <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
              <div class="name">${user.name}</div>
              <div class="bio">${user.bio || 'Welcome to FaceLove! Share your moments.'}</div>
              <div class="stats">
                <div class="stat"><div class="num" id="postCount">0</div><div class="label">Posts</div></div>
                <div class="stat"><div class="num" id="friendCount">0</div><div class="label">Friends</div></div>
                <div class="stat"><div class="num" id="likeCount">0</div><div class="label">Likes</div></div>
              </div>
              <button class="edit-btn" onclick="editProfile()"><i class="fas fa-edit"></i> Edit Profile</button>
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
            <div class="title"><i class="fas fa-handshake"></i> Friend Requests</div>
            <div id="friendRequests"></div>
          </div>
          <div class="card">
            <div class="title"><i class="fas fa-user-plus"></i> Suggested People</div>
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
                <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
              </div>
              <button onclick="closeChat()" style="margin-top:10px;background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;"><i class="fas fa-arrow-left"></i> Back</button>
            </div>
          </div>
        </div>

        <!-- Admin -->
        <div id="page-admin" class="page">
          <div class="card">
            <div class="title"><i class="fas fa-crown"></i> Admin Dashboard</div>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">Monitor and manage your community</p>
            <div id="adminStats" class="admin-stats"></div>
            <div id="adminContent"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Navigation -->
      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>Feed</span></a>
        <a href="#" data-page="search"><i class="fas fa-search"></i><span>Search</span></a>
        <a href="#" data-page="profile"><i class="fas fa-user"></i><span>Profile</span></a>
        <a href="#" data-page="friends"><i class="fas fa-users"></i><span>Friends</span></a>
        <a href="#" data-page="chat"><i class="fas fa-comment-dots"></i><span>Chat</span></a>
        ${user.role === 'admin' ? '<a href="#" data-page="admin"><i class="fas fa-crown"></i><span>Admin</span></a>' : ''}
      </nav>

      <script>
        const currentUser = { id: "${user.id}", name: "${user.name}", role: "${user.role || 'user'}" };
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
            if (page === 'search') searchContent();
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
              '<div class="empty"><i class="fas fa-inbox"></i><p>No posts yet. Be the first to share!</p></div>';
          } catch(e) { console.error(e); }
        }

        function renderPost(p) {
          const liked = p.likes && p.likes.includes(currentUser.id);
          const mediaHtml = p.mediaUrl ? 
            (p.mediaUrl.match(/\\.(mp4|webm|ogg)$/) ? 
              '<div class="media"><video controls src="'+p.mediaUrl+'"></video></div>' : 
              '<div class="media"><img src="'+p.mediaUrl+'" alt="media"></div>') : '';
          const ai = p.aiAnalysis || { sentiment: 'neutral', suggestions: [] };
          const sentimentIcon = ai.sentiment === 'positive' ? '😊' : ai.sentiment === 'negative' ? '😢' : '😐';
          return \`
            <div class="feed-post">
              <div class="header">
                <div class="avatar" onclick="viewProfile('\${p.userId}')">\${p.userName ? p.userName.charAt(0).toUpperCase() : '?'}</div>
                <div class="info">
                  <div class="name" onclick="viewProfile('\${p.userId}')">\${p.userName || 'User'}</div>
                  <div class="time"><i class="far fa-clock"></i> \${new Date(p.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <div class="body">
                \${p.text || ''}
                \${mediaHtml}
                <div class="ai-badge"><i class="fas fa-robot"></i> AI: \${sentimentIcon} \${ai.sentiment} ${ai.suggestions ? ' | 💡 '+ai.suggestions.slice(0,2).join(' • ') : ''}</div>
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
                <input type="text" placeholder="Write a comment..." 
                  onkeypress="if(event.key==='Enter') addComment('\${p.id}', this.value); this.value='';">
              </div>
            </div>
          \`;
        }

        async function createPost() {
          const text = document.getElementById('postText').value;
          const mediaUrl = document.getElementById('mediaInput').value;
          if (!text && !mediaUrl) return alert('Please enter text or a media URL');
          try {
            await fetch('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, mediaUrl })
            });
            document.getElementById('postText').value = '';
            document.getElementById('mediaInput').value = '';
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

        function sharePost(postId) {
          const url = window.location.origin + '/post/' + postId;
          if (navigator.share) {
            navigator.share({ title: 'FaceLove Post', text: 'Check this out!', url: url });
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
              html += '<div style="margin-bottom:12px;"><strong style="color:var(--primary);"><i class="fas fa-users"></i> Users</strong></div>';
              html += data.users.map(u => 
                '<div class="friend-item"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><i class="fas fa-user-plus" onclick="sendFriendRequest(\\''+u.id+'\\')" title="Add Friend"></i></div></div>'
              ).join('');
            }
            if (data.posts && data.posts.length) {
              if (html) html += '<div style="margin:16px 0 8px;"><strong style="color:var(--primary);"><i class="fas fa-newspaper"></i> Posts</strong></div>';
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

        function editProfile() {
          const newBio = prompt('Update your bio:', '${user.bio || 'Welcome to FaceLove!'}');
          if (newBio !== null) {
            fetch('/api/profile/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bio: newBio })
            }).then(() => { location.reload(); });
          }
        }

        function viewProfile(userId) {
          alert('Viewing profile of user: ' + userId);
        }

        // ========== FRIENDS ==========
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            
            document.getElementById('friendsList').innerHTML = data.friends.length ? 
              data.friends.map(f => '<div class="friend-item"><div class="avatar">'+f.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+f.name+'</div><div class="status"><i class="fas fa-check-circle" style="color:#27ae60;"></i> Friend</div></div></div>').join('') :
              '<div class="empty"><i class="fas fa-user-friends"></i><p>No friends yet</p></div>';

            document.getElementById('friendRequests').innerHTML = data.requests.length ?
              data.requests.map(r => '<div class="friend-item"><div class="avatar">'+r.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+r.name+'</div><div class="status"><i class="fas fa-clock" style="color:#f1c40f;"></i> Pending</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')"><i class="fas fa-check"></i> Accept</button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')"><i class="fas fa-times"></i> Decline</button></div></div>').join('') :
              '<div class="empty"><i class="fas fa-inbox"></i><p>No pending requests</p></div>';

            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ?
              data.suggested.map(u => '<div class="friend-item"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')"><i class="fas fa-user-plus"></i> Add</button></div></div>').join('') :
              '<div class="empty"><i class="fas fa-check"></i><p>All caught up!</p></div>';
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
              data.map(u => '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status"><i class="fas fa-comment"></i> Click to chat</div></div></div>').join('') :
              '<div class="empty"><i class="fas fa-comment-slash"></i><p>No chats yet</p></div>';
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
              '<div class="empty" style="padding:20px 0;"><i class="fas fa-comment-dots"></i><p>No messages yet</p></div>';
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

        // ========== ADMIN ==========
        async function loadAdmin() {
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            
            // Stats
            document.getElementById('adminStats').innerHTML = \`
              <div class="stat"><div class="num primary">\${data.stats.totalUsers}</div><div class="label">Users</div></div>
              <div class="stat"><div class="num green">\${data.stats.totalPosts}</div><div class="label">Posts</div></div>
              <div class="stat"><div class="num blue">\${data.stats.totalLikes}</div><div class="label">Likes</div></div>
              <div class="stat"><div class="num gold">\${data.stats.activeUsers}</div><div class="label">Active</div></div>
            \`;

            let html = '';
            html += '<div style="margin:16px 0 8px;"><strong style="color:var(--primary);"><i class="fas fa-users"></i> Users</strong></div>';
            data.users.forEach(u => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+u.name+'</div><div class="sub">'+u.phone+' • Joined '+new Date(u.joined).toLocaleDateString()+'</div></div><div class="badge '+(u.active ? 'active' : 'inactive')+'">'+(u.active ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs '+(u.active ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active ? 'false' : 'true')+')">'+(u.active ? 'Deactivate' : 'Activate')+'</button></div></div>';
            });

            html += '<div style="margin:20px 0 8px;"><strong style="color:var(--primary);"><i class="fas fa-newspaper"></i> Posts</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-item"><div class="info"><div class="name">'+p.text.substring(0,60)+(p.text.length>60?'...':'')+'</div><div class="sub">by '+p.userName+' • '+new Date(p.timestamp).toLocaleString()+'</div></div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">Delete</button></div></div>';
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

        // Initial load
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

// ========== FORGOT PASSWORD ==========
app.get('/forgot-password', (req, res) => {
  res.send(`
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
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth{
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          border: 1px solid rgba(255,59,92,0.1);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand{ text-align: center; margin-bottom: 30px; }
        .auth .brand i{ font-size: 35px; color: #ff3b5c; margin-bottom: 10px; }
        .auth .brand h1{ color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 14px; margin-top: 4px; }
        .auth .form-group{ margin-bottom: 16px; }
        .auth .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .auth .form-group label i{ color: #ff3b5c; margin-right: 6px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: rgba(40,40,40,0.9); }
        .auth .btn{
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .links{ text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .auth .links a{ color: #ff3b5c; text-decoration: none; font-weight: 600; }
        .auth .links a:hover{ text-decoration: underline; }
        @media (max-width: 480px){ .auth{ padding: 30px 20px; } }
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
            <label><i class="fas fa-phone"></i> Phone Number</label>
            <input type="text" name="phone" placeholder="+966512345678" required>
          </div>
          <button type="submit" class="btn"><i class="fas fa-paper-plane"></i> Send Reset Code</button>
        </form>
        <div class="links"><a href="/login"><i class="fas fa-arrow-left"></i> Back to Sign In</a></div>
      </div>
    </body>
    </html>
  `);
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
      <title>Reset Password - FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth{
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          border-radius: 30px;
          padding: 50px 40px;
          width: 100%;
          max-width: 440px;
          border: 1px solid rgba(255,59,92,0.1);
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
        }
        .auth .brand{ text-align: center; margin-bottom: 30px; }
        .auth .brand i{ font-size: 35px; color: #ff3b5c; margin-bottom: 10px; }
        .auth .brand h1{ color: #fff; font-size: 28px; font-weight: 700; }
        .auth .brand h1 span{ color: #ff3b5c; }
        .auth .brand p{ color: #666; font-size: 14px; margin-top: 4px; }
        .auth .info{
          background: rgba(255,59,92,0.05);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid rgba(241,196,15,0.1);
          text-align: center;
        }
        .auth .info i{ margin-right: 8px; }
        .auth .form-group{ margin-bottom: 16px; }
        .auth .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .auth .form-group label i{ color: #ff3b5c; margin-right: 6px; }
        .auth .form-group input{
          width: 100%;
          padding: 14px 18px;
          background: rgba(30,30,30,0.8);
          border: 2px solid transparent;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth .form-group input:focus{ border-color: #ff3b5c; background: rgba(40,40,40,0.9); }
        .auth .btn{
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #ff3b5c, #ff6b8a);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth .btn:hover{ transform: translateY(-2px); box-shadow: 0 10px 30px rgba(255,59,92,0.3); }
        .auth .btn i{ margin-right: 8px; }
        .auth .note{ font-size: 12px; color: #444; text-align: center; margin-top: 12px; }
        @media (max-width: 480px){ .auth{ padding: 30px 20px; } }
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
            <label><i class="fas fa-lock"></i> New Password</label>
            <input type="password" name="newPassword" placeholder="Min 6 characters" required minlength="6">
          </div>
          <button type="submit" class="btn"><i class="fas fa-save"></i> Update Password</button>
        </form>
        <div class="note"><i class="fas fa-whatsapp"></i> Verification code sent via WhatsApp</div>
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

// ========== API ROUTES ==========

// Posts
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const posts = db.posts.sort((a,b) => b.timestamp - a.timestamp);
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    const analysis = analyzeText(p.text || '');
    return { ...p, userName: user ? user.name : 'User', aiAnalysis: analysis };
  });
  res.json(enriched);
});

app.post('/api/posts', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { text, mediaUrl } = req.body;
  const db = readDB();
  const analysis = analyzeText(text || '');
  const hashtags = suggestHashtags(text || '');
  const post = {
    id: 'p' + Date.now() + Math.random().toString(36).substr(2, 6),
    userId: req.session.userId,
    text: text || '',
    mediaUrl: mediaUrl || '',
    timestamp: Date.now(),
    likes: [],
    comments: [],
    aiAnalysis: analysis,
    hashtags: hashtags,
    summary: generateSummary(text || '')
  };
  db.posts.push(post);
  writeDB(db);
  res.json({ success: true, post });
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

// Search
app.get('/api/search', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase() : '';
  const db = readDB();
  if (!q) return res.json({ users: [], posts: [] });
  const users = db.users.filter(u => u.verified && u.active && u.id !== req.session.userId && 
    (u.name.toLowerCase().includes(q) || u.phone.includes(q)));
  const posts = db.posts.filter(p => p.text.toLowerCase().includes(q) || (p.hashtags && p.hashtags.some(h => h.toLowerCase().includes(q))));
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return { ...p, userName: user ? user.name : 'User' };
  });
  res.json({ users, posts: enriched });
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
  const { bio, location, website } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (bio !== undefined) user.bio = bio;
  if (location !== undefined) user.location = location;
  if (website !== undefined) user.website = website;
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
    id: 'f' + Date.now() + Math.random().toString(36).substr(2, 6), 
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
    id: 'm' + Date.now() + Math.random().toString(36).substr(2, 6),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    text: text,
    timestamp: Date.now()
  };
  db.messages.push(msg);
  
  // AI analysis for chat
  const analysis = analyzeText(text);
  db.aiAnalytics.push({
    type: 'chat',
    userId: req.session.userId,
    analysis: analysis,
    timestamp: Date.now()
  });
  
  writeDB(db);
  res.json({ success: true, ai: analysis });
});

// ========== ADMIN API ==========
app.get('/api/admin/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  
  const stats = getAIAnalytics(db);
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

// ========== AI ANALYTICS (Admin only) ==========
app.get('/api/admin/analytics', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  
  const stats = getAIAnalytics(db);
  res.json(stats);
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('🚀 FaceLove Pro running on port ' + PORT);
  console.log('📱 Visit http://localhost:' + PORT);
  console.log('🤖 AI Features: Sentiment Analysis, Smart Suggestions, Hashtags');
});

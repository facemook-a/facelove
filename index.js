// FaceLove - Social Platform (Professional Icons Version)
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== TWILIO CONFIG ==========
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';

let twilioClient = null;
let twilioEnabled = false;

if (twilioAccountSid && twilioAuthToken && twilioAccountSid !== 'your_account_sid_here') {
  try {
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    twilioEnabled = true;
    console.log('Twilio configured successfully');
  } catch (error) {
    console.log('Twilio initialization failed:', error.message);
  }
} else {
  console.log('Twilio not configured - SMS/WhatsApp features disabled');
}

// ========== MIDDLEWARE ==========
app.use(session({
  secret: process.env.SESSION_SECRET || 'facelove_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ========== DATABASE ==========
const DB_FILE = path.join(__dirname, 'db.json');

function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
      users: [], 
      otps: [], 
      posts: [], 
      friendships: [], 
      messages: [] 
    }, null, 2));
  }
}
initDB();

function readDB() { 
  try {
    return JSON.parse(fs.readFileSync(DB_FILE)); 
  } catch (e) {
    return { users: [], otps: [], posts: [], friendships: [], messages: [] };
  }
}

function writeDB(data) { 
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); 
}

// ========== HELPER: Send OTP ==========
async function sendOTP(phone, otp) {
  if (!twilioEnabled || !twilioClient) {
    console.log(`[MOCK] Would send OTP ${otp} to ${phone}`);
    return { success: true, mock: true };
  }
  
  try {
    await twilioClient.messages.create({
      body: `Your FaceLove verification code is: ${otp}`,
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`
    });
    return { success: true };
  } catch (error) {
    console.error('Twilio error:', error.message);
    return { success: false, error: error.message };
  }
}

// ========== SPLASH SCREEN ==========
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
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .splash{
          text-align: center;
          animation: fadeInUp 1.2s ease;
        }
        .splash .logo-icon{
          font-size: 80px;
          color: #ff3b5c;
          margin-bottom: 15px;
          text-shadow: 0 0 40px rgba(255,59,92,0.3);
        }
        .splash h1{
          color: #ffffff;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: 2px;
        }
        .splash h1 span{ color: #ff3b5c; }
        .splash .subtitle{
          color: #888888;
          font-size: 16px;
          margin-top: 8px;
          letter-spacing: 4px;
          text-transform: uppercase;
        }
        .splash .loader{
          width: 48px;
          height: 48px;
          border: 3px solid #1a1a1a;
          border-top: 3px solid #ff3b5c;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
          margin: 30px auto 0;
        }
        @keyframes spin{ 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes fadeInUp{ 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
      </style>
    </head>
    <body>
      <div class="splash">
        <div class="logo-icon"><i class="fas fa-heart"></i></div>
        <h1>Face<span>Love</span></h1>
        <div class="subtitle">Social Platform</div>
        <div class="loader"></div>
      </div>
      <script>setTimeout(()=>{window.location.href='/login'},2000);</script>
    </body>
    </html>
  `);
});

// ========== LOGIN PAGE ==========
app.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth-container{
          background: #141414;
          border-radius: 24px;
          padding: 45px 35px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #1f1f1f;
        }
        .auth-container .brand{
          text-align: center;
          margin-bottom: 30px;
        }
        .auth-container .brand i{
          font-size: 32px;
          color: #ff3b5c;
        }
        .auth-container .brand h1{
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin-top: 6px;
        }
        .auth-container .brand h1 span{ color: #ff3b5c; }
        .auth-container .brand p{
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }
        .auth-container .error{
          background: #2a0d0d;
          color: #ff6b6b;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
          display: ${error ? 'block' : 'none'};
        }
        .auth-container .form-group{
          margin-bottom: 16px;
        }
        .auth-container .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .auth-container .form-group label i{
          color: #ff3b5c;
          width: 18px;
        }
        .auth-container .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1f1f1f;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth-container .form-group input:focus{
          border-color: #ff3b5c;
          background: #262626;
        }
        .auth-container .btn-primary{
          width: 100%;
          padding: 15px;
          background: #ff3b5c;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 8px;
        }
        .auth-container .btn-primary:hover{ background: #e63050; }
        .auth-container .btn-primary i{ margin-right: 8px; }
        .auth-container .extra-links{
          text-align: center;
          margin-top: 20px;
          color: #888;
          font-size: 14px;
        }
        .auth-container .extra-links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
          transition: 0.2s;
        }
        .auth-container .extra-links a:hover{ text-decoration: underline; }
        .auth-container .divider{
          color: #333;
          margin: 0 8px;
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Sign in to your account</p>
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
          <button type="submit" class="btn-primary"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        </form>
        <div class="extra-links">
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
  if (!user) {
    return res.redirect('/login?error=Invalid phone number or password');
  }
  if (!user.active) {
    return res.redirect('/login?error=Account is deactivated');
  }
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

// ========== REGISTER PAGE ==========
app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register - FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth-container{
          background: #141414;
          border-radius: 24px;
          padding: 45px 35px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #1f1f1f;
        }
        .auth-container .brand{
          text-align: center;
          margin-bottom: 30px;
        }
        .auth-container .brand i{
          font-size: 32px;
          color: #ff3b5c;
        }
        .auth-container .brand h1{
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin-top: 6px;
        }
        .auth-container .brand h1 span{ color: #ff3b5c; }
        .auth-container .brand p{
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }
        .auth-container .form-group{
          margin-bottom: 14px;
        }
        .auth-container .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .auth-container .form-group label i{
          color: #ff3b5c;
          width: 18px;
        }
        .auth-container .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1f1f1f;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth-container .form-group input:focus{
          border-color: #ff3b5c;
          background: #262626;
        }
        .auth-container .info-box{
          background: #0d1a2a;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          color: #4a9eff;
          margin: 12px 0;
          text-align: center;
          border: 1px solid #1a2a3a;
        }
        .auth-container .info-box i{ margin-right: 8px; }
        .auth-container .btn-primary{
          width: 100%;
          padding: 15px;
          background: #ff3b5c;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 8px;
        }
        .auth-container .btn-primary:hover{ background: #e63050; }
        .auth-container .btn-primary i{ margin-right: 8px; }
        .auth-container .extra-links{
          text-align: center;
          margin-top: 20px;
          color: #888;
          font-size: 14px;
        }
        .auth-container .extra-links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
          transition: 0.2s;
        }
        .auth-container .extra-links a:hover{ text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="brand">
          <i class="fas fa-heart"></i>
          <h1>Face<span>Love</span></h1>
          <p>Create your account</p>
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
          <div class="info-box">
            <i class="fas fa-info-circle"></i> A verification code will be sent via WhatsApp
          </div>
          <button type="submit" class="btn-primary"><i class="fas fa-user-plus"></i> Create Account</button>
        </form>
        <div class="extra-links">
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
    return res.send('<script>alert("Phone number already registered"); window.location="/register";</script>');
  }
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  
  const result = await sendOTP(phone, otp);
  
  if (!result.success && !result.mock) {
    return res.send(`<script>alert("Failed to send code: ${result.error}"); window.location="/register";</script>`);
  }
  
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
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth-container{
          background: #141414;
          border-radius: 24px;
          padding: 45px 35px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #1f1f1f;
          text-align: center;
        }
        .auth-container .brand i{
          font-size: 40px;
          color: #ff3b5c;
          margin-bottom: 10px;
        }
        .auth-container .brand h1{
          color: #ffffff;
          font-size: 26px;
          font-weight: 700;
        }
        .auth-container .brand h1 span{ color: #ff3b5c; }
        .auth-container .brand p{
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }
        .auth-container .info-box{
          background: #0d1a2a;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid #1a2a3a;
        }
        .auth-container .info-box i{ margin-right: 8px; }
        .auth-container .form-group{
          margin-bottom: 16px;
        }
        .auth-container .form-group input{
          width: 100%;
          padding: 16px;
          background: #1f1f1f;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 24px;
          text-align: center;
          letter-spacing: 12px;
          font-weight: 700;
          transition: 0.3s;
          outline: none;
        }
        .auth-container .form-group input:focus{
          border-color: #ff3b5c;
          background: #262626;
        }
        .auth-container .btn-primary{
          width: 100%;
          padding: 15px;
          background: #ff3b5c;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .auth-container .btn-primary:hover{ background: #e63050; }
        .auth-container .btn-primary i{ margin-right: 8px; }
        .auth-container .extra-links{
          margin-top: 18px;
          color: #888;
          font-size: 14px;
        }
        .auth-container .extra-links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
        }
        .auth-container .extra-links a:hover{ text-decoration: underline; }
        .note{ font-size: 12px; color: #555; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="brand">
          <i class="fas fa-shield-alt"></i>
          <h1>Face<span>Love</span></h1>
          <p>Enter verification code</p>
        </div>
        ${result.mock ? '<div class="info-box"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
        <form action="/verify-otp" method="POST">
          <div class="form-group">
            <input type="text" name="otp" placeholder="000000" maxlength="6" required autofocus>
          </div>
          <input type="hidden" name="phone" value="${phone}">
          <button type="submit" class="btn-primary"><i class="fas fa-check-circle"></i> Verify</button>
        </form>
        <div class="extra-links">
          <a href="/register"><i class="fas fa-arrow-left"></i> Change number</a>
        </div>
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
  
  if (!record) {
    return res.send('<script>alert("Invalid or expired code"); window.location="/register";</script>');
  }
  
  const temp = req.session.tempUser;
  if (!temp || temp.phone !== phone) {
    return res.send('<script>alert("Session error"); window.location="/register";</script>');
  }
  
  const newUser = {
    id: 'u' + Date.now() + Math.random().toString(36).substr(2, 4),
    name: temp.name,
    phone: temp.phone,
    password: temp.password,
    verified: true,
    active: true,
    role: 'user',
    joined: new Date().toISOString()
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
        body{
          background: #0a0a0a;
          color: #e0e0e0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding-bottom: 80px;
          padding-top: 70px;
        }
        /* Top Navigation */
        .top-nav{
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 65px;
          background: #0f0f0f;
          border-bottom: 1px solid #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          z-index: 100;
        }
        .top-nav .brand{
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }
        .top-nav .brand i{ color: #ff3b5c; margin-right: 6px; }
        .top-nav .brand span{ color: #ff3b5c; }
        .top-nav .nav-actions{
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .top-nav .nav-actions .username{
          color: #888;
          font-size: 13px;
          font-weight: 500;
        }
        .top-nav .nav-actions a{
          color: #888;
          font-size: 18px;
          transition: 0.2s;
        }
        .top-nav .nav-actions a:hover{ color: #ff3b5c; }

        /* Bottom Navigation */
        .bottom-nav{
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 68px;
          background: #0f0f0f;
          border-top: 1px solid #1a1a1a;
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 100;
        }
        .bottom-nav a{
          color: #555;
          font-size: 22px;
          transition: 0.2s;
          text-decoration: none;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .bottom-nav a span{
          font-size: 10px;
          color: #555;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .bottom-nav a:hover{ color: #ff3b5c; }
        .bottom-nav a:hover span{ color: #ff3b5c; }
        .bottom-nav a.active{ color: #ff3b5c; }
        .bottom-nav a.active span{ color: #ff3b5c; }

        /* Content */
        .content{
          max-width: 720px;
          margin: 0 auto;
          padding: 0 16px;
        }
        .page{ display: none; animation: fadeUp 0.3s ease; }
        .page.active{ display: block; }
        @keyframes fadeUp{ 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }

        /* Cards */
        .card{
          background: #141414;
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 16px;
          border: 1px solid #1a1a1a;
        }
        .card-title{
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
        }
        .card-title i{ color: #ff3b5c; margin-right: 8px; }

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
        .post-box textarea:focus{
          border-color: #ff3b5c;
          background: #1f1f1f;
        }
        .post-box .post-actions{
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .post-box .post-actions .media-inputs{
          display: flex;
          gap: 14px;
          align-items: center;
        }
        .post-box .post-actions .media-inputs i{
          color: #666;
          font-size: 18px;
          cursor: pointer;
          transition: 0.2s;
        }
        .post-box .post-actions .media-inputs i:hover{ color: #ff3b5c; }
        .post-box .post-actions .media-inputs input{
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 30px;
          padding: 8px 16px;
          color: #fff;
          font-size: 13px;
          outline: none;
          width: 160px;
          transition: 0.3s;
        }
        .post-box .post-actions .media-inputs input:focus{ border-color: #ff3b5c; }
        .post-box .post-actions .btn-post{
          background: #ff3b5c;
          border: none;
          padding: 10px 28px;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: 0.3s;
        }
        .post-box .post-actions .btn-post:hover{ background: #e63050; }
        .post-box .post-actions .btn-post i{ margin-right: 6px; }

        /* Feed Post */
        .feed-post{
          background: #141414;
          border-radius: 18px;
          padding: 18px 20px;
          margin-bottom: 14px;
          border: 1px solid #1a1a1a;
        }
        .feed-post .post-header{
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .feed-post .post-header .avatar{
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .feed-post .post-header .info{ flex: 1; }
        .feed-post .post-header .info .name{
          font-weight: 700;
          color: #fff;
          font-size: 15px;
        }
        .feed-post .post-header .info .time{
          font-size: 12px;
          color: #666;
          margin-top: 2px;
        }
        .feed-post .post-body{
          margin: 6px 0 12px;
          line-height: 1.7;
          font-size: 15px;
        }
        .feed-post .post-body .media{
          margin-top: 10px;
          border-radius: 12px;
          overflow: hidden;
        }
        .feed-post .post-body .media img,
        .feed-post .post-body .media video{
          width: 100%;
          max-height: 420px;
          object-fit: cover;
          display: block;
        }
        .feed-post .post-actions{
          display: flex;
          gap: 24px;
          padding-top: 12px;
          border-top: 1px solid #1f1f1f;
          margin-top: 6px;
        }
        .feed-post .post-actions button{
          background: none;
          border: none;
          color: #777;
          font-size: 15px;
          cursor: pointer;
          transition: 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }
        .feed-post .post-actions button:hover{ color: #fff; }
        .feed-post .post-actions button.liked{ color: #ff3b5c; }
        .feed-post .comments-section{
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #1a1a1a;
        }
        .feed-post .comments-section .comment{
          display: flex;
          gap: 8px;
          margin: 6px 0;
          font-size: 14px;
        }
        .feed-post .comments-section .comment .cname{
          font-weight: 700;
          color: #ff3b5c;
        }
        .feed-post .comments-section .comment .ctext{ color: #ccc; }
        .feed-post .comments-section .comment-input{
          width: 100%;
          padding: 10px 14px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          outline: none;
          margin-top: 8px;
          transition: 0.3s;
        }
        .feed-post .comments-section .comment-input:focus{ border-color: #ff3b5c; }

        /* Friends & Chat */
        .friend-item{
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          background: #1a1a1a;
          border-radius: 14px;
          margin-bottom: 10px;
          transition: 0.2s;
          cursor: pointer;
        }
        .friend-item:hover{ background: #1f1f1f; }
        .friend-item .avatar{
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 17px;
          color: #fff;
          flex-shrink: 0;
        }
        .friend-item .info{ flex: 1; }
        .friend-item .info .name{ font-weight: 600; color: #fff; }
        .friend-item .info .status{ font-size: 12px; color: #666; }
        .friend-item .actions{
          display: flex;
          gap: 6px;
        }
        .friend-item .actions .btn-sm{
          padding: 6px 14px;
          border: none;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }
        .friend-item .actions .btn-sm.primary{ background: #ff3b5c; color: #fff; }
        .friend-item .actions .btn-sm.primary:hover{ background: #e63050; }
        .friend-item .actions .btn-sm.secondary{ background: #2a2a2a; color: #aaa; }
        .friend-item .actions .btn-sm.secondary:hover{ background: #333; }
        .friend-item .actions .btn-sm.danger{ background: #c0392b; color: #fff; }
        .friend-item .actions .btn-sm.danger:hover{ background: #e74c3c; }
        .friend-item .actions .btn-sm.success{ background: #27ae60; color: #fff; }
        .friend-item .actions .btn-sm.success:hover{ background: #2ecc71; }
        .friend-item .actions i{
          font-size: 18px;
          color: #666;
          cursor: pointer;
          transition: 0.2s;
        }
        .friend-item .actions i:hover{ color: #ff3b5c; }

        /* Chat */
        .chat-messages{
          background: #1a1a1a;
          border-radius: 14px;
          padding: 16px;
          max-height: 320px;
          overflow-y: auto;
          margin-bottom: 10px;
        }
        .chat-messages .msg{
          margin: 4px 0;
          font-size: 14px;
        }
        .chat-messages .msg .sender{ font-weight: 700; color: #ff3b5c; margin-right: 4px; }
        .chat-messages .msg .text{ color: #ccc; }
        .chat-input{
          display: flex;
          gap: 10px;
        }
        .chat-input input{
          flex: 1;
          padding: 12px 16px;
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: 0.3s;
        }
        .chat-input input:focus{ border-color: #ff3b5c; }
        .chat-input button{
          padding: 12px 22px;
          background: #ff3b5c;
          border: none;
          border-radius: 30px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }
        .chat-input button:hover{ background: #e63050; }

        /* Admin */
        .admin-user-item{
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #1a1a1a;
        }
        .admin-user-item .info{ flex: 1; }
        .admin-user-item .info .name{ font-weight: 600; color: #fff; }
        .admin-user-item .info .phone{ font-size: 12px; color: #666; }
        .admin-user-item .status{
          font-size: 12px;
          padding: 4px 12px;
          border-radius: 30px;
          font-weight: 600;
        }
        .admin-user-item .status.active{ background: #1a3a1a; color: #27ae60; }
        .admin-user-item .status.inactive{ background: #3a1a1a; color: #e74c3c; }
        .admin-user-item .actions{ display: flex; gap: 6px; }
        .admin-user-item .actions .btn-xs{
          padding: 4px 12px;
          border: none;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }
        .admin-user-item .actions .btn-xs.danger{ background: #c0392b; color: #fff; }
        .admin-user-item .actions .btn-xs.danger:hover{ background: #e74c3c; }
        .admin-user-item .actions .btn-xs.success{ background: #27ae60; color: #fff; }
        .admin-user-item .actions .btn-xs.success:hover{ background: #2ecc71; }

        .admin-post-item{
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #1a1a1a;
        }
        .admin-post-item .text{ flex: 1; font-size: 14px; }
        .admin-post-item .by{ font-size: 12px; color: #666; }
        .admin-post-item .actions .btn-xs.danger{ background: #c0392b; color: #fff; border: none; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .admin-post-item .actions .btn-xs.danger:hover{ background: #e74c3c; }

        .empty-state{
          text-align: center;
          padding: 30px 0;
          color: #555;
        }
        .empty-state i{ font-size: 36px; margin-bottom: 10px; display: block; }
        .empty-state p{ font-size: 14px; }

        /* Search */
        .search-bar{
          display: flex;
          align-items: center;
          background: #1a1a1a;
          border-radius: 30px;
          padding: 4px 18px;
          margin-bottom: 16px;
          border: 2px solid transparent;
          transition: 0.3s;
        }
        .search-bar:focus-within{ border-color: #ff3b5c; }
        .search-bar i{ color: #555; font-size: 16px; }
        .search-bar input{
          flex: 1;
          background: transparent;
          border: none;
          padding: 12px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        /* Responsive */
        @media (max-width: 480px){
          .post-box .post-actions{ flex-direction: column; align-items: stretch; }
          .post-box .post-actions .media-inputs{ flex-wrap: wrap; }
          .post-box .post-actions .media-inputs input{ width: 100%; }
          .top-nav .brand{ font-size: 17px; }
          .top-nav .nav-actions .username{ display: none; }
          .bottom-nav a{ font-size: 18px; }
          .bottom-nav a span{ font-size: 9px; }
        }
      </style>
    </head>
    <body>
      <!-- Top Navigation -->
      <nav class="top-nav">
        <div class="brand"><i class="fas fa-heart"></i>Face<span>Love</span></div>
        <div class="nav-actions">
          <span class="username"><i class="fas fa-user"></i> ${user.name}</span>
          <a href="/logout" title="Sign Out"><i class="fas fa-sign-out-alt"></i></a>
        </div>
      </nav>

      <!-- Content -->
      <div class="content">
        <!-- Feed Page -->
        <div id="page-feed" class="page active">
          <div class="card post-box">
            <textarea id="postText" placeholder="What's on your mind?"></textarea>
            <div class="post-actions">
              <div class="media-inputs">
                <i class="fas fa-image" onclick="document.getElementById('mediaUrlInput').focus()" title="Add Image"></i>
                <i class="fas fa-video" onclick="document.getElementById('mediaUrlInput').focus()" title="Add Video"></i>
                <input type="text" id="mediaUrlInput" placeholder="Paste media URL">
              </div>
              <button class="btn-post" onclick="createPost()"><i class="fas fa-paper-plane"></i> Post</button>
            </div>
          </div>
          <div id="feedContainer"></div>
        </div>

        <!-- Search Page -->
        <div id="page-search" class="page">
          <div class="search-bar">
            <i class="fas fa-search"></i>
            <input type="text" id="searchInput" placeholder="Search users or posts..." oninput="searchContent()">
          </div>
          <div id="searchResults"></div>
        </div>

        <!-- Friends Page -->
        <div id="page-friends" class="page">
          <div class="card">
            <div class="card-title"><i class="fas fa-user-friends"></i> Friends</div>
            <div id="friendsList"></div>
          </div>
          <div class="card">
            <div class="card-title"><i class="fas fa-handshake"></i> Friend Requests</div>
            <div id="friendRequests"></div>
          </div>
          <div class="card">
            <div class="card-title"><i class="fas fa-user-plus"></i> Suggested</div>
            <div id="suggestedUsers"></div>
          </div>
        </div>

        <!-- Chat Page -->
        <div id="page-chat" class="page">
          <div class="card">
            <div class="card-title"><i class="fas fa-comments"></i> Chats</div>
            <div id="chatList"></div>
            <div id="chatDetail" style="display:none;">
              <div id="chatMessages" class="chat-messages"></div>
              <div class="chat-input">
                <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendChatMessage()">
                <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
              </div>
              <button onclick="closeChat()" style="margin-top:10px;background:none;border:none;color:#ff3b5c;cursor:pointer;font-size:13px;"><i class="fas fa-arrow-left"></i> Back</button>
            </div>
          </div>
        </div>

        <!-- Admin Page -->
        <div id="page-admin" class="page">
          <div class="card">
            <div class="card-title"><i class="fas fa-crown"></i> Admin Dashboard</div>
            <p style="color:#666;font-size:13px;margin-bottom:16px;">Manage users and content</p>
            <div id="adminContent"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Navigation -->
      <nav class="bottom-nav">
        <a href="#" data-page="feed" class="active"><i class="fas fa-home"></i><span>Home</span></a>
        <a href="#" data-page="search"><i class="fas fa-search"></i><span>Search</span></a>
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
          });
        });

        // Load Feed
        async function loadFeed() {
          try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            document.getElementById('feedContainer').innerHTML = posts.length ? posts.map(p => renderPost(p)).join('') : 
              '<div class="empty-state"><i class="fas fa-inbox"></i><p>No posts yet. Be the first!</p></div>';
          } catch(e) { console.error(e); }
        }

        function renderPost(p) {
          const liked = p.likes && p.likes.includes(currentUser.id);
          const mediaHtml = p.mediaUrl ? 
            (p.mediaUrl.match(/\\.(mp4|webm|ogg)$/) ? 
              '<div class="media"><video controls src="'+p.mediaUrl+'"></video></div>' : 
              '<div class="media"><img src="'+p.mediaUrl+'" alt="media"></div>') : '';
          return \`
            <div class="feed-post" data-id="\${p.id}">
              <div class="post-header">
                <div class="avatar">\${p.userName ? p.userName.charAt(0).toUpperCase() : '?'}</div>
                <div class="info">
                  <div class="name">\${p.userName || 'User'}</div>
                  <div class="time"><i class="far fa-clock"></i> \${new Date(p.timestamp).toLocaleString()}</div>
                </div>
              </div>
              <div class="post-body">
                \${p.text || ''}
                \${mediaHtml}
              </div>
              <div class="post-actions">
                <button onclick="toggleLike('\${p.id}')" class="\${liked ? 'liked' : ''}">
                  <i class="\${liked ? 'fas' : 'far'} fa-heart"></i> <span>\${p.likes ? p.likes.length : 0}</span>
                </button>
                <button onclick="toggleComments('\${p.id}')">
                  <i class="far fa-comment"></i> <span>\${p.comments ? p.comments.length : 0}</span>
                </button>
              </div>
              <div class="comments-section" id="comments-\${p.id}" style="display:none;">
                \${(p.comments || []).map(c => 
                  '<div class="comment"><span class="cname">'+c.userName+':</span> <span class="ctext">'+c.text+'</span></div>'
                ).join('')}
                <input type="text" class="comment-input" placeholder="Add a comment..." 
                  onkeypress="if(event.key==='Enter') addComment('\${p.id}', this.value); this.value='';">
              </div>
            </div>
          \`;
        }

        async function createPost() {
          const text = document.getElementById('postText').value;
          const mediaUrl = document.getElementById('mediaUrlInput').value;
          if (!text && !mediaUrl) return alert('Please enter text or a media URL');
          try {
            await fetch('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, mediaUrl })
            });
            document.getElementById('postText').value = '';
            document.getElementById('mediaUrlInput').value = '';
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

        // Search
        async function searchContent() {
          const q = document.getElementById('searchInput').value;
          if (!q.trim()) { document.getElementById('searchResults').innerHTML = ''; return; }
          try {
            const res = await fetch('/api/search?q='+encodeURIComponent(q));
            const data = await res.json();
            let html = '';
            if (data.users && data.users.length) {
              html += '<div style="margin-bottom:12px;"><strong style="color:#ff3b5c;"><i class="fas fa-users"></i> Users</strong></div>';
              html += data.users.map(u => 
                '<div class="friend-item"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><i class="fas fa-user-plus" onclick="sendFriendRequest(\\''+u.id+'\\')" title="Add Friend"></i></div></div>'
              ).join('');
            }
            if (data.posts && data.posts.length) {
              if (html) html += '<div style="margin:16px 0 8px;"><strong style="color:#ff3b5c;"><i class="fas fa-newspaper"></i> Posts</strong></div>';
              html += data.posts.map(p => renderPost(p)).join('');
            }
            if (!html) html = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found</p></div>';
            document.getElementById('searchResults').innerHTML = html;
          } catch(e) { console.error(e); }
        }

        // Friends
        async function loadFriends() {
          try {
            const res = await fetch('/api/friends');
            const data = await res.json();
            document.getElementById('friendsList').innerHTML = data.friends.length ? 
              data.friends.map(f => '<div class="friend-item"><div class="avatar">'+f.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+f.name+'</div><div class="status"><i class="fas fa-check-circle" style="color:#27ae60;"></i> Friend</div></div></div>').join('') :
              '<div class="empty-state"><i class="fas fa-user-friends"></i><p>No friends yet</p></div>';
            
            document.getElementById('friendRequests').innerHTML = data.requests.length ?
              data.requests.map(r => '<div class="friend-item"><div class="avatar">'+r.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+r.name+'</div><div class="status"><i class="fas fa-clock" style="color:#f1c40f;"></i> Pending</div></div><div class="actions"><button class="btn-sm success" onclick="acceptFriend(\\''+r.id+'\\')"><i class="fas fa-check"></i></button><button class="btn-sm danger" onclick="rejectFriend(\\''+r.id+'\\')"><i class="fas fa-times"></i></button></div></div>').join('') :
              '<div class="empty-state"><i class="fas fa-inbox"></i><p>No pending requests</p></div>';

            document.getElementById('suggestedUsers').innerHTML = data.suggested.length ?
              data.suggested.map(u => '<div class="friend-item"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status">'+u.phone+'</div></div><div class="actions"><button class="btn-sm primary" onclick="sendFriendRequest(\\''+u.id+'\\')"><i class="fas fa-user-plus"></i> Add</button></div></div>').join('') :
              '<div class="empty-state"><i class="fas fa-check"></i><p>All caught up!</p></div>';
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
              data.map(u => '<div class="friend-item" onclick="openChat(\\''+u.id+'\\')"><div class="avatar">'+u.name.charAt(0).toUpperCase()+'</div><div class="info"><div class="name">'+u.name+'</div><div class="status"><i class="fas fa-comment"></i> Click to chat</div></div></div>').join('') :
              '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>No chats yet</p></div>';
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
              '<div class="empty-state" style="padding:20px 0;"><i class="fas fa-comment-dots"></i><p>No messages yet</p></div>';
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

        // Admin
        async function loadAdmin() {
          try {
            const res = await fetch('/api/admin/data');
            const data = await res.json();
            let html = '';
            
            html += '<div style="margin-bottom:16px;"><strong style="color:#ff3b5c;"><i class="fas fa-users"></i> Users</strong></div>';
            data.users.forEach(u => {
              html += '<div class="admin-user-item"><div class="info"><div class="name">'+u.name+'</div><div class="phone">'+u.phone+'</div></div><div class="status '+(u.active ? 'active' : 'inactive')+'">'+(u.active ? 'Active' : 'Inactive')+'</div><div class="actions"><button class="btn-xs '+(u.active ? 'danger' : 'success')+'" onclick="adminToggleUser(\\''+u.id+'\\', '+(u.active ? 'false' : 'true')+')">'+(u.active ? 'Deactivate' : 'Activate')+'</button></div></div>';
            });
            
            html += '<div style="margin:20px 0 12px;"><strong style="color:#ff3b5c;"><i class="fas fa-newspaper"></i> Posts</strong></div>';
            data.posts.forEach(p => {
              html += '<div class="admin-post-item"><div class="text">'+p.text.substring(0,50)+(p.text.length>50?'...':'')+'</div><div class="by">by '+p.userName+'</div><div class="actions"><button class="btn-xs danger" onclick="adminDeletePost(\\''+p.id+'\\')">Delete</button></div></div>';
            });
            
            if (!data.posts.length) html += '<div class="empty-state"><i class="fas fa-inbox"></i><p>No posts</p></div>';
            
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
      <title>Forgot Password - FaceLove</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth-container{
          background: #141414;
          border-radius: 24px;
          padding: 45px 35px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #1f1f1f;
        }
        .auth-container .brand{
          text-align: center;
          margin-bottom: 30px;
        }
        .auth-container .brand i{
          font-size: 32px;
          color: #ff3b5c;
        }
        .auth-container .brand h1{
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin-top: 6px;
        }
        .auth-container .brand h1 span{ color: #ff3b5c; }
        .auth-container .brand p{
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }
        .auth-container .form-group{
          margin-bottom: 16px;
        }
        .auth-container .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .auth-container .form-group label i{
          color: #ff3b5c;
          width: 18px;
        }
        .auth-container .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1f1f1f;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth-container .form-group input:focus{
          border-color: #ff3b5c;
          background: #262626;
        }
        .auth-container .btn-primary{
          width: 100%;
          padding: 15px;
          background: #ff3b5c;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 8px;
        }
        .auth-container .btn-primary:hover{ background: #e63050; }
        .auth-container .btn-primary i{ margin-right: 8px; }
        .auth-container .extra-links{
          text-align: center;
          margin-top: 20px;
          color: #888;
          font-size: 14px;
        }
        .auth-container .extra-links a{
          color: #ff3b5c;
          text-decoration: none;
          font-weight: 600;
        }
        .auth-container .extra-links a:hover{ text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="auth-container">
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
          <button type="submit" class="btn-primary"><i class="fas fa-paper-plane"></i> Send Reset Code</button>
        </form>
        <div class="extra-links">
          <a href="/login"><i class="fas fa-arrow-left"></i> Back to Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.verified);
  
  if (!user) {
    return res.send('<script>alert("Phone number not found"); window.location="/forgot-password";</script>');
  }
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otps = db.otps.filter(o => o.phone !== phone);
  db.otps.push({ phone, code: otp, expires: Date.now() + 600000 });
  writeDB(db);
  
  const result = await sendOTP(phone, otp);
  
  if (!result.success && !result.mock) {
    return res.send(`<script>alert("Failed to send code: ${result.error}"); window.location="/forgot-password";</script>`);
  }
  
  res.send(`
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
          background: #0a0a0a;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
        }
        .auth-container{
          background: #141414;
          border-radius: 24px;
          padding: 45px 35px;
          width: 100%;
          max-width: 420px;
          border: 1px solid #1f1f1f;
        }
        .auth-container .brand{
          text-align: center;
          margin-bottom: 30px;
        }
        .auth-container .brand i{
          font-size: 32px;
          color: #ff3b5c;
        }
        .auth-container .brand h1{
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin-top: 6px;
        }
        .auth-container .brand h1 span{ color: #ff3b5c; }
        .auth-container .brand p{
          color: #888;
          font-size: 14px;
          margin-top: 4px;
        }
        .auth-container .info-box{
          background: #0d1a2a;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          color: #f1c40f;
          margin: 16px 0;
          border: 1px solid #1a2a3a;
          text-align: center;
        }
        .auth-container .form-group{
          margin-bottom: 16px;
        }
        .auth-container .form-group label{
          display: block;
          color: #aaa;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .auth-container .form-group label i{
          color: #ff3b5c;
          width: 18px;
        }
        .auth-container .form-group input{
          width: 100%;
          padding: 14px 16px;
          background: #1f1f1f;
          border: 2px solid transparent;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: 0.3s;
          outline: none;
        }
        .auth-container .form-group input:focus{
          border-color: #ff3b5c;
          background: #262626;
        }
        .auth-container .btn-primary{
          width: 100%;
          padding: 15px;
          background: #ff3b5c;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
          margin-top: 8px;
        }
        .auth-container .btn-primary:hover{ background: #e63050; }
        .auth-container .btn-primary i{ margin-right: 8px; }
        .note{ font-size: 12px; color: #555; text-align: center; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="brand">
          <i class="fas fa-undo-alt"></i>
          <h1>Face<span>Love</span></h1>
          <p>Enter new password</p>
        </div>
        ${result.mock ? '<div class="info-box"><i class="fas fa-exclamation-triangle"></i> Test Mode: Code is <strong>' + otp + '</strong></div>' : ''}
        <form action="/reset-password" method="POST">
          <input type="hidden" name="phone" value="${phone}">
          <div class="form-group">
            <label><i class="fas fa-lock"></i> New Password</label>
            <input type="password" name="newPassword" placeholder="Min 6 characters" required minlength="6">
          </div>
          <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Update Password</button>
        </form>
        <div class="note"><i class="fas fa-whatsapp"></i> Verification code sent via WhatsApp</div>
      </div>
    </body>
    </html>
  `);
});

app.post('/reset-password', (req, res) => {
  const { phone, newPassword } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.verified);
  
  if (!user) {
    return res.send('<script>alert("Error"); window.location="/login";</script>');
  }
  
  user.password = newPassword;
  writeDB(db);
  res.send('<script>alert("Password updated successfully!"); window.location="/login";</script>');
});

// ========== API ROUTES ==========

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
  const { text, mediaUrl } = req.body;
  const db = readDB();
  db.posts.push({
    id: 'p' + Date.now() + Math.random().toString(36).substr(2, 4),
    userId: req.session.userId,
    text: text || '',
    mediaUrl: mediaUrl || '',
    timestamp: Date.now(),
    likes: [],
    comments: []
  });
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

app.get('/api/search', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase() : '';
  const db = readDB();
  if (!q) return res.json({ users: [], posts: [] });
  const users = db.users.filter(u => u.verified && u.active && u.id !== req.session.userId && 
    (u.name.toLowerCase().includes(q) || u.phone.includes(q)));
  const posts = db.posts.filter(p => p.text.toLowerCase().includes(q));
  const enriched = posts.map(p => {
    const user = db.users.find(u => u.id === p.userId);
    return { ...p, userName: user ? user.name : 'User' };
  });
  res.json({ users, posts: enriched });
});

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
    id: 'f' + Date.now() + Math.random().toString(36).substr(2, 4), 
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
  db.messages.push({
    id: 'm' + Date.now() + Math.random().toString(36).substr(2, 4),
    fromUserId: req.session.userId,
    toUserId: toUserId,
    text: text,
    timestamp: Date.now()
  });
  writeDB(db);
  res.json({ success: true });
});

// ========== ADMIN API ==========

app.get('/api/admin/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const users = db.users.filter(u => u.verified);
  const posts = db.posts.map(p => {
    const u = db.users.find(usr => usr.id === p.userId);
    return { ...p, userName: u ? u.name : 'Deleted' };
  });
  res.json({ users, posts });
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

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('FaceLove running on port ' + PORT);
  console.log('Visit http://localhost:' + PORT);
});

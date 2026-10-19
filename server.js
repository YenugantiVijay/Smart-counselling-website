require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('node:crypto');
const path = require('node:path');
const { createDatabase, seedSampleData } = require('./db');
const { notifyOwner } = require('./notifications');

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || '';

// Initialize database
const db = createDatabase(process.env.DB_PATH);
seedSampleData(db);

const app = express();
app.disable('x-powered-by');

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://ka-f.fontawesome.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://kit.fontawesome.com', 'https://ka-f.fontawesome.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.fontawesome.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://ka-f.fontawesome.com'],
      connectSrc: ["'self'", 'https://ka-f.fontawesome.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Body parsing with strict size limits
app.use(express.json({ limit: '12kb' }));
app.use(express.urlencoded({ extended: false, limit: '12kb' }));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes before trying again.' }
});

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiry submissions from this IP address. Please try again later.' }
});

// In-memory session management
const sessions = new Map();

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function passwordMatches(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  const salt = process.env.ADMIN_PASSWORD_SALT || '';
  if (!hash || !salt || typeof password !== 'string') return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return safeEqual(derived, hash);
  } catch {
    return false;
  }
}

function getSession(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || !sessionSecret) return null;

  const cookies = cookieHeader.split(';').map(v => v.trim());
  const sessionCookie = cookies.find(v => v.startsWith('sc_demo_session='));
  if (!sessionCookie) return null;

  const token = sessionCookie.split('=')[1];
  if (!token) return null;

  const record = sessions.get(token);
  if (!record || record.expires < Date.now()) {
    if (record) sessions.delete(token);
    return null;
  }

  const expectedSig = crypto.createHmac('sha256', sessionSecret).update(token).digest('hex');
  if (!safeEqual(record.sig, expectedSig)) return null;

  return record;
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Please sign in to access the owner dashboard.' });
  }
  req.session = session;
  next();
}

function checkCsrf(req, res, next) {
  // Guard against cross-site request forgery for state-changing endpoints
  const customHeader = req.headers['x-requested-with'] || req.headers['x-sc-csrf'];
  if (!customHeader && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(403).json({ error: 'Missing security header.' });
  }
  next();
}

function cleanString(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[<>]/g, '').slice(0, max);
}

const ALLOWED_DESTINATIONS = ['UK', 'USA', 'Canada', 'Australia', 'Europe', 'Not sure yet'];
const ALLOWED_STUDY_LEVELS = ['Undergraduate', 'Postgraduate', 'Diploma', 'Language course', 'Not sure yet'];
const ALLOWED_STATUSES = ['New', 'Contacted', 'Appointment booked', 'Closed'];

function validateEnquiry(body) {
  const name = cleanString(body.name, 80);
  const phone = cleanString(body.phone, 20).replace(/[\s()-]/g, '');
  const email = cleanString(body.email, 120);
  const destination = cleanString(body.destination, 60);
  const studyLevel = cleanString(body.studyLevel, 60);
  const message = cleanString(body.message, 1000);
  const consent = body.consent === true || body.consent === 'true' || body.consent === 'on' || body.consent === 1;

  const errors = {};
  if (name.length < 2) {
    errors.name = 'Enter your name (at least 2 characters).';
  }
  if (!/^\+?[0-9]{10,15}$/.test(phone)) {
    errors.phone = 'Enter a valid phone number with 10–15 digits.';
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address or leave it blank.';
  }
  if (!ALLOWED_DESTINATIONS.includes(destination)) {
    errors.destination = 'Choose a valid study destination.';
  }
  if (!ALLOWED_STUDY_LEVELS.includes(studyLevel)) {
    errors.studyLevel = 'Choose a valid study level.';
  }
  if (!consent) {
    errors.consent = 'Please provide consent to be contacted.';
  }

  return {
    errors,
    values: { name, phone, email, destination, studyLevel, message }
  };
}

// ---------------- Public Endpoints ----------------

// Health check endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    ok: true,
    demo: true,
    timestamp: new Date().toISOString()
  });
});

// Demo configuration endpoint
app.get('/api/config', (req, res) => {
  const rawWa = (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const isWaConfigured = Boolean(rawWa && rawWa !== '910000000000' && rawWa.length >= 10);

  res.json({
    demo: true,
    websiteName: 'Smart Counselling Website',
    whatsappConfigured: isWaConfigured,
    whatsappNumber: isWaConfigured ? rawWa : null
  });
});

// Enquiry submission endpoint
app.post('/api/enquiries', enquiryLimiter, (req, res) => {
  // Honeypot bot protection
  if (req.body?.website) {
    return res.status(400).json({ error: 'Unable to process this submission.' });
  }

  const { errors, values } = validateEnquiry(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO enquiries (name, phone, email, destination, study_level, message, consent_recorded_at, status, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'New', 0)
    `);

    const result = insert.run(
      values.name,
      values.phone,
      values.email,
      values.destination,
      values.studyLevel,
      values.message
    );

    const enquiryId = result.lastInsertRowid;

    // Trigger notification service asynchronously (never blocks response)
    notifyOwner({ id: enquiryId, destination: values.destination, studyLevel: values.studyLevel });

    res.status(201).json({
      success: true,
      id: enquiryId,
      message: 'Your demo enquiry has been saved. A staff member can follow up.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to save enquiry. Please try again.' });
  }
});

// ---------------- Owner Dashboard Endpoints ----------------

// Admin login
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const username = cleanString(req.body?.username, 80);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (
    !process.env.ADMIN_USERNAME ||
    !sessionSecret ||
    !passwordMatches(password) ||
    !safeEqual(username, process.env.ADMIN_USERNAME)
  ) {
    return res.status(401).json({ error: 'Sign-in failed. Please check your credentials.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const sig = crypto.createHmac('sha256', sessionSecret).update(token).digest('hex');
  const expires = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

  sessions.set(token, { username, sig, expires });

  const secureFlag = isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `sc_demo_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureFlag}`
  );

  res.json({ success: true, username });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(v => v.trim());
    const sessionCookie = cookies.find(v => v.startsWith('sc_demo_session='));
    if (sessionCookie) {
      const token = sessionCookie.split('=')[1];
      if (token) sessions.delete(token);
    }
  }

  const secureFlag = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sc_demo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureFlag}`);
  res.json({ success: true });
});

// Check session status
app.get('/api/admin/session', (req, res) => {
  const session = getSession(req);
  res.json({
    authenticated: Boolean(session),
    username: session ? session.username : null
  });
});

// Get enquiries list & aggregate stats
app.get('/api/admin/enquiries', requireAdmin, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        name,
        phone,
        email,
        destination,
        study_level AS studyLevel,
        message,
        consent_recorded_at AS consentRecordedAt,
        status,
        is_sample AS isSample,
        created_at AS createdAt
      FROM enquiries
      ORDER BY id DESC
      LIMIT 250
    `).all();

    // Calculate status breakdown
    const stats = {
      total: rows.length,
      newCount: rows.filter(r => r.status === 'New').length,
      contactedCount: rows.filter(r => r.status === 'Contacted').length,
      appointmentBookedCount: rows.filter(r => r.status === 'Appointment booked').length,
      closedCount: rows.filter(r => r.status === 'Closed').length,
      sampleCount: rows.filter(r => r.isSample === 1).length
    };

    res.json({ enquiries: rows, stats });
  } catch (err) {
    res.status(500).json({ error: 'Unable to retrieve enquiries.' });
  }
});

// Update enquiry status
app.patch('/api/admin/enquiries/:id', requireAdmin, checkCsrf, (req, res) => {
  const id = Number(req.params.id);
  const status = cleanString(req.body?.status, 30);

  if (!Number.isInteger(id) || id < 1 || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid enquiry ID or status value.' });
  }

  try {
    const result = db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
    if (!result.changes) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }
    res.json({ success: true, id, status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update enquiry status.' });
  }
});

// Delete sample enquiries
app.delete('/api/admin/sample-enquiries', requireAdmin, checkCsrf, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM enquiries WHERE is_sample = 1').run();
    res.json({ success: true, removedCount: result.changes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove sample enquiries.' });
  }
});

// Static assets
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Fallback 404 for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

// Global error handler (prevent leaking internal details)
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'An unexpected internal error occurred.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Smart Counselling Website demo running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  db,
  sessions
};

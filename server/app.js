// Express API for the Daily Assessment Diary.
// Used by api/index.js (Vercel serverless) and server/dev.js (local).
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connect, User, Entry } = require('./db');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
if (process.env.CORS_ORIGIN) {
  // Only needed if the frontend is hosted on a different domain than the API.
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
}

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const SECRET = process.env.JWT_SECRET || (IS_PROD ? '' : 'dev-secret-change-me');

// Field keys allowed in an entry, and the ones required to Submit (same as the form).
const KEYS = ['1A','1B','1C','2A','2B','2C','3A','3B','3C','3D','4A','4B','4C','5A','5B','6A','6B','7A','7B','7C'];
const REQUIRED = ['1B', '1C', '2A', '2B', '2C'];
const MAX_LEN = 5000;

const isStr = (v) => typeof v === 'string';
const validDate = (d) => {
  if (!isStr(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === dd;
};
// Keep only known keys, as trimmed strings (also blocks Mongo operator injection).
const cleanData = (data) => {
  const out = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  for (const k of KEYS) {
    const v = data[k];
    if (v === null || v === undefined) continue;
    if (!isStr(v) && typeof v !== 'number') continue;
    const s = String(v).slice(0, MAX_LEN);
    if (s.trim() !== '') out[k] = s;
  }
  return out;
};
const complete = (data) => REQUIRED.every((k) => isStr(data[k]) && data[k].trim() !== '');
const sign = (u) => jwt.sign({ id: String(u._id) }, SECRET, { expiresIn: '30d' });
const publicEntry = (e) => ({ date: e.date, status: e.status, data: e.data || {} });

// Make sure config + DB are ready before any route runs.
app.use('/api', async (req, res, next) => {
  if (!SECRET) return res.status(500).json({ error: 'Server is not configured: JWT_SECRET is missing.' });
  try {
    await connect();
    next();
  } catch (e) {
    console.error('DB connection failed:', e.message);
    res.status(503).json({
      error: e.code === 'NO_DB_URI'
        ? 'Server is not configured: MONGODB_URI is missing.'
        : 'Cannot reach the database right now. Please try again.',
    });
  }
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  try {
    req.uid = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
};

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!isStr(name) || !isStr(email) || !isStr(password)) return res.status(400).json({ error: 'Name, email and password are required.' });
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n || n.length > 100) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password.length > 72) return res.status(400).json({ error: 'Password must be 72 characters or fewer.' });
  if (await User.findOne({ email: e })) return res.status(409).json({ error: 'This email is already registered.' });
  let u;
  try {
    u = await User.create({ name: n, email: e, hash: await bcrypt.hash(password, 10) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'This email is already registered.' });
    throw err;
  }
  res.json({ token: sign(u), name: u.name });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isStr(email) || !isStr(password)) return res.status(400).json({ error: 'Email and password are required.' });
  const u = await User.findOne({ email: email.trim().toLowerCase() });
  if (!u || !(await bcrypt.compare(password, u.hash))) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: sign(u), name: u.name });
}));

app.get('/api/entries', auth, wrap(async (req, res) => {
  const rows = await Entry.find({ user: req.uid }).sort({ date: -1 }).lean();
  res.json(rows.map(publicEntry));
}));

app.put('/api/entries/:date', auth, wrap(async (req, res) => {
  const { date } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid date.' });
  const data = cleanData(req.body && req.body.data);
  let status = (req.body && req.body.status) === 'submitted' ? 'submitted' : 'draft';
  if (status === 'submitted' && !complete(data)) {
    return res.status(400).json({ error: 'Please fill the required fields (1-B, 1-C, 2-A, 2-B, 2-C) before submitting.' });
  }
  const e = await Entry.findOneAndUpdate(
    { user: req.uid, date },
    { $set: { data, status } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  res.json(publicEntry(e));
}));

app.delete('/api/entries/:date', auth, wrap(async (req, res) => {
  if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date.' });
  await Entry.deleteOne({ user: req.uid, date: req.params.date });
  res.json({ ok: true });
}));

app.post('/api/restore', auth, wrap(async (req, res) => {
  const rows = req.body && req.body.rows;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Backup file is not valid.' });
  if (rows.length > 3700) return res.status(400).json({ error: 'Backup has too many entries.' });
  const ops = [];
  for (const r of rows) {
    if (!r || !validDate(r.date)) continue;
    const data = cleanData(r.data);
    const status = r.status === 'submitted' && complete(data) ? 'submitted' : 'draft';
    ops.push({
      updateOne: {
        filter: { user: req.uid, date: r.date },
        update: { $set: { data, status } },
        upsert: true,
      },
    });
  }
  if (ops.length) await Entry.bulkWrite(ops, { ordered: false });
  res.json({ restored: ops.length });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Malformed JSON etc.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;

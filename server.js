const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const authRouter = require('./routes/authRouter');
const postRouter = require('./routes/postRouter');
// News ingestion now runs as a separate process: workers/news_worker.py
// (see README "News worker" section) -- it is intentionally not required here.

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const MONGO_URL = process.env.MONGO_URI || process.env.MONGO_URL;
const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET;

if (!MONGO_URL) throw new Error('MONGO_URI or MONGO_URL is required.');
if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) throw new Error('COOKIE_SECRET must be configured and should be at least 32 characters long.');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

const normalizeOrigin = (value) => {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
]
  .filter(Boolean)
  .flatMap((origins) => origins.split(','))
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  ...configuredOrigins,
];

app.use(cors({
  origin(origin, callback) {

    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Rejected CORS origin: ${origin}`);
    return callback(new Error('CORS origin not allowed.'));
  },
  credentials: true,
}));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'devnews-backend' }));
app.use('/api/auth', authRouter);
app.use('/api/posts', postRouter);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.message === 'CORS origin not allowed.') return res.status(403).json({ message: err.message });
  res.status(500).json({ message: 'Internal server error.' });
});

const start = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (error) => { console.error('Uncaught exception:', error); process.exit(1); });

start();

module.exports = app;

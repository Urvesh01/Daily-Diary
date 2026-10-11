// MongoDB connection + models.
// On Vercel every request may run in a fresh/warm serverless instance, so the
// connection is cached on `global` and reused instead of reconnecting each time.
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI || process.env.MONGO_URI;

let cache = global.__diaryMongo || (global.__diaryMongo = { conn: null, promise: null });

async function connect() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!URI) {
    const e = new Error('MONGODB_URI is not set');
    e.code = 'NO_DB_URI';
    throw e;
  }
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(URI, { bufferCommands: false, serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .catch((err) => {
        cache.promise = null; // allow retry on the next request
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hash: { type: String, required: true },
  },
  { timestamps: true },
);

const entrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
    data: { type: Object, default: {} },
  },
  { timestamps: true, minimize: false },
);
entrySchema.index({ user: 1, date: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Entry = mongoose.models.Entry || mongoose.model('Entry', entrySchema);

module.exports = { connect, User, Entry };

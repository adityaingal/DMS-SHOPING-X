process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopx_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'shopx_test_secret_key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECURE = 'false';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

jest.mock('../services/googleAuth', () => {
  const state = {
    configured: true,
    verify: async () => ({
      googleId: 'google-sub-default',
      email: 'default@example.com',
      name: 'Default Google User',
      avatar: '',
    }),
  };
  return {
    __state: state,
    verifyGoogleCredential: (...args) => state.verify(...args),
    isConfigured: () => state.configured,
    getClientId: () => 'test-client-id.apps.googleusercontent.com',
  };
});

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = require('../app');
const connectDB = require('../config/db');
const User = require('../models/User');
const googleAuthMock = require('../services/googleAuth');

const CREDENTIAL = 'a'.repeat(64);
const LOCAL = { name: 'Local Larry', email: 'larry@shopx.test', password: 'LocalPass@123' };

const profile = (over = {}) => ({
  googleId: 'google-sub-1',
  email: 'new.google@shopx.test',
  name: 'New Google User',
  avatar: 'https://lh3.googleusercontent.com/a/avatar.png',
  ...over,
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('token='));

let localToken;
let localCookie;

beforeAll(async () => {
  await connectDB(process.env.MONGODB_URI);
  await User.deleteMany({});
  await User.create({
    name: LOCAL.name,
    email: LOCAL.email,
    passwordHash: await bcrypt.hash(LOCAL.password, 10),
    role: 'customer',
  });
  const login = await request(app).post('/api/auth/login').send({ email: LOCAL.email, password: LOCAL.password });
  localToken = login.body.data.token;
  localCookie = cookieOf(login);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close();
});

beforeEach(() => {
  googleAuthMock.__state.configured = true;
  googleAuthMock.__state.verify = async () => profile();
});

describe('Google configuration endpoint', () => {
  test('exposes the public client id when enabled', async () => {
    const res = await request(app).get('/api/auth/google/config');
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.clientId).toBe('test-client-id.apps.googleusercontent.com');
  });

  test('reports disabled when Google is not configured', async () => {
    googleAuthMock.__state.configured = false;
    const res = await request(app).get('/api/auth/google/config');
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.clientId).toBe('');
  });
});

describe('POST /api/auth/google', () => {
  test('rejects a missing credential', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('rejects a credential when Google is not configured', async () => {
    googleAuthMock.__state.configured = false;
    googleAuthMock.__state.verify = async () => {
      const err = new Error('Google Sign-In is not configured on this server.');
      err.statusCode = 503;
      err.code = 'GOOGLE_NOT_CONFIGURED';
      throw err;
    };
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not configured/i);
  });

  test('rejects an invalid Google credential', async () => {
    googleAuthMock.__state.verify = async () => {
      const err = new Error('Google sign-in could not be verified. Please try again.');
      err.statusCode = 401;
      err.code = 'GOOGLE_INVALID_CREDENTIAL';
      throw err;
    };
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/could not be verified/i);
  });

  test('creates a new customer account from a Google profile', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(200);
    const { user, token } = res.body.data;
    expect(user.email).toBe('new.google@shopx.test');
    expect(user.name).toBe('New Google User');
    expect(user.role).toBe('customer');
    expect(user.provider).toBe('google');
    expect(user.hasGoogle).toBe(true);
    expect(user.avatar).toContain('lh3.googleusercontent.com');
    expect(user.passwordHash).toBeUndefined();
    expect(token).toBeTruthy();

    const stored = await User.findOne({ email: 'new.google@shopx.test' }).select('+passwordHash');
    expect(stored).toBeTruthy();
    expect(stored.passwordHash).toBeFalsy();
    expect(stored.googleId).toBe('google-sub-1');
    expect(stored.role).toBe('customer');
  });

  test('sets an HTTP-only session cookie', async () => {
    googleAuthMock.__state.verify = async () => profile({ email: 'cookie.check@shopx.test', googleId: 'sub-cookie' });
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const cookie = cookieOf(res);
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  test('does not create a duplicate account when the same request is repeated', async () => {
    const first = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const second = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(await User.countDocuments({ email: 'new.google@shopx.test' })).toBe(1);
    expect(await User.countDocuments({ googleId: 'google-sub-1' })).toBe(1);
  });

  test('logs an existing Google user back in', async () => {
    await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('new.google@shopx.test');
    expect(await User.countDocuments({ email: 'new.google@shopx.test' })).toBe(1);
    expect(await User.countDocuments({ googleId: 'google-sub-1' })).toBe(1);
  });

  test('refuses to take over an existing password account', async () => {
    googleAuthMock.__state.verify = async () => profile({ email: LOCAL.email, googleId: 'sub-takeover' });
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already uses a password/i);

    const stored = await User.findOne({ email: LOCAL.email }).select('+passwordHash');
    expect(stored.googleId).toBeUndefined();
    expect(await stored.comparePassword(LOCAL.password)).toBe(true);
  });

  test('rejects a Google profile whose email is unverified', async () => {
    const before = await User.countDocuments({});
    googleAuthMock.__state.verify = async () => {
      const err = new Error('Your Google email address is not verified. Verify it with Google and try again.');
      err.statusCode = 401;
      err.code = 'GOOGLE_UNVERIFIED_EMAIL';
      throw err;
    };
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not verified/i);
    expect(await User.countDocuments({})).toBe(before);
  });

  test('a Google-created account cannot sign in with a password', async () => {
    await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'new.google@shopx.test', password: 'Anything@123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  test('a Google-created account cannot register with a password afterwards', async () => {
    await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Spoof',
      email: 'new.google@shopx.test',
      password: 'Hijack@123',
    });
    expect(res.status).toBe(409);
  });

  test('a Google-created account is never an admin', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const token = res.body.data.token;
    const dash = await request(app).get('/api/admin/dashboard').set(auth(token));
    expect(dash.status).toBe(403);
    const user = await User.findOne({ email: 'new.google@shopx.test' });
    expect(user.role).toBe('customer');
  });

  test('keeps the existing email/password login working', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: LOCAL.email, password: LOCAL.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(LOCAL.email);
  });
});

describe('Session and logout', () => {
  test('the session cookie authenticates /api/auth/me', async () => {
    googleAuthMock.__state.verify = async () => profile({ email: 'cookie.me@shopx.test', googleId: 'sub-me' });
    const login = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieOf(login));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('cookie.me@shopx.test');
  });

  test('logout clears the session cookie', async () => {
    googleAuthMock.__state.verify = async () => profile({ email: 'cookie.out@shopx.test', googleId: 'sub-out' });
    const login = await request(app).post('/api/auth/google').send({ credential: CREDENTIAL });
    const cookie = cookieOf(login);

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect((out.headers['set-cookie'] || []).join(';')).toMatch(/token=;/);

    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  test('protected routes reject anonymous requests', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });

  test('a session survives a page refresh without a Bearer token', async () => {
    const me = await request(app).get('/api/auth/me').set('Cookie', localCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(LOCAL.email);
  });
});

describe('Google account linking', () => {
  beforeEach(() => {
    googleAuthMock.__state.verify = async () =>
      profile({ email: LOCAL.email, googleId: 'google-sub-local', name: 'Local Larry' });
  });

  test('requires an authenticated session', async () => {
    const res = await request(app).post('/api/auth/google/link').send({ credential: CREDENTIAL });
    expect(res.status).toBe(401);
  });

  test('links a Google account to the signed-in password account', async () => {
    const res = await request(app)
      .post('/api/auth/google/link')
      .set(auth(localToken))
      .send({ credential: CREDENTIAL });

    expect(res.status).toBe(200);
    expect(res.body.data.user.hasGoogle).toBe(true);
    expect(res.body.data.user.email).toBe(LOCAL.email);

    const stored = await User.findOne({ email: LOCAL.email }).select('+passwordHash');
    expect(stored.googleId).toBe('google-sub-local');
    expect(await stored.comparePassword(LOCAL.password)).toBe(true);
    expect(stored.role).toBe('customer');
  });

  test('keeps the original password after linking', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: LOCAL.email, password: LOCAL.password });
    expect(login.status).toBe(200);
  });

  test('is idempotent when the same Google account is linked twice', async () => {
    const first = await request(app)
      .post('/api/auth/google/link')
      .set(auth(localToken))
      .send({ credential: CREDENTIAL });
    const second = await request(app)
      .post('/api/auth/google/link')
      .set(auth(localToken))
      .send({ credential: CREDENTIAL });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.message).toMatch(/already linked/i);
  });

  test('refuses to link a Google account with a different email', async () => {
    googleAuthMock.__state.verify = async () => profile({ email: 'someone.else@shopx.test', googleId: 'sub-other' });
    const res = await request(app)
      .post('/api/auth/google/link')
      .set(auth(localToken))
      .send({ credential: CREDENTIAL });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/must match/i);

    const stored = await User.findOne({ email: LOCAL.email });
    expect(stored.googleId).toBe('google-sub-local');
  });

  test('refuses to link a Google account owned by another user', async () => {
    await User.create({
      name: 'Moved Google Owner',
      email: 'owner.moved@shopx.test',
      googleId: 'sub-shared',
      provider: 'google',
      role: 'customer',
    });

    const other = await User.create({
      name: 'Second Local',
      email: 'second.local@shopx.test',
      passwordHash: await bcrypt.hash('Second@1234', 10),
      role: 'customer',
    });
    const otherToken = (
      await request(app).post('/api/auth/login').send({ email: other.email, password: 'Second@1234' })
    ).body.data.token;

    googleAuthMock.__state.verify = async () => profile({ email: other.email, googleId: 'sub-shared' });

    const res = await request(app)
      .post('/api/auth/google/link')
      .set(auth(otherToken))
      .send({ credential: CREDENTIAL });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already linked to another/i);

    const stored = await User.findOne({ email: other.email });
    expect(stored.googleId).toBeUndefined();
    expect(stored.role).toBe('customer');
  });
});

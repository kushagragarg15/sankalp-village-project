const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createMockDb } = require('./helpers/mockDb');

const mockDb = createMockDb();
jest.mock('../db', () => ({ getDb: () => mockDb, schema: jest.requireActual('../db/schema') }));

const { protect, authorize, invalidateUser } = require('../middleware/auth');

const VOLUNTEER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Asha',
  email: 'asha@example.com',
  role: 'volunteer',
  phone: null,
  isSuperAdmin: false
};
const ADMIN = { ...VOLUNTEER, id: '22222222-2222-4222-8222-222222222222', role: 'admin' };

const sign = (id, secret = process.env.JWT_SECRET) => jwt.sign({ id }, secret, { expiresIn: '1h' });

const app = express();
app.use(require('cookie-parser')());
app.get('/me', protect, (req, res) => res.json({ id: req.user.id, role: req.user.role }));
app.get('/admin', protect, authorize('admin'), (req, res) => res.json({ ok: true }));

beforeEach(() => {
  invalidateUser(VOLUNTEER.id);
  invalidateUser(ADMIN.id);
  mockDb.select.mockClear();
});

describe('protect', () => {
  test('401 when no token is sent', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Not authorized to access this route' });
  });

  test('401 when the token is signed with the wrong secret', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${sign(VOLUNTEER.id, 'other')}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Not authorized, token failed');
  });

  test('401 when the token is valid but the user no longer exists', async () => {
    mockDb.queueSelect([]);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${sign(VOLUNTEER.id)}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not found');
  });

  test('401 without a database round trip when the token id is not a uuid', async () => {
    const res = await request(app).get('/me').set('Authorization', `Bearer ${sign('not-a-uuid')}`);
    expect(res.status).toBe(401);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  test('accepts a Bearer token and attaches the user', async () => {
    mockDb.queueSelect([VOLUNTEER]);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${sign(VOLUNTEER.id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: VOLUNTEER.id, role: 'volunteer' });
  });

  test('accepts the token from the cookie as well', async () => {
    mockDb.queueSelect([VOLUNTEER]);
    const res = await request(app).get('/me').set('Cookie', `token=${sign(VOLUNTEER.id)}`);
    expect(res.status).toBe(200);
  });

  test('caches the user so a second request skips the database', async () => {
    mockDb.queueSelect([VOLUNTEER]);
    const token = sign(VOLUNTEER.id);
    await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});

describe('authorize', () => {
  test('403 for a role that is not allowed', async () => {
    mockDb.queueSelect([VOLUNTEER]);
    const res = await request(app).get('/admin').set('Authorization', `Bearer ${sign(VOLUNTEER.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/'volunteer' is not authorized/);
  });

  test('passes an allowed role through', async () => {
    mockDb.queueSelect([ADMIN]);
    const res = await request(app).get('/admin').set('Authorization', `Bearer ${sign(ADMIN.id)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

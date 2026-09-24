const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createMockDb } = require('./helpers/mockDb');

const mockDb = createMockDb();
jest.mock('../db', () => ({ getDb: () => mockDb, schema: jest.requireActual('../db/schema') }));

const { protect, blockDemoWrites, invalidateUser } = require('../middleware/auth');

const VOLUNTEER = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Demo Volunteer',
  email: 'demo.volunteer@example.com',
  role: 'volunteer',
  phone: '',
  isSuperAdmin: false,
  passwordHash: 'hash'
};
const COORDINATOR = { ...VOLUNTEER, id: '44444444-4444-4444-8444-444444444444', email: 'demo.coord@example.com', role: 'admin' };

const app = express();
app.use(express.json());
app.use(require('cookie-parser')());
app.use('/api/auth', require('../routes/auth'));
app.all('/guarded', protect, blockDemoWrites, (req, res) => res.json({ ok: true, isDemo: Boolean(req.user.isDemo) }));

beforeEach(() => {
  process.env.DEMO_VOLUNTEER_EMAIL = VOLUNTEER.email;
  process.env.DEMO_COORDINATOR_EMAIL = COORDINATOR.email;
  invalidateUser(VOLUNTEER.id);
  invalidateUser(COORDINATOR.id);
});

afterAll(() => {
  delete process.env.DEMO_VOLUNTEER_EMAIL;
  delete process.env.DEMO_COORDINATOR_EMAIL;
});

describe('GET /api/auth/demo', () => {
  test('reports which demo roles are configured', async () => {
    delete process.env.DEMO_COORDINATOR_EMAIL;
    const res = await request(app).get('/api/auth/demo');
    expect(res.body.data).toEqual({ volunteer: true, coordinator: false });
  });
});

describe('POST /api/auth/demo', () => {
  test('400 for an unknown role, without touching the database', async () => {
    mockDb.select.mockClear();
    const res = await request(app).post('/api/auth/demo').send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  test('404 when that demo is not configured', async () => {
    delete process.env.DEMO_VOLUNTEER_EMAIL;
    const res = await request(app).post('/api/auth/demo').send({ role: 'volunteer' });
    expect(res.status).toBe(404);
  });

  test('signs in as the coordinator with a demo-flagged token and no password hash', async () => {
    mockDb.queueSelect([COORDINATOR]);
    const res = await request(app).post('/api/auth/demo').send({ role: 'coordinator' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: COORDINATOR.id, role: 'admin', isDemo: true });
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET)).toMatchObject({ id: COORDINATOR.id, demo: true });
  });

  test('refuses, rather than promotes, when the configured account has the wrong role', async () => {
    process.env.DEMO_COORDINATOR_EMAIL = VOLUNTEER.email;
    mockDb.queueSelect([VOLUNTEER]);
    mockDb.update.mockClear();
    const res = await request(app).post('/api/auth/demo').send({ role: 'coordinator' });
    expect(res.status).toBe(503);
    expect(res.body.token).toBeUndefined();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  test('never hands out a super admin', async () => {
    mockDb.queueSelect([{ ...COORDINATOR, isSuperAdmin: true }]);
    const res = await request(app).post('/api/auth/demo').send({ role: 'coordinator' });
    expect(res.status).toBe(503);
  });
});

describe('blockDemoWrites', () => {
  const demoToken = jwt.sign({ id: COORDINATOR.id, demo: true }, process.env.JWT_SECRET);
  const realToken = jwt.sign({ id: COORDINATOR.id }, process.env.JWT_SECRET);

  test('lets a demo session read', async () => {
    mockDb.queueSelect([COORDINATOR]);
    const res = await request(app).get('/guarded').set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(true);
  });

  test('stops a demo session from writing', async () => {
    mockDb.queueSelect([COORDINATOR]);
    const res = await request(app).delete('/guarded').set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(403);
  });

  test('does not leak the demo flag into the same account signed in normally', async () => {
    mockDb.queueSelect([COORDINATOR]);
    await request(app).get('/guarded').set('Authorization', `Bearer ${demoToken}`);
    const res = await request(app).delete('/guarded').set('Authorization', `Bearer ${realToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isDemo).toBe(false);
  });
});

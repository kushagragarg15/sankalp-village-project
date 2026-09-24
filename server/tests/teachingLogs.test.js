const request = require('supertest');
const { createMockDb } = require('./helpers/mockDb');

// Pin the geofence so the test coordinates mean something fixed.
process.env.SCHOOL_LAT = '26.9335';
process.env.SCHOOL_LNG = '75.9162';
process.env.ATTENDANCE_RADIUS_M = '1000';

const mockDb = createMockDb();
jest.mock('../db', () => ({ getDb: () => mockDb, schema: jest.requireActual('../db/schema') }));

// Auth has its own suite; here it just stamps a volunteer on the request.
const VOLUNTEER_ID = '11111111-1111-4111-8111-111111111111';
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { id: VOLUNTEER_ID, _id: VOLUNTEER_ID, role: 'volunteer', name: 'Asha' };
    next();
  },
  authorize: () => (req, res, next) => next(),
  blockDemoWrites: (req, res, next) => next()
}));

const createApp = require('../app');
const app = createApp();

const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';

// A session that is live right now, with a code that is valid for 10 minutes.
const liveSession = (overrides = {}) => {
  const now = Date.now();
  return {
    id: SESSION_ID,
    startTime: new Date(now - 60 * 60 * 1000),
    endTime: new Date(now + 60 * 60 * 1000),
    activeCode: '4821',
    codeExpiry: new Date(now + 10 * 60 * 1000),
    lat: null,
    lng: null,
    ...overrides
  };
};

const AT_SCHOOL = { lat: 26.9335, lng: 75.9162 };
// ~1.1 km east of the school — just outside the 1 000 m radius.
const DOWN_THE_ROAD = { lat: 26.9335, lng: 75.9273 };

const validBody = (overrides = {}) => ({
  session_id: SESSION_ID,
  code: '4821',
  entries: [{ student_id: STUDENT_ID, subject: 'Maths', topic: 'Fractions' }],
  ...AT_SCHOOL,
  ...overrides
});

// The controller fetches the session and the registration in parallel
// (two selects, in that order), then inserts with one db.execute.
const arrange = ({ session = liveSession(), registered = true } = {}) => {
  mockDb.queueSelect(session ? [session] : []);
  mockDb.queueSelect(registered ? [{ id: 'reg-1' }] : []);
};

const submit = (body) => request(app).post('/api/teaching-logs/submit').send(body);

describe('POST /api/teaching-logs/submit', () => {
  describe('request validation (no database access)', () => {
    test('400 when entries are missing', async () => {
      const res = await submit(validBody({ entries: [] }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one entry/);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    test('400 when the attendance code is missing', async () => {
      const res = await submit(validBody({ code: undefined }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Attendance code is required');
    });

    test('400 when an entry lacks a subject or topic', async () => {
      const res = await submit(validBody({ entries: [{ student_id: STUDENT_ID, subject: 'Maths' }] }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/student_id, subject, and topic/);
    });
  });

  describe('server-side attendance checks', () => {
    beforeEach(() => mockDb.select.mockClear());

    test('404 when the session does not exist', async () => {
      arrange({ session: null });
      const res = await submit(validBody());
      expect(res.status).toBe(404);
    });

    test('400 when the session window is not open', async () => {
      const now = Date.now();
      arrange({ session: liveSession({ startTime: new Date(now + 3600000), endTime: new Date(now + 7200000) }) });
      const res = await submit(validBody());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Session is not currently active');
    });

    test('403 when the volunteer is not registered for the session', async () => {
      arrange({ registered: false });
      const res = await submit(validBody());
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You are not registered for this session');
    });

    test('400 on a wrong attendance code', async () => {
      arrange();
      const res = await submit(validBody({ code: '0000' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid attendance code');
    });

    test('400 when the code has expired even if it matches', async () => {
      arrange({ session: liveSession({ codeExpiry: new Date(Date.now() - 1000) }) });
      const res = await submit(validBody());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Attendance code has expired');
    });

    test('400 when the client omits its location (no silent bypass of the geofence)', async () => {
      arrange();
      const res = await submit(validBody({ lat: undefined, lng: undefined }));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Location is required/);
    });

    test('400 when the volunteer is outside the geofence, with the distance in the message', async () => {
      arrange();
      const res = await submit(validBody(DOWN_THE_ROAD));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/You are about 1\d{3}m away/);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    test('uses the session location over the default school when the session has one', async () => {
      // Session held 1.1 km down the road: the volunteer there is inside its fence.
      arrange({ session: liveSession(DOWN_THE_ROAD) });
      mockDb.queueExecute({ rows: [insertedRow()] });
      const res = await submit(validBody(DOWN_THE_ROAD));
      expect(res.status).toBe(201);
    });
  });

  describe('successful submission', () => {
    test('201 inserts every entry in one statement and reports duplicates', async () => {
      arrange();
      mockDb.execute.mockClear();
      // Two entries sent, one already logged: ON CONFLICT DO NOTHING returns one row.
      mockDb.queueExecute({ rows: [insertedRow()] });

      const res = await submit(
        validBody({
          entries: [
            { student_id: STUDENT_ID, subject: 'Maths', topic: 'Fractions' },
            { student_id: '44444444-4444-4444-8444-444444444444', subject: 'English', topic: 'Nouns' }
          ]
        })
      );

      expect(res.status).toBe(201);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(res.body.data.created).toBe(1);
      expect(res.body.data.duplicates).toBe(1);
      // Rows are reshaped to the Mongoose-era `_id` shape the client reads.
      expect(res.body.data.logs[0]).toMatchObject({ _id: 'log-1', id: 'log-1', subject: 'Maths', codeUsed: '4821' });
    });
  });
});

function insertedRow() {
  return {
    id: 'log-1',
    volunteer_id: VOLUNTEER_ID,
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    subject: 'Maths',
    topic: 'Fractions',
    code_used: '4821',
    lat: AT_SCHOOL.lat,
    lng: AT_SCHOOL.lng,
    logged_at: new Date().toISOString()
  };
}

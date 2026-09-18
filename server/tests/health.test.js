const request = require('supertest');

jest.mock('../db', () => ({ getDb: jest.fn(), schema: jest.requireActual('../db/schema') }));

const createApp = require('../app');

describe('operational endpoints', () => {
  const app = createApp();

  test('GET /health returns ok without touching the database', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /metrics exposes Prometheus metrics with the HTTP histogram', async () => {
    // Make one API request first so the histogram has a labelled series.
    await request(app).get('/api/students');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('# TYPE http_request_duration_seconds histogram');
    expect(res.text).toContain('http_requests_total{method="GET",route="/api/students",status_code="401"}');
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  test('every response carries an X-Request-Id, reusing the caller one if sent', async () => {
    const minted = await request(app).get('/api/students');
    expect(minted.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await request(app).get('/api/students').set('X-Request-Id', 'trace-123');
    expect(echoed.headers['x-request-id']).toBe('trace-123');
  });

  test('unknown routes fall through to a 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});

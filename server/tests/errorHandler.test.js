const errorHandler = require('../middleware/errorHandler');

// The handler maps PostgreSQL error codes to the same status/message shape
// the Mongoose-era client already understands.
const run = (err, env = 'test') => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  errorHandler(err, { log: { error: jest.fn() } }, res, jest.fn());
  process.env.NODE_ENV = previous;
  return res;
};

describe('errorHandler', () => {
  test('unique_violation -> 400 duplicate', () => {
    const res = run(Object.assign(new Error('dup'), { code: '23505' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Duplicate field value entered' });
  });

  test('invalid uuid text -> 404, matching the old CastError behaviour', () => {
    const res = run(Object.assign(new Error('bad uuid'), { code: '22P02' }));
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Resource not found');
  });

  test('reads the pg code off a wrapped DrizzleQueryError', () => {
    const cause = Object.assign(new Error('fk'), { code: '23503' });
    const res = run(Object.assign(new Error('Failed query'), { cause }));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Referenced record does not exist');
  });

  test('honours an explicit statusCode and falls back to 500', () => {
    expect(run(Object.assign(new Error('nope'), { statusCode: 418 })).statusCode).toBe(418);
    const res = run(new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'boom' });
  });

  test('only includes the stack trace in development', () => {
    expect(run(new Error('x'), 'production').body.stack).toBeUndefined();
    expect(run(new Error('x'), 'development').body.stack).toEqual(expect.stringContaining('Error: x'));
  });
});

// Global error handler middleware.
//
// Was written against Mongoose's error shapes (CastError, code 11000,
// ValidationError). Now maps the PostgreSQL error codes `pg` throws instead,
// keeping the same response shape and, where practical, the same status code
// a given failure used to produce.
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { message: err.message };

  // req.log is the request-scoped child logger from pino-http (carries the
  // request id); fall back to the root logger if the error came from before
  // that middleware ran.
  (req.log || logger).error({ err }, err.message);

  // drizzle-orm's node-postgres driver wraps the raw `pg` error (which carries
  // the Postgres error code) in `DrizzleQueryError.cause` rather than copying
  // `code` onto itself.
  const code = err.code || err.cause?.code;

  switch (code) {
    // invalid_text_representation — e.g. "not-a-uuid" passed where a uuid
    // column/param was expected. Mongoose's equivalent (a malformed ObjectId)
    // was a CastError that this handler turned into a 404.
    case '22P02':
      error = { message: 'Resource not found', statusCode: 404 };
      break;
    // unique_violation
    case '23505':
      error = { message: 'Duplicate field value entered', statusCode: 400 };
      break;
    // foreign_key_violation
    case '23503':
      error = { message: 'Referenced record does not exist', statusCode: 400 };
      break;
    // not_null_violation
    case '23502':
      error = { message: `${err.column || 'A required field'} is required`, statusCode: 400 };
      break;
    // check_violation
    case '23514':
      error = { message: 'Value violates a database constraint', statusCode: 400 };
      break;
    default:
      break;
  }

  res.status(error.statusCode || err.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

const pino = require('pino');

// One logger for the whole service. Structured JSON in production so a log
// shipper (Kibana / Loki / CloudWatch) can index fields like `requestId` and
// `userId` instead of grepping strings; pretty-printed in development.
//
// The MCP server owns stdout (it is the JSON-RPC wire), so it sets
// LOG_DESTINATION=stderr before loading anything. Tests set LOG_LEVEL=silent.
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
const destination = process.env.LOG_DESTINATION === 'stderr' ? 2 : 1;

const options = {
  level,
  base: { service: 'sankalp-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never let a secret reach the log line, whatever object gets passed in.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.activeCode'],
    censor: '[redacted]'
  }
};

if (process.env.NODE_ENV === 'development' && process.env.LOG_FORMAT !== 'json') {
  options.transport = { target: 'pino-pretty', options: { colorize: true, destination } };
}

const logger = options.transport ? pino(options) : pino(options, pino.destination(destination));

module.exports = logger;

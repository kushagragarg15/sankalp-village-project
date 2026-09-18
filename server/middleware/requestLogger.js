const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

// Every request gets an id: reuse the caller's X-Request-Id if it sent one,
// otherwise mint one. It is echoed back on the response and forwarded to the
// Python service (see services/aiServiceClient.js), so one id follows a
// request across browser -> Node -> Python and back.
const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // /health and /metrics are polled every few seconds by monitors; logging
  // them would be most of the log volume and none of the signal.
  autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
  // Keep lines small: method + url + status + duration is what gets read.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.originalUrl || req.url }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customProps: (req) => ({ userId: req.user?.id })
});

module.exports = requestLogger;

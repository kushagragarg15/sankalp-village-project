const client = require('prom-client');

// Prometheus metrics. `register` is module-level so the whole process shares
// one registry; the default collectors add process CPU / memory / event-loop
// lag, which is what actually explains a slow free-tier instance.
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  // The API's own p50 is ~30-100 ms (one Atlas/Neon round trip); AI routes
  // run for seconds. Buckets cover both.
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// The mounted route pattern (`/api/students/:id`), not the raw URL, so the
// label set stays small — one series per endpoint, not per student.
const routeLabel = (req) => {
  const base = req.baseUrl || '';
  const pattern = req.route?.path || '';
  return pattern ? `${base}${pattern}` : base || req.path;
};

const httpMetrics = (req, res, next) => {
  if (req.path === '/metrics' || req.path === '/health') return next();
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeLabel(req), status_code: String(res.statusCode) };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
};

const metricsHandler = async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (error) {
    next(error);
  }
};

module.exports = { register, httpMetrics, metricsHandler, httpRequestDuration, httpRequestsTotal };

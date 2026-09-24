const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { users } = require('../db/schema');

// Same reasoning as before the migration: this middleware runs on every
// protected request, so a full round trip on every call is worth avoiding.
// Cache the small projected user for a few seconds.
const USER_CACHE_TTL_MS = Number(process.env.USER_CACHE_TTL_MS || 15000);
const userCache = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadUser = async (id) => {
  const hit = userCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.user;

  if (!UUID_RE.test(id)) return null;

  const db = getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, phone: users.phone, isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!row) {
    userCache.delete(id);
    return null;
  }

  // Controllers read `req.user.id` and (via the pre-migration Mongoose shape)
  // `req.user._id`; keep both.
  const user = { ...row, _id: row.id };
  userCache.set(id, { user, expires: Date.now() + USER_CACHE_TTL_MS });
  return user;
};

// Call after changing a user's role or deleting them so the change is not
// masked by the cache.
const invalidateUser = (id) => userCache.delete(String(id));

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of userCache) {
    if (entry.expires <= now) userCache.delete(id);
  }
}, 60000).unref();

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }

    const user = await loadUser(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Copy rather than mutate: `user` is the cached object shared with the
    // account's non-demo sessions.
    req.user = decoded.demo ? { ...user, isDemo: true } : user;
    next();
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// A demo session is shared by everyone who clicks the button, so it may look
// at a page but not change who has an account or what they can do.
exports.blockDemoWrites = (req, res, next) => {
  if (req.user?.isDemo && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({
      success: false,
      message: 'The demo account can view volunteers but not add, edit or remove them.'
    });
  }
  next();
};

exports.invalidateUser = invalidateUser;
exports.UUID_RE = UUID_RE;

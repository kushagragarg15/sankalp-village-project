const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware runs on every protected request, so its database lookup used
// to add a full Atlas round trip (~30ms) plus the user's unbounded `attendance`
// array to every single call. We cache the small projected user for a few
// seconds instead; a client polling every 30s then pays for it once, not twice.
const USER_CACHE_TTL_MS = Number(process.env.USER_CACHE_TTL_MS || 15000);
const userCache = new Map();

const loadUser = async (id) => {
  const hit = userCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.user;

  const doc = await User.findById(id).select('name email role phone').lean();
  if (!doc) {
    userCache.delete(id);
    return null;
  }

  // Controllers read `req.user.id`, which a lean document does not provide.
  const user = { ...doc, id: String(doc._id) };
  userCache.set(id, { user, expires: Date.now() + USER_CACHE_TTL_MS });
  return user;
};

// Call after changing a user's role or deleting them so the change is not
// masked by the cache.
const invalidateUser = (id) => userCache.delete(String(id));

// Keep the map from growing without bound on a long-lived process.
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

    req.user = user;
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

exports.invalidateUser = invalidateUser;

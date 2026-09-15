const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { users } = require('../db/schema');
const { withId, withIds } = require('../db/serialize');
const { invalidateUser } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');

const ROLES = ['admin', 'volunteer'];

// Never selects passwordHash — Mongoose's `select: false` on `password` did
// this implicitly for every query that didn't explicitly ask for it.
const PUBLIC_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isSuperAdmin: users.isSuperAdmin,
  phone: users.phone,
  googleId: users.googleId,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select(PUBLIC_COLUMNS).from(users);
    const data = withIds(rows);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, req.params.id)).limit(1);

    if (!row) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: withId(row) });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'volunteer', phone = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
    }

    // Creating an account straight into the admin role is still granting
    // admin access — the same restriction updateUser applies to promotions.
    if (role === 'admin' && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only a super admin can create a coordinator account.' });
    }

    const db = getDb();
    const normalised = String(email).toLowerCase().trim();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalised)).limit(1);

    if (existing) {
      return res.status(409).json({ success: false, message: 'Somebody already has an account with that email' });
    }

    // Mongoose hashed this in a pre('save') hook; there is no such hook here,
    // so every write path that stores a password must hash it explicitly.
    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ name, email: normalised, passwordHash, role, phone })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, phone: users.phone });

    res.status(201).json({ success: true, data: withId(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    if (req.body.role && !ROLES.includes(req.body.role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
    }

    // Deciding who is admin and who is volunteer is a super-admin-only
    // action; a regular admin can still edit a member's name/email/phone.
    if (typeof req.body.role === 'string' && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only a super admin can change someone’s role.' });
    }

    // An admin must not be able to remove their own admin rights and lock the
    // club out of its own coordinator screens.
    if (req.body.role === 'volunteer' && String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own coordinator access. Ask another coordinator to do it.'
      });
    }

    // Explicit allowlist — no `findByIdAndUpdate(req.body)` mass assignment.
    // Password is never updatable through this route (was true before too).
    const patch = {};
    if (typeof req.body.name === 'string') patch.name = req.body.name;
    if (typeof req.body.email === 'string') patch.email = req.body.email.toLowerCase().trim();
    if (typeof req.body.phone === 'string') patch.phone = req.body.phone;
    if (typeof req.body.role === 'string') patch.role = req.body.role;

    const db = getDb();
    if (Object.keys(patch).length === 0) {
      const [existing] = await db.select(PUBLIC_COLUMNS).from(users).where(eq(users.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ success: false, message: 'User not found' });
      return res.status(200).json({ success: true, data: withId(existing) });
    }

    const [user] = await db.update(users).set(patch).where(eq(users.id, req.params.id)).returning(PUBLIC_COLUMNS);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // The auth middleware caches users briefly; drop this one so a role
    // change takes effect on the very next request instead of up to 15s later.
    invalidateUser(req.params.id);

    res.status(200).json({ success: true, data: withId(user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const db = getDb();
    const [user] = await db.delete(users).where(eq(users.id, req.params.id)).returning({ id: users.id });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    invalidateUser(req.params.id);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

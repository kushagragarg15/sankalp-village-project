const bcrypt = require('bcryptjs');

// Mongoose hashed passwords in a `pre('save')` hook, so every write site got
// it for free. PostgreSQL has no equivalent hook, so every place that used to
// rely on it (authController, userController, and the role/seed scripts that
// create a User with a password) must call this explicitly.
async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };

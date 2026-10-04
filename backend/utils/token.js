const jwt = require('jsonwebtoken');

const signToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

const sameSiteOption = () => {
  const explicit = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  if (explicit === 'lax' || explicit === 'strict' || explicit === 'none') return explicit;
  return process.env.COOKIE_SECURE === 'true' ? 'none' : 'lax';
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: sameSiteOption(),
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

module.exports = { signToken, verifyToken, cookieOptions };

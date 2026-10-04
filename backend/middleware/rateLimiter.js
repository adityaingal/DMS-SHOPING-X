const rateLimit = require('express-rate-limit');

const makeLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

const globalLimiter = makeLimiter(
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  Number(process.env.RATE_LIMIT_MAX) || 1000,
  'Too many requests. Please slow down and try again shortly.'
);

const authLimiter = makeLimiter(
  Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  'Too many attempts. Please wait a few minutes and try again.'
);

module.exports = { globalLimiter, authLimiter };

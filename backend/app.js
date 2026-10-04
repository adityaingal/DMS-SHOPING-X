const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const { globalLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminNotificationRoutes = require('./routes/adminNotifications');
const newsletterRoutes = require('./routes/newsletterRoutes');

const app = express();

app.set('trust proxy', 1);

const corsOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use('/api', globalLimiter);

const backendDir = __dirname;
const frontendDir = path.resolve(backendDir, process.env.FRONTEND_DIR || '../frontend');
const uploadsDir = path.join(backendDir, 'uploads');

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

app.get('/api/health', (req, res) =>
  res.json({ success: true, status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() })
);

// Render health check: 200 only when the API and MongoDB are both usable.
app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    db: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', notFound);

if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir, { index: 'index.html', extensions: ['html'] }));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const notFoundPage = path.join(frontendDir, '404.html');
    if (fs.existsSync(notFoundPage)) return res.status(404).sendFile(notFoundPage);
    res.status(404).json({ success: false, message: 'Page not found.' });
  });
}

app.use(errorHandler);

module.exports = app;

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const connectDB = require('./config/db');
const { validateNotificationConfig } = require('./config/notificationConfig');
const notificationWorker = require('./jobs/notificationWorker');

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const reportNotificationConfig = () => {
  const report = validateNotificationConfig();
  report.errors.forEach((message) => console.error(`[notifications] configuration error: ${message}`));
  report.warnings.forEach((message) => console.warn(`[notifications] ${message}`));
  return report;
};

const start = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET. Copy .env.example to .env and set a strong secret.');
      process.exit(1);
    }
    if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
      console.error('Missing MONGODB_URI. Set it to your MongoDB Atlas connection string in the Render dashboard.');
      process.exit(1);
    }
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
      console.error('JWT_SECRET must be at least 32 characters in production.');
      process.exit(1);
    }
    await connectDB();
    reportNotificationConfig();
    await notificationWorker.start();
    const server = app.listen(PORT, HOST, () => {
      console.log(`ShopX server running at http://localhost:${PORT} (binding ${HOST})`);
      console.log(`Open http://localhost:${PORT} in your browser.`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set the PORT environment variable to a free port.`);
      } else {
        console.error(`Server failed to start: ${err.message}`);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

const shutdown = () => {
  notificationWorker.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

start();

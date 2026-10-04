const mongoose = require('mongoose');

const connectDB = async (uri) => {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopx';
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${conn.connection.host} (${conn.connection.name})`);
  return conn;
};

module.exports = connectDB;

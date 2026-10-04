const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const readline = require('readline');
const connectDB = require('../config/db');
const User = require('../models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const run = async () => {
  const emailArg = process.argv[2] || process.env.ADMIN_EMAIL;
  const passwordArg = process.argv[3] || process.env.ADMIN_PASSWORD;

  await connectDB();

  let email = emailArg;
  let password = passwordArg;

  if (!email) email = (await ask('Admin email: ')).trim();
  if (!password) password = (await ask('Admin password (min 8 chars): ')).trim();

  if (!/^\S+@\S+\.\S+$/.test(email || '')) {
    console.error('Invalid email address.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin already exists: ${existing.email}`);
      await mongoose.connection.close();
      process.exit(0);
    }
    existing.role = 'admin';
    existing.passwordHash = await bcrypt.hash(password, 10);
    await existing.save();
    console.log(`Promoted existing user ${existing.email} to admin.`);
  } else {
    await User.create({
      name: 'ShopX Administrator',
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
    });
    console.log(`Admin account created: ${email.toLowerCase()}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Failed to create admin:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});

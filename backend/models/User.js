const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120, default: '' },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, trim: true, maxlength: 128 },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    avatar: { type: String, trim: true, default: '', maxlength: 500 },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    addresses: { type: [addressSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.index({ role: 1 });

userSchema.index(
  { googleId: 1 },
  { unique: true, name: 'googleId_unique', partialFilterExpression: { googleId: { $type: 'string' } } }
);

userSchema.pre('validate', function (next) {
  if (!this.passwordHash && !this.googleId) {
    this.invalidate('passwordHash', 'A password or a linked Google account is required.');
  }
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.hasPassword = function () {
  return Boolean(this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

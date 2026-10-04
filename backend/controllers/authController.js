const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { signToken, cookieOptions } = require('../utils/token');
const { verifyGoogleCredential, isConfigured, getClientId } = require('../services/googleAuth');

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  addresses: user.addresses,
  avatar: user.avatar || '',
  provider: user.provider || 'local',
  hasGoogle: Boolean(user.googleId),
  createdAt: user.createdAt,
});

const setAuthCookie = (res, token) => res.cookie('token', token, cookieOptions());

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw new AppError('An account with this email already exists.', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, phone: phone || '' });

  const token = signToken(user._id, user.role);
  setAuthCookie(res, token);
  sendSuccess(res, { user: publicUser(user), token }, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (!user.isActive) throw new AppError('This account has been deactivated. Contact support.', 403);

  const token = signToken(user._id, user.role);
  setAuthCookie(res, token);
  user.passwordHash = undefined;
  sendSuccess(res, { user: publicUser(user), token });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', { ...cookieOptions(), maxAge: 0 });
  sendSuccess(res, { message: 'Logged out successfully.' });
});

const googleConfig = asyncHandler(async (req, res) => {
  sendSuccess(res, { enabled: isConfigured(), clientId: isConfigured() ? getClientId() : '' });
});

const findByGoogleIdentity = (profile) =>
  User.findOne({ $or: [{ email: profile.email }, { googleId: profile.googleId }] });

const googleLogin = asyncHandler(async (req, res) => {
  const profile = await verifyGoogleCredential(req.body.credential);

  let user = await findByGoogleIdentity(profile);

  if (!user) {
    try {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatar: profile.avatar,
        provider: 'google',
        role: 'customer',
      });
    } catch (err) {
      if (err && err.code === 11000) {
        user = await findByGoogleIdentity(profile);
      }
      if (!user) throw err;
    }
  } else if (!user.googleId) {
    throw new AppError(
      'An account with this email already uses a password. Sign in with your password first, then link Google from your profile.',
      409
    );
  } else if (user.googleId !== profile.googleId) {
    throw new AppError('This Google account is linked to a different ShopX account.', 409);
  } else {
    if (profile.avatar && user.avatar !== profile.avatar) {
      user.avatar = profile.avatar;
      await user.save();
    }
  }

  if (!user.isActive) throw new AppError('This account has been deactivated. Contact support.', 403);

  const token = signToken(user._id, user.role);
  setAuthCookie(res, token);
  sendSuccess(res, { user: publicUser(user), token });
});

const googleLink = asyncHandler(async (req, res) => {
  const profile = await verifyGoogleCredential(req.body.credential);
  const user = await User.findById(req.user._id);

  if (String(user.email) !== profile.email) {
    throw new AppError('The Google account email must match your ShopX email to be linked.', 409);
  }

  if (user.googleId === profile.googleId) {
    return sendSuccess(res, { user: publicUser(user), message: 'Google account is already linked.' });
  }

  if (user.googleId) {
    throw new AppError('A different Google account is already linked. Unlink it first.', 409);
  }

  const owner = await User.findOne({ googleId: profile.googleId });
  if (owner && String(owner._id) !== String(user._id)) {
    throw new AppError('This Google account is already linked to another ShopX account.', 409);
  }

  user.googleId = profile.googleId;
  if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
  await user.save();

  sendSuccess(res, { user: publicUser(user), message: 'Google account linked.' });
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: publicUser(req.user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  const user = await User.findById(req.user._id);

  if (email && String(email).toLowerCase() !== user.email) {
    const clash = await User.findOne({ email: String(email).toLowerCase() });
    if (clash) throw new AppError('An account with this email already exists.', 409);
    user.email = email;
  }
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;

  await user.save();
  sendSuccess(res, { user: publicUser(user) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect.', 401);
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  sendSuccess(res, { message: 'Password updated successfully.' });
});

const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const body = { ...req.body };
  if (user.addresses.length === 0) body.isDefault = true;
  if (body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push(body);
  await user.save();
  sendSuccess(res, { addresses: user.addresses }, 201);
});

const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw new AppError('Address not found.', 404);

  Object.assign(address, req.body);
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = a.id === address.id));
  if (!user.addresses.some((a) => a.isDefault) && user.addresses[0]) {
    user.addresses[0].isDefault = true;
  }
  await user.save();
  sendSuccess(res, { addresses: user.addresses });
});

const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) throw new AppError('Address not found.', 404);

  address.deleteOne();
  if (!user.addresses.some((a) => a.isDefault) && user.addresses[0]) {
    user.addresses[0].isDefault = true;
  }
  await user.save();
  sendSuccess(res, { addresses: user.addresses });
});

module.exports = {
  register,
  login,
  logout,
  me,
  googleConfig,
  googleLogin,
  googleLink,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  publicUser,
};

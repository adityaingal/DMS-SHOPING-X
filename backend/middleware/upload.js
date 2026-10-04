const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Only JPEG, PNG, WEBP, GIF or AVIF images are allowed.', 400));
  },
});

const getPublicUrl = (filename) => `/uploads/${filename}`;

module.exports = { upload, getPublicUrl, uploadDir };

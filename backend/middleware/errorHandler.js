const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong. Please try again.';
  let errors = err.errors || null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed.';
    errors = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier provided.';
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || { field: 'field' })[0];
    message = `An account with that ${field} already exists.`;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 5 MB.' : err.message;
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (process.env.NODE_ENV === 'development' && statusCode >= 500 && err.stack) {
    body.stack = err.stack.split('\n').slice(0, 3).join(' | ');
  }
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    body.message = 'Internal server error. Please try again later.';
  }

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };

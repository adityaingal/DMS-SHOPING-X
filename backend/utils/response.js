const sendSuccess = (res, data, statusCode = 200, extra = {}) =>
  res.status(statusCode).json({ success: true, data, ...extra });

const sendError = (res, statusCode, message, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { sendSuccess, sendError };

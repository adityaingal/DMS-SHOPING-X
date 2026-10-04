class NotificationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'NotificationError';
    this.category = options.category || 'unknown';
    this.retryable = options.retryable !== false;
    this.retryAfterMs = options.retryAfterMs || null;
    this.status = options.status || null;
    this.safe = true;
  }
}

module.exports = NotificationError;

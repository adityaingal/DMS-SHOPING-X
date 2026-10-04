const { OAuth2Client } = require('google-auth-library');

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

let cachedClient = null;
let cachedClientId = null;

const clientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

const isConfigured = () => Boolean(clientId());

const getClient = () => {
  const id = clientId();
  if (!cachedClient || cachedClientId !== id) {
    cachedClient = new OAuth2Client(id);
    cachedClientId = id;
  }
  return cachedClient;
};

const fail = (message, statusCode, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

/**
 * Verifies a Google Identity Services ID token (credential) using Google's
 * official library. Never trusts profile data sent by the browser.
 */
const verifyGoogleCredential = async (credential) => {
  if (!isConfigured()) {
    throw fail('Google Sign-In is not configured on this server.', 503, 'GOOGLE_NOT_CONFIGURED');
  }

  const expectedAudience = clientId();

  let payload;
  try {
    const ticket = await getClient().verifyIdToken({ idToken: credential, audience: expectedAudience });
    payload = ticket.getPayload();
  } catch (err) {
    const reason = String(err && err.message ? err.message : '');
    if (/expired/i.test(reason)) {
      throw fail('Your Google sign-in session expired. Please try again.', 401, 'GOOGLE_TOKEN_EXPIRED');
    }
    if (/audience/i.test(reason)) {
      throw fail('This Google sign-in is not valid for this website.', 401, 'GOOGLE_BAD_AUDIENCE');
    }
    throw fail('Google sign-in could not be verified. Please try again.', 401, 'GOOGLE_INVALID_CREDENTIAL');
  }

  if (!payload || !payload.sub || !payload.email) {
    throw fail('Google did not return the expected account details.', 401, 'GOOGLE_INVALID_CREDENTIAL');
  }

  if (!GOOGLE_ISSUERS.includes(payload.iss)) {
    throw fail('Google sign-in could not be verified. Please try again.', 401, 'GOOGLE_INVALID_ISSUER');
  }

  if (payload.aud && payload.aud !== expectedAudience) {
    throw fail('This Google sign-in is not valid for this website.', 401, 'GOOGLE_BAD_AUDIENCE');
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    throw fail('Your Google sign-in session expired. Please try again.', 401, 'GOOGLE_TOKEN_EXPIRED');
  }

  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw fail('Your Google email address is not verified. Verify it with Google and try again.', 401, 'GOOGLE_UNVERIFIED_EMAIL');
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: String(payload.name || payload.email).trim().slice(0, 80),
    avatar: typeof payload.picture === 'string' ? payload.picture : '',
  };
};

module.exports = { verifyGoogleCredential, isConfigured, getClientId: clientId };

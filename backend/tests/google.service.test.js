process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const { OAuth2Client } = require('google-auth-library');
const { verifyGoogleCredential, isConfigured, getClientId } = require('../services/googleAuth');

const VALID_PAYLOAD = {
  sub: 'google-sub-123',
  iss: 'accounts.google.com',
  aud: 'test-client-id.apps.googleusercontent.com',
  email: 'GooglE.User@Example.com',
  email_verified: true,
  name: 'Google User',
  picture: 'https://lh3.googleusercontent.com/a/pic',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let spy;

const mockPayload = (payload) => {
  spy.mockResolvedValue({ getPayload: () => payload });
};

const expectFailure = async (fn, status, code) => {
  try {
    await fn();
  } catch (err) {
    expect(err.statusCode).toBe(status);
    expect(err.code).toBe(code);
    return;
  }
  throw new Error(`expected a ${status} ${code} error`);
};

beforeEach(() => {
  spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => VALID_PAYLOAD,
  });
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

afterEach(() => {
  spy.mockRestore();
});

describe('Google credential verification service', () => {
  test('reports configuration state', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    expect(isConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = 'x.apps.googleusercontent.com';
    expect(isConfigured()).toBe(true);
    expect(getClientId()).toBe('x.apps.googleusercontent.com');
  });

  test('rejects every credential when Google is not configured', async () => {
    process.env.GOOGLE_CLIENT_ID = '  ';
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 503, 'GOOGLE_NOT_CONFIGURED');
    expect(spy).not.toHaveBeenCalled();
  });

  test('returns a normalised profile for a valid token', async () => {
    const profile = await verifyGoogleCredential('a'.repeat(40));
    expect(spy).toHaveBeenCalledWith({
      idToken: 'a'.repeat(40),
      audience: 'test-client-id.apps.googleusercontent.com',
    });
    expect(profile).toEqual({
      googleId: 'google-sub-123',
      email: 'google.user@example.com',
      name: 'Google User',
      avatar: 'https://lh3.googleusercontent.com/a/pic',
    });
  });

  test('falls back to the email when Google returns no name', async () => {
    mockPayload({ ...VALID_PAYLOAD, name: undefined });
    const profile = await verifyGoogleCredential('a'.repeat(40));
    expect(profile.name).toBe('GooglE.User@Example.com');
  });

  test('rejects an unverified email address', async () => {
    mockPayload({ ...VALID_PAYLOAD, email_verified: false });
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_UNVERIFIED_EMAIL');
  });

  test('rejects an unexpected issuer', async () => {
    mockPayload({ ...VALID_PAYLOAD, iss: 'evil.example.com' });
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_INVALID_ISSUER');
  });

  test('rejects a mismatched audience', async () => {
    mockPayload({ ...VALID_PAYLOAD, aud: 'other-client.apps.googleusercontent.com' });
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_BAD_AUDIENCE');
  });

  test('rejects an expired token', async () => {
    mockPayload({ ...VALID_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 60 });
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_TOKEN_EXPIRED');
  });

  test('rejects a token missing a subject or email', async () => {
    mockPayload({ ...VALID_PAYLOAD, email: undefined });
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_INVALID_CREDENTIAL');
  });

  test('maps Google library errors for expired tokens', async () => {
    spy.mockRejectedValue(new Error('Token used too early, or expired'));
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_TOKEN_EXPIRED');
  });

  test('maps Google library audience errors', async () => {
    spy.mockRejectedValue(new Error('Wrong recipient, audience mismatch'));
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_BAD_AUDIENCE');
  });

  test('maps any other library error to a generic 401', async () => {
    spy.mockRejectedValue(new Error('invalid grant'));
    await expectFailure(() => verifyGoogleCredential('a'.repeat(40)), 401, 'GOOGLE_INVALID_CREDENTIAL');
  });
});

import crypto from 'crypto';

const { subtle } = crypto.webcrypto;

export interface ChallengeData {
  challengeId: string;
  identifier: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
  challengeToken?: string;
}

/**
 * Builds a standardized SecureMAX challenge message.
 */
export function buildChallengeMessage(data: {
  challengeId: string;
  identifier: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    '=== SecureMAX Cryptographic Challenge ===',
    `Challenge ID: ${data.challengeId}`,
    `Subject: ${data.identifier}`,
    `Nonce: ${data.nonce}`,
    `Issued At: ${data.issuedAt}`,
    `Expires At: ${data.expiresAt}`,
    '========================================',
  ].join('\n');
}

/**
 * Creates a new cryptographically random challenge.
 */
export function createChallenge(identifier: string, ttlSeconds = 120): ChallengeData {
  const challengeId = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  const issuedAt = now.toISOString();
  const expiresAt = expires.toISOString();

  const message = buildChallengeMessage({
    challengeId,
    identifier,
    nonce,
    issuedAt,
    expiresAt,
  });

  const secret = process.env.JWT_SECRET || 'securemax-challenge-signing-secret';
  const hmac = crypto.createHmac('sha256', secret).update(`${challengeId}:${identifier}:${nonce}:${expiresAt}`).digest('hex');
  const challengeToken = Buffer.from(JSON.stringify({ challengeId, identifier, nonce, expiresAt, hmac })).toString('base64');

  return {
    challengeId,
    identifier,
    nonce,
    message,
    issuedAt,
    expiresAt,
    challengeToken,
  };
}

/**
 * Validates a signed challenge token for serverless environments.
 */
export function verifyChallengeToken(token: string): { valid: boolean; data?: ChallengeData } {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    const secret = process.env.JWT_SECRET || 'securemax-challenge-signing-secret';
    const expectedHmac = crypto.createHmac('sha256', secret).update(`${parsed.challengeId}:${parsed.identifier}:${parsed.nonce}:${parsed.expiresAt}`).digest('hex');

    if (expectedHmac !== parsed.hmac) {
      return { valid: false };
    }

    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      return { valid: false };
    }

    const message = buildChallengeMessage({
      challengeId: parsed.challengeId,
      identifier: parsed.identifier,
      nonce: parsed.nonce,
      issuedAt: new Date(new Date(parsed.expiresAt).getTime() - 120000).toISOString(),
      expiresAt: parsed.expiresAt,
    });

    return {
      valid: true,
      data: {
        challengeId: parsed.challengeId,
        identifier: parsed.identifier,
        nonce: parsed.nonce,
        message,
        issuedAt: new Date(new Date(parsed.expiresAt).getTime() - 120000).toISOString(),
        expiresAt: parsed.expiresAt,
        challengeToken: token,
      },
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Verifies an ECDSA P-256 (SHA-256) signature against an SPKI base64 public key.
 * Supports both WebCrypto IEEE P1363 (64 bytes raw) and ASN.1 DER formats.
 */
export async function verifyP256Signature(
  publicKeyBase64: string,
  message: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const spkiBuffer = Buffer.from(publicKeyBase64, 'base64');
    const sigBuffer = Buffer.from(signatureBase64, 'base64');
    const msgBuffer = Buffer.from(message, 'utf8');

    // 1. First attempt: Standard WebCrypto subtle.verify (IEEE P1363 format)
    try {
      const cryptoKey = await subtle.importKey(
        'spki',
        spkiBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const isValidWeb = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        sigBuffer,
        msgBuffer
      );

      if (isValidWeb) return true;
    } catch {
      // Ignore and fallback to Node.js DER verification
    }

    // 2. Second attempt: Node.js crypto.createVerify (ASN.1 DER format)
    try {
      const pubKeyObj = crypto.createPublicKey({
        key: spkiBuffer,
        type: 'spki',
        format: 'der',
      });

      const verifier = crypto.createVerify('SHA256');
      verifier.update(msgBuffer);
      const isValidDer = verifier.verify(pubKeyObj, sigBuffer);
      if (isValidDer) return true;
    } catch {
      // Ignore
    }

    return false;
  } catch (err) {
    console.error('[P256 Verifier Error]:', err);
    return false;
  }
}

/**
 * Helper to generate a compliant P-256 key pair (for seeding/testing).
 */
export async function generateP256KeyPair(): Promise<{
  publicKeySpki: string;
  privateKeyPkcs8: string;
}> {
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const spki = Buffer.from(await subtle.exportKey('spki', keyPair.publicKey)).toString('base64');
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', keyPair.privateKey)).toString('base64');

  return { publicKeySpki: spki, privateKeyPkcs8: pkcs8 };
}

/**
 * Signs a message on server (used for automated tests & seeded demo keys).
 */
export async function signWithPkcs8(privateKeyPkcs8: string, message: string): Promise<string> {
  const privKey = await subtle.importKey(
    'pkcs8',
    Buffer.from(privateKeyPkcs8, 'base64'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    Buffer.from(message, 'utf8')
  );

  return Buffer.from(sig).toString('base64');
}

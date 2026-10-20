import crypto from 'crypto';
import { SanitizedEvidence } from './types';

const HEX_KEY_REGEX = /[0-9a-fA-F]{64}/g;
const JWT_SIGNATURE_REGEX = /ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)/g;
const PRIVATE_KEY_REGEX = /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[^-]+-----END[ A-Z0-9_-]+PRIVATE KEY-----/g;

/**
 * Sanitizes arbitrary objects or strings to prevent leaking secrets,
 * plaintext DEKs, master keys, full JWT signatures, or user passwords.
 */
export function sanitizeData(data: any): { sanitized: any; redactions: string[] } {
  const redactions: string[] = [];

  function scrub(val: any): any {
    if (val === null || val === undefined) return val;

    if (typeof val === 'string') {
      let result = val;

      if (PRIVATE_KEY_REGEX.test(result)) {
        result = result.replace(PRIVATE_KEY_REGEX, '[REDACTED_ASYMMETRIC_PRIVATE_KEY]');
        redactions.push('ASYMMETRIC_PRIVATE_KEY');
      }

      if (HEX_KEY_REGEX.test(result)) {
        result = result.replace(HEX_KEY_REGEX, (match) => {
          redactions.push(`256_BIT_KEY_HASH:${crypto.createHash('sha256').update(match).digest('hex').slice(0, 8)}...`);
          return `[REDACTED_256_BIT_KEY:sha256_hint=${crypto.createHash('sha256').update(match).digest('hex').slice(0, 8)}]`;
        });
      }

      if (JWT_SIGNATURE_REGEX.test(result)) {
        result = result.replace(JWT_SIGNATURE_REGEX, (match, sig) => {
          redactions.push('JWT_SIGNATURE_TOKEN');
          const parts = match.split('.');
          return `${parts[0]}.${parts[1]}.[REDACTED_SIGNATURE]`;
        });
      }

      return result;
    }

    if (Buffer.isBuffer(val)) {
      redactions.push(`BUFFER_OCTETS_${val.length}_BYTES`);
      return `[REDACTED_BUFFER:${val.length} bytes (sha256=${crypto.createHash('sha256').update(val).digest('hex').slice(0, 12)}...)]`;
    }

    if (Array.isArray(val)) {
      return val.map(scrub);
    }

    if (typeof val === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        const lowerKey = k.toLowerCase();
        if (
          lowerKey.includes('masterkey') ||
          lowerKey.includes('dekplaintext') ||
          lowerKey.includes('privatekey') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('password')
        ) {
          redactions.push(`SENSITIVE_KEY_PROPERTY:${k}`);
          cleaned[k] = `[REDACTED_${k.toUpperCase()}]`;
        } else {
          cleaned[k] = scrub(v);
        }
      }
      return cleaned;
    }

    return val;
  }

  const sanitized = scrub(data);
  return { sanitized, redactions: Array.from(new Set(redactions)) };
}

/**
 * Creates a normalized SanitizedEvidence record.
 */
export function buildSanitizedEvidence(
  category: SanitizedEvidence['category'],
  title: string,
  description: string,
  details: Record<string, any>
): SanitizedEvidence {
  const { sanitized, redactions } = sanitizeData(details);
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category,
    title,
    description,
    details: sanitized,
    redactionsApplied: redactions,
  };
}

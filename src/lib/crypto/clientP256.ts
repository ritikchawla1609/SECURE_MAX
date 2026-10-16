'use client';

const STORAGE_DEVICE_ID_KEY = 'securemax_device_id';
const STORAGE_DEVICE_NAME_KEY = 'securemax_device_name';
const STORAGE_PUBLIC_KEY_KEY = 'securemax_public_key_spki';
const STORAGE_PRIVATE_KEY_JWK = 'securemax_private_key_jwk';
const STORAGE_USER_EMAIL_KEY = 'securemax_user_email';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface ClientDeviceInfo {
  deviceId: string;
  deviceName: string;
  publicKeySpki: string;
  userEmail?: string | null;
}

/**
 * Checks if this browser already has a registered P-256 device key.
 */
export function hasLocalDeviceKey(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem(STORAGE_DEVICE_ID_KEY) &&
    localStorage.getItem(STORAGE_PUBLIC_KEY_KEY) &&
    localStorage.getItem(STORAGE_PRIVATE_KEY_JWK)
  );
}

/**
 * Retrieves the stored device info without generating new keys.
 */
export function getLocalDeviceInfo(): ClientDeviceInfo | null {
  if (typeof window === 'undefined') return null;
  const deviceId = localStorage.getItem(STORAGE_DEVICE_ID_KEY);
  const deviceName = localStorage.getItem(STORAGE_DEVICE_NAME_KEY) || 'My Device';
  const publicKeySpki = localStorage.getItem(STORAGE_PUBLIC_KEY_KEY);
  const userEmail = localStorage.getItem(STORAGE_USER_EMAIL_KEY);

  if (!deviceId || !publicKeySpki) return null;
  return { deviceId, deviceName, publicKeySpki, userEmail };
}

/**
 * Generates or retrieves the device's cryptographic ECDSA P-256 credential.
 * The private key is held in browser local storage and never transmitted over the network.
 */
export async function getOrCreateLocalDeviceKey(
  preferredName?: string,
  userEmail?: string
): Promise<ClientDeviceInfo> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }

  const existing = getLocalDeviceInfo();
  if (existing) {
    if (userEmail && userEmail !== existing.userEmail) {
      localStorage.setItem(STORAGE_USER_EMAIL_KEY, userEmail);
    }
    return existing;
  }

  return generateAndSaveDeviceKey(preferredName || detectDeviceName(), userEmail);
}

/**
 * Generates a brand-new P-256 key pair and saves it to local storage.
 */
export async function generateAndSaveDeviceKey(
  deviceName: string,
  userEmail?: string
): Promise<ClientDeviceInfo> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }

  const subtle = window.crypto?.subtle;
  if (!subtle) {
    if (!window.isSecureContext) {
      throw new Error('Web Crypto / Passkeys require a Secure Context (HTTPS or http://localhost). Please access SecureMAX via http://localhost:3000.');
    }
    throw new Error('Hardware cryptographic engine (Web Crypto Subtle) is not supported or disabled in this browser.');
  }

  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable for local browser vault storage
    ['sign', 'verify']
  );

  const spkiBuffer = await subtle.exportKey('spki', keyPair.publicKey);
  const spkiBase64 = bufferToBase64(spkiBuffer);

  const jwkPrivateKey = await subtle.exportKey('jwk', keyPair.privateKey);

  const deviceId = 'dev_' + window.crypto.randomUUID().slice(0, 12);

  localStorage.setItem(STORAGE_DEVICE_ID_KEY, deviceId);
  localStorage.setItem(STORAGE_DEVICE_NAME_KEY, deviceName);
  localStorage.setItem(STORAGE_PUBLIC_KEY_KEY, spkiBase64);
  localStorage.setItem(STORAGE_PRIVATE_KEY_JWK, JSON.stringify(jwkPrivateKey));
  if (userEmail) {
    localStorage.setItem(STORAGE_USER_EMAIL_KEY, userEmail);
  }

  return {
    deviceId,
    deviceName,
    publicKeySpki: spkiBase64,
    userEmail,
  };
}

/**
 * Signs a challenge message using the local P-256 private key.
 * Private key stays on this device and is never sent over the wire.
 */
export async function signChallengeWithLocalKey(message: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }

  const jwkStr = localStorage.getItem(STORAGE_PRIVATE_KEY_JWK);
  if (!jwkStr) {
    throw new Error('No local P-256 private key found on this device. Please enroll this device first.');
  }

  const jwk = JSON.parse(jwkStr);
  const subtle = window.crypto.subtle;

  const privateKey = await subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(message)
  );

  return bufferToBase64(signatureBuffer);
}

/**
 * Clears the stored device key from this browser.
 */
export function clearLocalDeviceKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_DEVICE_ID_KEY);
  localStorage.removeItem(STORAGE_DEVICE_NAME_KEY);
  localStorage.removeItem(STORAGE_PUBLIC_KEY_KEY);
  localStorage.removeItem(STORAGE_PRIVATE_KEY_JWK);
  localStorage.removeItem(STORAGE_USER_EMAIL_KEY);
}

function detectDeviceName(): string {
  if (typeof window === 'undefined') return 'Secure Terminal';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Apple Mobile Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Mac/i.test(ua)) return 'Apple MacBook / Mac';
  if (/Windows/i.test(ua)) return 'Windows Workstation';
  if (/Linux/i.test(ua)) return 'Linux Terminal';
  return 'Personal Workstation';
}

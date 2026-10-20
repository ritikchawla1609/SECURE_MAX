import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole, UserStatus } from '@/types';

export interface BreachLabFixtures {
  attackerUser: any;
  tempAuthorizedUser: any;
  standardUser: any;
  deviceTesterUser: any;
  syntheticAssetAlpha: any;
  syntheticAssetBeta: any;
  testDevice: any;
  sessionLegitId: string;
  sessionAdversaryId: string;
}

const FIXTURE_PREFIX = 'breachlab_synthetic_';

/**
 * Initializes disposable, synthetic fixtures in the isolated sandbox.
 */
export async function initializeBreachLabFixtures(): Promise<BreachLabFixtures> {
  const sessionLegitId = `${FIXTURE_PREFIX}sess_legit_${Date.now()}`;
  const sessionAdversaryId = `${FIXTURE_PREFIX}sess_adv_${Date.now()}`;

  // 1. Synthetic Attacker User (Zero clearances)
  const attackerUser = {
    id: `${FIXTURE_PREFIX}usr_attacker_${Date.now()}`,
    name: 'BreachLab Synthetic Attacker',
    email: 'breachlab-attacker@synthetic.mil',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    kyc_status: 'VERIFIED' as const,
    did: `did:securemax:synthetic:attacker:${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  deviceStore.users.set(attackerUser.id, attackerUser);

  // 2. Synthetic Temporarily Authorized User
  const tempAuthorizedUser = {
    id: `${FIXTURE_PREFIX}usr_temp_auth_${Date.now()}`,
    name: 'BreachLab Temporarily Authorized User',
    email: 'breachlab-tempauth@synthetic.mil',
    role: UserRole.ENGINEER,
    status: UserStatus.ACTIVE,
    kyc_status: 'VERIFIED' as const,
    did: `did:securemax:synthetic:tempauth:${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  deviceStore.users.set(tempAuthorizedUser.id, tempAuthorizedUser);

  // 3. Synthetic Standard User (for Privilege Escalation test)
  const standardUser = {
    id: `${FIXTURE_PREFIX}usr_standard_${Date.now()}`,
    name: 'BreachLab Standard User',
    email: 'breachlab-standard@synthetic.mil',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    kyc_status: 'VERIFIED' as const,
    did: `did:securemax:synthetic:standard:${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  deviceStore.users.set(standardUser.id, standardUser);

  // 4. Synthetic Device Tester User
  const deviceTesterUser = {
    id: `${FIXTURE_PREFIX}usr_device_tester_${Date.now()}`,
    name: 'BreachLab Device Tester',
    email: 'breachlab-device@synthetic.mil',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    kyc_status: 'VERIFIED' as const,
    did: `did:securemax:synthetic:device:${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  deviceStore.users.set(deviceTesterUser.id, deviceTesterUser);

  // 5. Enrolled Synthetic Device
  const testDevice = {
    id: `${FIXTURE_PREFIX}dev_terminal_${Date.now()}`,
    user_id: deviceTesterUser.id,
    device_name: 'BreachLab Synthetic Test Terminal',
    public_key: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbreachlabtestkey1234567890abcdef',
    algorithm: 'ECDSA_P256' as const,
    status: 'ACTIVE' as const,
    is_admin_device: false,
    created_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    device_type: 'laptop',
    os: 'Synthetic OS 1.0',
    browser: 'BreachLab Test Runner',
    credential_id: `cred_${Date.now()}`,
    credential_type: 'ECDSA_P256',
    registered_at: new Date().toISOString(),
    last_authenticated_at: new Date().toISOString(),
    risk_state: 'TRUSTED' as const,
    registration_region: 'BreachLab Sandbox',
    timeline: [],
  };
  deviceStore.devices.set(testDevice.id, testDevice as any);

  // 6. Synthetic Asset Alpha (TOP SECRET DEFENSE INTEL)
  const syntheticAssetAlpha = deviceStore.createAsset({
    name: 'BreachLab_Intel_Alpha.pdf',
    folder: 'Projects',
    classification: 'CONFIDENTIAL',
    description: 'BreachLab synthetic test document Alpha',
    plaintext: 'TOP SECRET // BREACHLAB SYNTHETIC INTEL ALPHA // CLASSIFIED TEST PAYLOAD',
    ownerId: tempAuthorizedUser.id,
    ownerName: tempAuthorizedUser.name,
    shareScope: 'PRIVATE',
  });

  // 7. Synthetic Asset Beta (for cross-asset substitution test)
  const syntheticAssetBeta = deviceStore.createAsset({
    name: 'BreachLab_Intel_Beta.pdf',
    folder: 'Projects',
    classification: 'RESTRICTED',
    description: 'BreachLab synthetic test document Beta',
    plaintext: 'RESTRICTED // BREACHLAB SYNTHETIC INTEL BETA // SECOND CONTEXT PAYLOAD',
    ownerId: tempAuthorizedUser.id,
    ownerName: tempAuthorizedUser.name,
    shareScope: 'PRIVATE',
  });

  // Register session for device tester
  deviceStore.sessions.set(sessionLegitId, {
    session_id: sessionLegitId,
    user_id: deviceTesterUser.id,
    user_name: deviceTesterUser.name,
    user_email: deviceTesterUser.email,
    device_id: testDevice.id,
    device_name: testDevice.device_name,
    position: 'Standard User',
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    authentication_level: 'P256',
    status: 'ACTIVE',
  });

  return {
    attackerUser,
    tempAuthorizedUser,
    standardUser,
    deviceTesterUser,
    syntheticAssetAlpha,
    syntheticAssetBeta,
    testDevice,
    sessionLegitId,
    sessionAdversaryId,
  };
}

/**
 * Idempotently cleans up synthetic test fixtures after execution.
 * Guaranteed never to delete production or demo user assets.
 */
export async function cleanupBreachLabFixtures(fixtures?: Partial<BreachLabFixtures>): Promise<{ cleanedAssets: number; cleanedUsers: number; cleanedDevices: number; cleanedSessions: number }> {
  let cleanedAssets = 0;
  let cleanedUsers = 0;
  let cleanedDevices = 0;
  let cleanedSessions = 0;

  // Clean assets created during test
  if (fixtures?.syntheticAssetAlpha?.id) {
    deviceStore.assets.delete(fixtures.syntheticAssetAlpha.id);
    deviceStore.wrappedDEKs.delete(fixtures.syntheticAssetAlpha.id);
    cleanedAssets++;
  }
  if (fixtures?.syntheticAssetBeta?.id) {
    deviceStore.assets.delete(fixtures.syntheticAssetBeta.id);
    deviceStore.wrappedDEKs.delete(fixtures.syntheticAssetBeta.id);
    cleanedAssets++;
  }

  // Sweep any remaining synthetic assets by prefix
  for (const [id, asset] of Array.from(deviceStore.assets.entries())) {
    if (asset.name?.includes('BreachLab_') || id.startsWith(FIXTURE_PREFIX)) {
      deviceStore.assets.delete(id);
      deviceStore.wrappedDEKs.delete(id);
      cleanedAssets++;
    }
  }

  // Clean users
  const userIds = [
    fixtures?.attackerUser?.id,
    fixtures?.tempAuthorizedUser?.id,
    fixtures?.standardUser?.id,
    fixtures?.deviceTesterUser?.id,
  ].filter(Boolean) as string[];

  for (const uid of userIds) {
    deviceStore.users.delete(uid);
    cleanedUsers++;
  }

  // Sweep any remaining synthetic users by prefix
  for (const [id, user] of Array.from(deviceStore.users.entries())) {
    if (id.startsWith(FIXTURE_PREFIX) || user.email?.includes('breachlab-')) {
      deviceStore.users.delete(id);
      cleanedUsers++;
    }
  }

  // Clean devices
  if (fixtures?.testDevice?.id) {
    deviceStore.devices.delete(fixtures.testDevice.id);
    cleanedDevices++;
  }
  for (const [id, dev] of Array.from(deviceStore.devices.entries())) {
    if (id.startsWith(FIXTURE_PREFIX) || dev.device_name?.includes('BreachLab')) {
      deviceStore.devices.delete(id);
      cleanedDevices++;
    }
  }

  // Clean sessions
  if (fixtures?.sessionLegitId) {
    deviceStore.sessions.delete(fixtures.sessionLegitId);
    cleanedSessions++;
  }
  if (fixtures?.sessionAdversaryId) {
    deviceStore.sessions.delete(fixtures.sessionAdversaryId);
    cleanedSessions++;
  }
  for (const [id] of Array.from(deviceStore.sessions.entries())) {
    if (id.startsWith(FIXTURE_PREFIX)) {
      deviceStore.sessions.delete(id);
      cleanedSessions++;
    }
  }

  // Clean assignments for test fixtures
  deviceStore.assignments = deviceStore.assignments.filter(
    a => !a.asset_id.startsWith(FIXTURE_PREFIX) && !a.user_id.startsWith(FIXTURE_PREFIX) &&
         a.asset_id !== fixtures?.syntheticAssetAlpha?.id && a.asset_id !== fixtures?.syntheticAssetBeta?.id
  );

  return { cleanedAssets, cleanedUsers, cleanedDevices, cleanedSessions };
}

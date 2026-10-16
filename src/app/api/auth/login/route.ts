import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { verifyP256Signature, verifyChallengeToken } from '@/lib/crypto/p256';
import { deviceStore } from '@/lib/auth/deviceStore';
import { getJwtSecret } from '@/lib/auth/session';
import { UserRole, UserStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      email, 
      adminId, 
      deviceId, 
      deviceName,
      publicKey,
      challengeId, 
      challengeToken, 
      signature, 
      walletAddress, 
      authType,
      region 
    } = body;

    const isMetaMaskAuth = Boolean(walletAddress || authType === 'METAMASK');

    // =========================================================================
    // MODEL A: ORGANIZATION ADMINISTRATOR (METAMASK AUTHENTICATION)
    // =========================================================================
    if (isMetaMaskAuth) {
      const cleanWallet = String(walletAddress || '').trim().toLowerCase();
      if (!cleanWallet || !challengeId || !signature) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Missing required credentials (walletAddress, challengeId, and signature required for Admin authentication)' },
          { status: 400 }
        );
      }

      // 1. Retrieve challenge from persistent store
      const storedChallenge = deviceStore.getChallenge(challengeId);
      if (!storedChallenge) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Authentication challenge expired or invalid. Please request a new challenge.' },
          { status: 400 }
        );
      }

      if (storedChallenge.consumed) {
        await deviceStore.recordAuditEvent({
          eventType: 'TOKEN_REPLAY_ATTEMPT',
          description: `Security Alert: Attempted replay of already consumed challenge ${challengeId} for wallet ${cleanWallet}`,
          severity: 'CRITICAL',
        });
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Challenge has already been consumed (replay attack prevented). Please request a new challenge.' },
          { status: 400 }
        );
      }

      // STRICT NONCE LIFECYCLE: Enforce challengeId matches the HttpOnly cookie when present
      const authNonceCookie = cookies().get('auth_nonce')?.value;
      if (authNonceCookie && authNonceCookie !== challengeId) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Authentication challenge expired or invalid (nonce mismatch). Please request a new challenge.' },
          { status: 400 }
        );
      }
      // Clear the cookie immediately to prevent replay
      cookies().set('auth_nonce', '', { maxAge: 0, path: '/api/auth' });

      if (new Date(storedChallenge.expiresAt).getTime() < Date.now()) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Challenge expired. Please request a new challenge.' },
          { status: 400 }
        );
      }

      // 2. Cryptographic proof of wallet ownership: Recover signer via EIP-191 personal_sign
      let recoveredSigner: string;
      try {
        recoveredSigner = ethers.verifyMessage(storedChallenge.message, signature).toLowerCase();
      } catch (err) {
        await deviceStore.recordAuditEvent({
          eventType: 'ADMIN_LOGIN_FAILURE',
          description: `Admin authentication failed: Malformed cryptographic signature for wallet ${cleanWallet}`,
          severity: 'WARNING',
        });
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Malformed or invalid cryptographic wallet signature.' },
          { status: 401 }
        );
      }

      // Verify recovered signer matches the claimed wallet
      if (recoveredSigner !== cleanWallet) {
        await deviceStore.recordAuditEvent({
          eventType: 'ADMIN_LOGIN_FAILURE',
          description: `Admin authentication failed: Claimed wallet ${cleanWallet} does not match signature signer ${recoveredSigner}`,
          severity: 'CRITICAL',
        });
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Wallet signature mismatch. Cryptographic proof failed.' },
          { status: 401 }
        );
      }

      // 3. Authoritative verification: Must match the registered Organization Admin wallet
      const registeredAdminWallet = deviceStore.getAdminWallet().toLowerCase();
      if (recoveredSigner !== registeredAdminWallet) {
        await deviceStore.recordAuditEvent({
          eventType: 'ADMIN_LOGIN_FAILURE',
          description: `ACCESS DENIED: Unauthorized wallet ${recoveredSigner} attempted Administrator login. Registered admin wallet is ${registeredAdminWallet}`,
          severity: 'CRITICAL',
        });
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'ACCESS DENIED: Wallet address is not authorized as the Organization Administrator.' },
          { status: 403 }
        );
      }

      // 4. Resolve Admin User Record
      const adminUser = await deviceStore.getUserById(deviceStore.systemSettings.root_admin_id || 'usr_admin_001') || 
                        await deviceStore.getUserByEmail('admin@securemax.mil') || 
                        Array.from(deviceStore.users.values()).find(u => u.role === UserRole.ADMIN);

      if (!adminUser) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'System error: Organization Administrator identity record not found. Bootstrap required.' },
          { status: 500 }
        );
      }

      if (adminUser.status !== UserStatus.ACTIVE) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: `Administrator account is ${adminUser.status}. Access prohibited.` },
          { status: 403 }
        );
      }

      if (deviceStore.systemSettings.admin_locked) {
        deviceStore.recordAdminLogin({
          adminId: adminUser.id,
          deviceId: 'metamask_' + recoveredSigner.slice(2, 10),
          success: false,
          reason: 'ADMIN_ACCOUNT_LOCKED',
        });
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'ACCESS DENIED: Administrator account is locked. Emergency recovery ceremony required.' },
          { status: 403 }
        );
      }

      // 5. Atomically consume the challenge
      const consumption = deviceStore.consumeChallenge(challengeId);
      if (!consumption.valid) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: consumption.error || 'Failed to consume challenge' },
          { status: 400 }
        );
      }

      // 6. Establish Secure Admin Session
      const session = await deviceStore.createSession({
        userId: adminUser.id,
        deviceId: 'dev_admin_metamask',
        authLevel: 'METAMASK',
        durationHours: 8,
      });

      deviceStore.recordLogin({
        userId: adminUser.id,
        userName: adminUser.name,
        userEmail: adminUser.email,
        role: UserRole.ADMIN,
        deviceName: `MetaMask (${recoveredSigner.slice(0, 6)}...${recoveredSigner.slice(-4)})`,
        status: 'SUCCESS',
      });

      deviceStore.recordAdminLogin({
        adminId: adminUser.id,
        deviceId: 'dev_admin_metamask',
        success: true,
        region,
      });

      await deviceStore.recordAuditEvent({
        eventType: 'ADMIN_LOGIN_SUCCESS',
        description: `Organization Administrator authenticated successfully via MetaMask (${recoveredSigner})`,
        targetId: session.session_id,
        userEmail: adminUser.email,
        userName: adminUser.name,
        severity: 'INFO',
      });

      // 7. Issue SecureMAX 8-Hour Session Token (LEVEL_3 assurance)
      const jwtSecret = getJwtSecret();
      const sessionToken = await new SignJWT({
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: UserRole.ADMIN,
        did: adminUser.did,
        deviceId: 'dev_admin_metamask',
        deviceName: `MetaMask (${recoveredSigner.slice(0, 6)}...${recoveredSigner.slice(-4)})`,
        walletAddress: recoveredSigner,
        sessionId: session.session_id,
        assuranceLevel: 'LEVEL_3',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(jwtSecret);

      cookies().set('securemesh_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60, // 8 hours
      });

      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
        success: true,
        assuranceLevel: 'LEVEL_3',
        authModel: 'METAMASK',
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: UserRole.ADMIN,
          did: adminUser.did,
          walletAddress: recoveredSigner,
        },
      });
    }

    // =========================================================================
    // MODEL B: NORMAL USERS (ENROLLED P-256 CRYPTOGRAPHIC CREDENTIAL)
    // =========================================================================
    const identifier = String(email || adminId || body.userId || '').trim();

    if (!identifier || (!challengeId && !challengeToken) || !signature) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Missing required credentials (email/userId, challengeId, and cryptographic signature required)' },
        { status: 400 }
      );
    }

    // 1. Retrieve and validate the challenge from persistent store
    let challengeMessage: string | null = null;

    if (challengeId) {
      const storedChallenge = deviceStore.getChallenge(challengeId);
      if (!storedChallenge) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Cryptographic challenge expired or invalid. Please request a new challenge.' },
          { status: 400 }
        );
      }

      if (storedChallenge.consumed) {
        await deviceStore.recordAuditEvent({
          eventType: 'TOKEN_REPLAY_ATTEMPT',
          description: `Security Alert: Attempted replay of challenge ${challengeId} for user ${identifier}`,
          severity: 'CRITICAL',
        });
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Challenge has already been consumed (replay attack prevented). Please request a new challenge.' },
          { status: 400 }
        );
      }

      // STRICT NONCE LIFECYCLE: Enforce challengeId matches the HttpOnly cookie when present
      const authNonceCookie = cookies().get('auth_nonce')?.value;
      if (authNonceCookie && authNonceCookie !== challengeId) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Cryptographic challenge expired or invalid (nonce mismatch). Please request a new challenge.' },
          { status: 400 }
        );
      }
      cookies().set('auth_nonce', '', { maxAge: 0, path: '/api/auth' });

      if (new Date(storedChallenge.expiresAt).getTime() < Date.now()) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Challenge expired. Please request a new challenge.' }, { status: 400 });
      }

      challengeMessage = storedChallenge.message;
    } else if (challengeToken) {
      const tokenVerification = verifyChallengeToken(challengeToken);
      if (tokenVerification.valid && tokenVerification.data) {
        challengeMessage = tokenVerification.data.message;
        if (new Date(tokenVerification.data.expiresAt).getTime() < Date.now()) {
          
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Challenge token expired. Please request a new challenge.' }, { status: 400 });
        }
      }
    }

    if (!challengeMessage) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Cryptographic challenge expired or invalid. Please request a new challenge.' },
        { status: 400 }
      );
    }

    // 2. Resolve User from Authoritative Database
    let foundUser = await deviceStore.getUserByEmailOrId(identifier);
    if (!foundUser) {
      // VERCEL COLD-START MITIGATION: Auto-hydrate user on login if missing from mock DB
      const userId = identifier.includes('@') ? 'usr_' + crypto.randomUUID().slice(0, 8) : identifier;
      const emailStr = identifier.includes('@') ? identifier : 'user@securemax.mil';
      const nameStr = emailStr.split('@')[0];
      const hydratedUser = {
        id: userId,
        email: emailStr,
        name: nameStr,
        role: UserRole.MANAGER, // Defaulting to manager to unblock demo
        status: UserStatus.ACTIVE,
        registeredAt: Date.now(),
        lastLoginAt: Date.now(),
        mfa_enabled: false,
        kyc_verified: true,
        clearance_level: 'CONFIDENTIAL',
        default_policy: 'PRIVATE',
        did: `did:securemax:user:${userId.slice(-6)}`,
      };
      deviceStore.users.set(hydratedUser.id, hydratedUser as any);
      deviceStore.users.set(hydratedUser.email, hydratedUser as any);
      foundUser = hydratedUser as any;
    }

    const user = foundUser!;

    if (user.status !== UserStatus.ACTIVE) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: `User account is ${user.status}. Access prohibited.` }, { status: 403 });
    }

    // 3. Resolve Device & Enforce Enrollment Binding
    const userDevices = deviceStore.getDevicesForUser(user.id);
    let device = null;

    if (user.role === UserRole.ADMIN) {
      let adminDev = userDevices.find(d => d.is_admin_device && d.status === 'ACTIVE') || userDevices.find(d => d.is_admin_device);
      const bodyPublicKey = body.publicKey || (body.deviceInfo && body.deviceInfo.publicKeySpki);

      // Check single-device policy: only the primary admin workstation device is allowed
      if (deviceId && adminDev && deviceId !== adminDev.id && deviceId !== adminDev.device_id) {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Non-primary device attempted administrative login. Access denied.' },
          { status: 403 }
        );
      }

      if (body.publicKey || deviceId === 'dev_admin_primary' || (deviceId && deviceId === adminDev?.id)) {
        if (!adminDev) {
          adminDev = await deviceStore.registerDevice({
            userId: user.id,
            deviceName: deviceName || 'Admin Workstation (Hardware-Bound Terminal)',
            publicKey: bodyPublicKey || 'admin_terminal_key',
            isAdminDevice: true,
            customDeviceId: 'dev_admin_primary',
          });
        } else if (bodyPublicKey && (adminDev.public_key === 'admin_terminal_key' || !adminDev.public_key)) {
          // Initial anchor of physical browser hardware key to the Admin workstation placeholder
          adminDev.public_key = bodyPublicKey;
          if (deviceName) adminDev.device_name = deviceName;
          adminDev.last_authenticated_at = new Date().toISOString();
          deviceStore.devices.set(adminDev.id, adminDev);
          const passport = deviceStore.devicePassports.get(adminDev.id);
          if (passport) {
            passport.public_key = bodyPublicKey;
            if (deviceName) passport.device_name = deviceName;
            passport.last_authenticated_at = new Date().toISOString();
            deviceStore.devicePassports.set(adminDev.id, passport);
          }
          deviceStore.saveToDisk();
        }

        device = adminDev;
      } else {
        
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
          { error: 'Organization Administrator must authenticate using MetaMask wallet signature.' },
          { status: 403 }
        );
      }
    } else {
      // Non-Admin: Multi-device support (lookup pre-enrolled device)
      if (deviceId) {
        device = userDevices.find(d => d.id === deviceId || (d as any).device_id === deviceId) || null;
      } else if (userDevices.length === 1 && userDevices[0].status === 'ACTIVE') {
        device = userDevices[0];
      }

      if (!device) {
        if (deviceStore?.lastSyncPromise) {
          await deviceStore.lastSyncPromise;
        }
        return NextResponse.json(
          { error: 'Device not enrolled. Please complete device enrollment using an authorized code.' },
          { status: 403 }
        );
      }
    }

    if (device.status !== 'ACTIVE') {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: `This device credential has been ${device.status}. Please contact administrator.` },
        { status: 403 }
      );
    }

    // 4. Verify Cryptographic P-256 Signature using STORED public key only
    const isValidSignature = await verifyP256Signature(
      device.public_key,
      challengeMessage,
      signature
    );

    if (!isValidSignature) {
      if (challengeId) {
        deviceStore.consumeChallenge(challengeId);
      }
      await deviceStore.recordAuditEvent({
        eventType: 'USER_LOGIN_FAILURE',
        description: `Cryptographic signature verification failed for user ${user.email} on device ${device.id}`,
        targetId: device.id,
        userEmail: user.email,
        userName: user.name,
        severity: 'WARNING',
      });
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Cryptographic signature verification failed. Private key mismatch.' },
        { status: 401 }
      );
    }

    // 5. Atomically consume challenge
    if (challengeId) {
      deviceStore.consumeChallenge(challengeId);
    }

    // 6. Establish Stateful Zero-Trust Session
    const session = await deviceStore.createSession({
      userId: user.id,
      deviceId: device.id,
      authLevel: 'P256',
      durationHours: 8,
    });

    deviceStore.updateDeviceLastUsed(device.id);
    deviceStore.recordLogin({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      deviceName: device.device_name,
      status: 'SUCCESS',
    });

    await deviceStore.recordAuditEvent({
      eventType: 'USER_LOGIN_SUCCESS',
      description: `Zero-trust authentication successful for ${user.name} (${user.role}) via ${device.device_name}`,
      targetId: session.session_id,
      userEmail: user.email,
      userName: user.name,
      severity: 'INFO',
    });

    // 7. Issue SecureMAX 8-Hour Session Token
    const jwtSecret = getJwtSecret();
    const assuranceLevel = user.role === UserRole.ADMIN ? 'LEVEL_3' : 'LEVEL_2';
    const sessionToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      did: user.did,
      deviceId: device.id,
      deviceName: device.device_name,
      sessionId: session.session_id,
      assuranceLevel,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(jwtSecret);

    cookies().set('securemesh_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      assuranceLevel,
      authModel: 'P256',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        did: user.did,
        device: {
          id: device.id,
          name: device.device_name,
          isAdminDevice: device.is_admin_device,
        },
      },
    });
  } catch (error) {
    console.error('[Login API Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Internal authentication server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getVerifiedSession } from '@/lib/auth/session';
import { deviceStore } from '@/lib/auth/deviceStore';
import { UserRole, UserStatus } from '@/types';

export async function POST(req: Request) {
  
  
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    const body = await req.json().catch(() => ({}));
    const { 
      targetUserId, 
      positionId, 
      durationMinutes, 
      maxDevices, 
      targetDeviceType,
      isNewUser,
      newUserName,
      newUserEmail
    } = body;

    let enrollForUserId = session.userId;

    if (session.role === UserRole.ADMIN) {
      if (isNewUser || targetUserId === '__NEW_USER__') {
        if (!newUserName || !newUserEmail) {
          
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
            { error: 'Please provide both Full Name and Email Address for the new user.' },
            { status: 400 }
          );
        }

        const cleanEmail = String(newUserEmail).toLowerCase().trim();
        const existing = await deviceStore.getUserByEmail(cleanEmail);
        
        if (existing) {
          enrollForUserId = existing.id;
        } else {
          const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
          const did = `did:securemax:user:${userId.slice(-6)}`;
          let role = UserRole.USER;
          const pos = positionId ? deviceStore.getPositionById(positionId) : null;
          if (pos?.name?.toLowerCase().includes('manager') || pos?.privilege_level === 'ELEVATED') {
            role = UserRole.MANAGER;
          } else if (pos?.name?.toLowerCase().includes('auditor')) {
            role = UserRole.AUDITOR;
          }

          const newUser = {
            id: userId,
            name: String(newUserName).trim(),
            email: cleanEmail,
            role,
            position_id: positionId || 'pos_user',
            position: pos?.name || 'User',
            kyc_status: 'PENDING' as const,
            status: UserStatus.ACTIVE,
            did,
            created_at: new Date().toISOString(),
          };

          deviceStore.users.set(newUser.id, newUser);
          deviceStore.users.set(newUser.email, newUser);
          deviceStore.saveToDisk();
          enrollForUserId = newUser.id;

          await deviceStore.recordAuditEvent({
            eventType: 'USER_IDENTITY_REGISTERED',
            description: `Admin initiated onboarding for new user: ${newUser.name} (${newUser.position}) - ${newUser.email}`,
            targetId: newUser.id,
            userEmail: newUser.email,
            userName: newUser.name,
            severity: 'INFO',
          });
        }
      } else {
        if (!targetUserId) {
          
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
            { error: 'Admin account is strictly hardware-bound. To enroll a device, select an authorized team member or onboard a new user.' },
            { status: 400 }
          );
        }
        enrollForUserId = targetUserId;
      }
    }

    const targetUser = await deviceStore.getUserById(enrollForUserId);
    if (!targetUser) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Target user record not found' }, { status: 404 });
    }

    if (targetUser.role === UserRole.ADMIN) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json(
        { error: 'Root administrator accounts are strictly single-device hardware-bound. To onboard a team member, choose "Onboard New User". To authorize a new admin terminal, initiate an Administrator Recovery Ceremony.' },
        { status: 403 }
      );
    }

    const { enrollment, plaintextCode } = deviceStore.createEnrollmentCapability({
      userId: targetUser.id,
      positionId,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 15,
      maxDevices: maxDevices ? Number(maxDevices) : 1,
      callerUserId: session.userId,
      callerRole: session.role,
      targetDeviceType,
    });

    const origin = req.headers.get('origin') || 'https://securemax.app';
    const enrollmentUrl = `${origin}/register-device?code=${plaintextCode}`;

    const qrPayload = JSON.stringify({
      app: 'SecureMAX',
      action: 'enroll_device',
      code: plaintextCode,
      url: enrollmentUrl,
      userId: targetUser.id,
      userEmail: targetUser.email,
      position: enrollment.position_name,
      expiresAt: enrollment.expires_at,
    });

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      enrollment: {
        code: plaintextCode,
        expiresAt: enrollment.expires_at,
        qrPayload,
        enrollmentUrl,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        positionName: enrollment.position_name,
        durationMinutes: enrollment.duration_minutes,
      },
    });
  } catch (error: any) {
    console.error('[Enrollment Start Error]:', error);
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Unauthorized or failed to initiate enrollment' }, { status: 400 });
  }
}

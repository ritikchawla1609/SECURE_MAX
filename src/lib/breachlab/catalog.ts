import { SeverityLevel } from '@/types';
import { ScenarioCategory, ScenarioDefinition } from './types';

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    id: 'SCN-AUTH-01',
    scenarioNumber: 1,
    title: 'Unauthorized Asset Access Attempt',
    version: '1.0.0',
    category: ScenarioCategory.ACCESS_CONTROL,
    severity: SeverityLevel.CRITICAL,
    cweId: 'CWE-285',
    threatModel:
      'An authenticated adversary without asset assignment queries the asset decryption API or KMS orchestration boundary using crafted parameters, attempting to release protected ciphertext without authorization.',
    description:
      'Determines whether a user lacking the required asset assignment can retrieve or decrypt a protected document through backend enforcement.',
    preconditions: [
      'Synthetic attacker identity created with zero asset clearances',
      'Synthetic encrypted asset registered with isolated KMS DEK',
      'Active session established for attacker',
    ],
    requiredFixtures: ['usr_breach_attacker', 'ast_breach_alpha'],
    steps: [
      'Construct authorization request for synthetic asset using synthetic attacker identity',
      'Execute actual backend authorization gate (authorizeAssetAccess)',
      'Inspect HTTP response status, error code, and audit event logs',
      'Verify that no temporary decryption token is issued and no plaintext buffer is exposed',
    ],
    expectedSecurityBehavior:
      'The authorization request is denied with an explicit Access Denied policy error; no temporary decryption token is generated, and a security audit event is recorded.',
    safetyConstraints: [
      'Execution restricted to disposable test identities',
      'Never requests production assets or real user documents',
    ],
    remediationGuidance:
      'Enforce strict server-side RBAC and assignment verification before calling KMS envelope key release. Never trust client assertions.',
  },
  {
    id: 'SCN-AUTH-02',
    scenarioNumber: 2,
    title: 'Revoked Authorization Reuse',
    version: '1.0.0',
    category: ScenarioCategory.ACCESS_CONTROL,
    severity: SeverityLevel.HIGH,
    cweId: 'CWE-613',
    threatModel:
      'A user previously granted clearance has their assignment revoked by an administrator, but attempts to reuse their existing session to authorize and decrypt the asset.',
    description:
      'Verifies that an authorization revoked after an earlier approval cannot be reused and that stale permissions are not silently honored.',
    preconditions: [
      'Synthetic user granted active assignment to synthetic asset',
      'Verified decryption capability while active',
      'Administrator revokes clearance via revokeAssetAccess',
    ],
    requiredFixtures: ['usr_breach_temp_authorized', 'ast_breach_alpha'],
    steps: [
      'Grant clearance to synthetic user and verify valid access',
      'Invoke administrative revokeAssetAccess to set assignment status to REVOKED',
      'Attempt subsequent authorizeAssetAccess using the existing active session',
      'Verify immediate access denial and absence of token issuance',
    ],
    expectedSecurityBehavior:
      'Subsequent authorization attempt is denied immediately upon revocation; store and database state reflects REVOKED status.',
    safetyConstraints: [
      'Revocation affects only synthetic test assignment',
      'Disposable assignment destroyed during cleanup',
    ],
    remediationGuidance:
      'Invalidate active authorization grants on permission change and ensure zero-trust checks re-validate live assignment status on every request.',
  },
  {
    id: 'SCN-KMS-03',
    scenarioNumber: 3,
    title: 'Expired or Replayed Decryption Authorization',
    version: '1.0.0',
    category: ScenarioCategory.KEY_MANAGEMENT,
    severity: SeverityLevel.CRITICAL,
    cweId: 'CWE-294',
    threatModel:
      'An adversary intercepts a legitimate temporary decryption token and attempts to replay it either after its 30-minute validity window expires or from a hijacked session / IP context.',
    description:
      'Verifies that expired, invalid, or replayed authorization tokens cannot release a protected DEK or allow decryption.',
    preconditions: [
      'Legitimate temporary decryption token issued with cryptographic session and IP binding',
      'Synthetic expired token generated with past timestamp',
    ],
    requiredFixtures: ['ast_breach_alpha', 'sess_breach_legit', 'sess_breach_hijacked'],
    steps: [
      'Generate a synthetic expired JWT decryption token (expired 30 minutes ago)',
      'Attempt token validation against KMS boundary (validateTemporaryDecryptionToken)',
      'Generate a valid token for Session A, then attempt validation against Session B (session hijacking replay)',
      'Verify both attempts throw cryptographic validation errors without releasing DEK',
    ],
    expectedSecurityBehavior:
      'Both expired tokens and session-mismatched replay attempts are rejected by the KMS boundary; secrets are never logged in evidence.',
    safetyConstraints: [
      'Tokens are cryptographically generated in-memory with test secrets',
      'No production keys or tokens utilized',
    ],
    remediationGuidance:
      'Cryptographically bind temporary decryption tokens to both user session and client IP address; enforce strict expiration (TTL <= 30m).',
  },
  {
    id: 'SCN-CRYP-04',
    scenarioNumber: 4,
    title: 'AES-256-GCM Ciphertext & Tag Tampering',
    version: '1.0.0',
    category: ScenarioCategory.CRYPTOGRAPHY,
    severity: SeverityLevel.CRITICAL,
    cweId: 'CWE-353',
    threatModel:
      'An active adversary in the storage pipeline flips bits in the stored ciphertext or modifies the authentication tag, attempting to forge data or trigger unauthenticated decryption.',
    description:
      'Verifies the cryptographic integrity guarantees of AES-256-GCM and ensures that corrupted data cannot be decrypted.',
    preconditions: [
      'Synthetic plaintext encrypted with freshly generated DEK using AES-256-GCM and bound AAD',
    ],
    requiredFixtures: ['ast_breach_crypto_fixture'],
    steps: [
      'Encrypt synthetic plaintext "TOP SECRET // BREACHLAB SYNTHETIC INTEL" with 256-bit DEK',
      'Independently flip bits in the ciphertext byte payload and attempt decryption',
      'In a second sub-test, tamper with the 128-bit authentication tag and attempt decryption',
      'Verify that decipher.final() throws an integrity failure in both cases and no plaintext is returned',
    ],
    expectedSecurityBehavior:
      'Decryption fails closed with an integrity exception for both ciphertext and auth-tag tampering; zero bytes of plaintext are released.',
    safetyConstraints: [
      'Crypto operations use ephemeral random keys generated strictly in memory',
    ],
    remediationGuidance:
      'Maintain AES-256-GCM with full 128-bit authentication tags and authenticated data (AAD) binding to prevent bit-flipping attacks.',
  },
  {
    id: 'SCN-CRYP-05',
    scenarioNumber: 5,
    title: 'Cross-Asset & Cross-Tenant Key Substitution',
    version: '1.0.0',
    category: ScenarioCategory.KEY_MANAGEMENT,
    severity: SeverityLevel.CRITICAL,
    cweId: 'CWE-326',
    threatModel:
      'An adversary with legitimate access to Asset A attempts to substitute Asset A\'s wrapped DEK or token into an operation on Asset B, hoping the system reuses or unwraps the key across contexts.',
    description:
      'Verifies that wrapped DEKs and temporary tokens cannot be substituted across unrelated assets or tenants due to strict AAD binding.',
    preconditions: [
      'Synthetic Asset A and Asset B generated with distinct asset IDs and unique KEK derivations',
      'DEK for Asset A wrapped with AAD="key_wrapping:asset_A"',
    ],
    requiredFixtures: ['ast_breach_alpha', 'ast_breach_beta'],
    steps: [
      'Derive KEK for Asset A and wrap DEK A with AAD bound to Asset A',
      'Attempt to unwrap DEK A using the KEK derived for Asset B (or AAD for Asset B)',
      'Attempt to use Asset A\'s temporary decryption token against Asset B in validateTemporaryDecryptionToken',
      'Verify that AAD binding check fails and asset mismatch is rejected',
    ],
    expectedSecurityBehavior:
      'Cross-asset key unwrapping fails due to AAD mismatch; token validation rejects asset ID discrepancy.',
    safetyConstraints: [
      'Ephemeral test assets only',
    ],
    remediationGuidance:
      'Bind all envelope key wrapping and token payloads to explicit asset identifiers via AES-GCM Additional Authenticated Data (AAD).',
  },
  {
    id: 'SCN-BC-06',
    scenarioNumber: 6,
    title: 'Blockchain RPC Failure & Contract Rejection (Fail-Closed)',
    version: '1.0.0',
    category: ScenarioCategory.BLOCKCHAIN,
    severity: SeverityLevel.HIGH,
    cweId: 'CWE-755',
    threatModel:
      'The blockchain RPC endpoint becomes unavailable, times out, or the on-chain access contract reverts. An adversary attempts to exploit the infrastructure outage to gain implicit authorization.',
    description:
      'Verifies fail-closed behavior when blockchain verification cannot be completed due to network timeout or contract revert.',
    preconditions: [
      'Oracle client configured with fail-closed policy enforcement',
    ],
    requiredFixtures: ['ast_breach_alpha'],
    steps: [
      'Simulate an unavailable / timed-out RPC endpoint for Chain-1 AssetRegistry',
      'Verify verifyChain1Access returns allowed=false with status=UNAVAILABLE',
      'Simulate a contract revert / empty response for Chain-2 KeyLifecycle',
      'Verify verifyChain2Policy returns allowed=false with status=UNAVAILABLE / DENIED',
      'Verify authorizeAssetAccess rejects with explicit blockchain denial error',
    ],
    expectedSecurityBehavior:
      'All failed or timed-out blockchain verifications fail closed; no authorization is granted and no success is fabricated.',
    safetyConstraints: [
      'Simulated against isolated oracle adapter without sending live transactions',
    ],
    remediationGuidance:
      'Never implement fail-open fallbacks in blockchain authorization oracles. Maintain fail-closed invariants for all external verifications.',
  },
  {
    id: 'SCN-AUD-07',
    scenarioNumber: 7,
    title: 'Audit-Chain Tampering Detection',
    version: '1.0.0',
    category: ScenarioCategory.AUDIT_INTEGRITY,
    severity: SeverityLevel.HIGH,
    cweId: 'CWE-354',
    threatModel:
      'An insider or compromised service attempts to alter an historical audit record or delete an incident from the log store to conceal unauthorized activity.',
    description:
      'Verifies whether the audit subsystem detects modification of a stored record via cryptographic hash-chaining and Merkle root verification.',
    preconditions: [
      'Synthetic sequence of 5 audit events generated with SHA-256 hash linkage (prev_hash -> event_hash)',
    ],
    requiredFixtures: ['audit_breach_chain_fixture'],
    steps: [
      'Generate sequential hash-chained audit events [E1, E2, E3, E4, E5]',
      'Verify original chain integrity (all prev_hash and event_hash values match)',
      'Calculate original Merkle root',
      'Mutate details in record E3 without updating the rest of the chain',
      'Re-verify chain linkage and re-calculate Merkle root',
      'Verify broken link detected at index 3 and Merkle root mismatch confirmed',
    ],
    expectedSecurityBehavior:
      'The altered record causes a cryptographic linkage failure; the Merkle root mismatch proves tampering.',
    safetyConstraints: [
      'Fixture chain operates strictly on temporary in-memory structures',
    ],
    remediationGuidance:
      'Anchor audit log Merkle roots to an immutable public blockchain ledger (Chain-1 AuditAnchor) to guarantee tamper evidence.',
  },
  {
    id: 'SCN-DEV-08',
    scenarioNumber: 8,
    title: 'Device & Session Trust Policy Violation',
    version: '1.0.0',
    category: ScenarioCategory.DEVICE_TRUST,
    severity: SeverityLevel.HIGH,
    cweId: 'CWE-287',
    threatModel:
      'An attacker obtains a valid session cookie but presents a revoked device credential, or attempts access after the administrator has marked the device as SUSPENDED or REVOKED.',
    description:
      'Verifies that protected operations enforce live zero-trust device status and session validity policies.',
    preconditions: [
      'Synthetic user with enrolled test device and active session',
    ],
    requiredFixtures: ['usr_breach_device_tester', 'dev_breach_terminal'],
    steps: [
      'Verify successful authorization when device status is ACTIVE',
      'Suspend the synthetic device via deviceStore (status=SUSPENDED)',
      'Attempt authorizeAssetAccess with the suspended device ID',
      'Verify access is denied with "Device credential is invalid or revoked"',
      'Revoke the active session (status=REVOKED) and verify getVerifiedSession rejects immediately',
    ],
    expectedSecurityBehavior:
      'Suspended/revoked devices and revoked sessions are immediately blocked by the server-side zero-trust guard.',
    safetyConstraints: [
      'Synthetic device registered solely in test scope',
    ],
    remediationGuidance:
      'Re-validate device status and session revocation in real time on every protected API call rather than trusting static JWT claims.',
  },
  {
    id: 'SCN-STO-09',
    scenarioNumber: 9,
    title: 'Upload & Storage Failure Consistency Rollback',
    version: '1.0.0',
    category: ScenarioCategory.STORAGE_INTEGRITY,
    severity: SeverityLevel.MEDIUM,
    cweId: 'CWE-703',
    threatModel:
      'A network partition or cloud storage failure occurs mid-upload after metadata has been allocated, potentially leaving orphaned database rows or reporting partial success.',
    description:
      'Verifies consistency between encrypted file storage, database metadata, wrapped keys, and asset registration when an upload fails.',
    preconditions: [
      'Upload handler configured with atomic rollback support',
    ],
    requiredFixtures: ['ast_breach_partial_upload'],
    steps: [
      'Simulate an upload operation where binary storage throws a connection failure',
      'Verify upload endpoint does NOT report success (returns 502/error)',
      'Inspect store/DB state to ensure incomplete asset was rolled back',
      'Verify zero orphaned unencrypted temp files remain',
    ],
    expectedSecurityBehavior:
      'The application reports upload failure; incomplete records are rolled back cleanly and no orphaned unencrypted data persists.',
    safetyConstraints: [
      'Simulated in disposable upload test scope',
    ],
    remediationGuidance:
      'Execute asset uploads inside atomic transactions or two-phase commit with rollback handlers on storage error.',
  },
  {
    id: 'SCN-RBAC-10',
    scenarioNumber: 10,
    title: 'Role & Privilege Escalation Enforcement',
    version: '1.0.0',
    category: ScenarioCategory.PRIVILEGE_ESCALATION,
    severity: SeverityLevel.CRITICAL,
    cweId: 'CWE-269',
    threatModel:
      'A regular USER attempts to invoke administrative endpoints (such as emergency panic lock, role modifications, or security scan triggers) by tampering with request payloads.',
    description:
      'Verifies that server-side permissions determine authorization and that unprivileged roles cannot execute administrative operations.',
    preconditions: [
      'Synthetic user with standard USER role',
    ],
    requiredFixtures: ['usr_breach_standard_user'],
    steps: [
      'Craft request to /api/admin/panic from standard USER context',
      'Verify server returns HTTP 403 Forbidden with "Unauthorized: Admin access required"',
      'Craft request to runSecurityScanAction from standard USER context',
      'Verify action rejects with "Forbidden: Insufficient privileges"',
      'Attempt to tamper with client role headers and verify server-side session authority takes precedence',
    ],
    expectedSecurityBehavior:
      'All privileged operations are rejected for non-admin identities; server resolves role authoritatively from session state.',
    safetyConstraints: [
      'Exercises API and action validation paths without modifying live admin accounts',
    ],
    remediationGuidance:
      'Always verify roles server-side using cryptographic session validation. Never trust client-supplied role parameters.',
  },
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_CATALOG.find((s) => s.id === id);
}

export function getScenariosByCategory(category: ScenarioCategory): ScenarioDefinition[] {
  return SCENARIO_CATALOG.filter((s) => s.category === category);
}

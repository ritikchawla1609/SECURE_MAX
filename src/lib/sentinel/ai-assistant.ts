import 'server-only';
import { SentinelFinding } from './types';

/**
 * Sentinel AI Assistant
 * 
 * ARCHITECTURAL CONSTRAINT:
 * The AI is strictly limited to explaining and summarizing existing deterministic findings.
 * It NEVER receives private keys, raw encryption keys, or KMS secrets.
 * It NEVER controls execution flows or bypasses deterministic rules.
 */

export async function explainFinding(finding: SentinelFinding): Promise<string> {
  // In a full implementation, this would call an LLM API (e.g. Google Vertex AI)
  // with a prompt constrained to explanation-only using the finding data.
  // We mock the AI response generation here for the prototype without network dependencies.
  
  const explanation = `
    AI Analysis of ${finding.attackType}:
    
    The deterministic Sentinel engine detected a ${finding.severity} vulnerability in the ${finding.component} module.
    
    Evidence: ${finding.evidence}
    Impact: ${finding.impact}
    
    Remediation Recommendation: 
    ${finding.remediation}. Ensure that cryptographic bindings and database RLS rules perfectly synchronize with Blockchain-1 state.
  `;
  
  return explanation;
}

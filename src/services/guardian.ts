import { Connection, PublicKey } from '@solana/web3.js';
import { getTransactions } from './storage';
import { SkrTier } from './skr';

export type RiskLevel = 'green' | 'yellow' | 'red';

export type GuardianStep = {
  check: string;
  result: string;
  passed: boolean;
};

export type GuardianVerdict = {
  risk: RiskLevel;
  score: number;        // 0-100
  steps: GuardianStep[];
  summary: string;
  autoApprove: boolean; // green + Gold tier
};

export async function assessRecipient(
  connection: Connection,
  recipient: string,
  amount: number,
  sender: string,
  skrTier: SkrTier,
): Promise<GuardianVerdict> {
  const steps: GuardianStep[] = [];
  const weights = { exists: 25, history: 25, age: 20, known: 15, anomaly: 15 };
  let weightedScore = 0;

  // 1. Account exists
  try {
    const info = await connection.getAccountInfo(new PublicKey(recipient));
    if (info) {
      steps.push({ check: 'Account exists', result: 'Active on-chain', passed: true });
      weightedScore += weights.exists;
    } else {
      steps.push({ check: 'Account exists', result: 'Account not found', passed: false });
    }
  } catch {
    steps.push({ check: 'Account exists', result: 'Failed to check', passed: false });
  }

  // 2. Transaction history
  let txCount = 0;
  let firstSigTime: number | null = null;
  try {
    const sigs = await connection.getSignaturesForAddress(new PublicKey(recipient), { limit: 20 });
    txCount = sigs.length;
    if (sigs.length > 0) {
      firstSigTime = sigs[sigs.length - 1].blockTime ?? null;
    }
    if (txCount >= 10) {
      steps.push({ check: 'Transaction history', result: `${txCount} transactions`, passed: true });
      weightedScore += weights.history;
    } else if (txCount > 0) {
      steps.push({ check: 'Transaction history', result: `Only ${txCount} transactions`, passed: true });
      weightedScore += weights.history * 0.5;
    } else {
      steps.push({ check: 'Transaction history', result: 'No transactions', passed: false });
    }
  } catch {
    steps.push({ check: 'Transaction history', result: 'Failed to fetch', passed: false });
  }

  // 3. Account age
  if (firstSigTime) {
    const ageDays = (Date.now() / 1000 - firstSigTime) / 86400;
    if (ageDays > 7) {
      steps.push({ check: 'Account age', result: `${Math.floor(ageDays)} days old`, passed: true });
      weightedScore += weights.age;
    } else if (ageDays >= 1) {
      steps.push({ check: 'Account age', result: `${Math.floor(ageDays)} days old`, passed: true });
      weightedScore += weights.age * 0.5;
    } else {
      steps.push({ check: 'Account age', result: 'Less than 1 day old', passed: false });
    }
  } else {
    steps.push({ check: 'Account age', result: 'Unknown', passed: false });
  }

  // 4. Known recipient (from stored transaction history)
  try {
    const storedTxs = await getTransactions();
    const priorPayments = storedTxs.filter(tx => tx.recipient === recipient);
    if (priorPayments.length > 0) {
      steps.push({ check: 'Known recipient', result: `Paid ${priorPayments.length} time${priorPayments.length > 1 ? 's' : ''} before`, passed: true });
      weightedScore += weights.known;
    } else {
      steps.push({ check: 'Known recipient', result: 'First-time recipient', passed: false });
    }
  } catch {
    steps.push({ check: 'Known recipient', result: 'Could not check', passed: false });
  }

  // 5. Amount anomaly
  try {
    const storedTxs = await getTransactions();
    const sentTxs = storedTxs.filter(tx => tx.type === 'sent' && tx.amount > 0);
    if (sentTxs.length >= 3) {
      const avg = sentTxs.reduce((s, t) => s + t.amount, 0) / sentTxs.length;
      if (amount <= avg * 3) {
        steps.push({ check: 'Amount check', result: `$${amount.toFixed(2)} is normal`, passed: true });
        weightedScore += weights.anomaly;
      } else {
        steps.push({ check: 'Amount check', result: `$${amount.toFixed(2)} is ${(amount / avg).toFixed(1)}x your average`, passed: false });
      }
    } else {
      steps.push({ check: 'Amount check', result: 'Not enough history', passed: true });
      weightedScore += weights.anomaly * 0.5;
    }
  } catch {
    steps.push({ check: 'Amount check', result: 'Could not check', passed: true });
    weightedScore += weights.anomaly * 0.5;
  }

  // Normalize score
  const score = Math.round(weightedScore);

  // Tier-based auto-approve thresholds
  const autoApproveThreshold: Record<SkrTier, number | null> = {
    Gold: 40,    // green + yellow
    Silver: 70,  // green only
    Bronze: 80,  // green only, stricter
    Ghost: null, // never auto-approve
  };
  const threshold = autoApproveThreshold[skrTier];
  const autoApprove = threshold !== null && score >= threshold;

  const risk: RiskLevel = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

  const summaries: Record<RiskLevel, string> = {
    green: 'Recipient looks safe',
    yellow: 'Proceed with caution',
    red: 'High risk — verify recipient',
  };

  return {
    risk,
    score,
    steps,
    summary: autoApprove ? `${skrTier} Tier — Auto-approved` : summaries[risk],
    autoApprove,
  };
}

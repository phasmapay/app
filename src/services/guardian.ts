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

  // Parallelize all independent data fetching
  const recipientPk = new PublicKey(recipient);
  const [accountInfo, sigs, storedTxs] = await Promise.all([
    connection.getAccountInfo(recipientPk).catch(() => null),
    connection.getSignaturesForAddress(recipientPk, { limit: 20 }).catch(() => [] as any[]),
    getTransactions().catch(() => []),
  ]);

  // 1. Account exists
  if (accountInfo) {
    steps.push({ check: 'Account exists', result: 'Active on-chain', passed: true });
    weightedScore += weights.exists;
  } else {
    steps.push({ check: 'Account exists', result: 'Account not found', passed: false });
  }

  // 2. Transaction history
  const txCount = sigs.length;
  const firstSigTime = sigs.length > 0 ? (sigs[sigs.length - 1].blockTime ?? null) : null;
  if (txCount >= 10) {
    steps.push({ check: 'Transaction history', result: `${txCount} transactions`, passed: true });
    weightedScore += weights.history;
  } else if (txCount > 0) {
    steps.push({ check: 'Transaction history', result: `Only ${txCount} transactions`, passed: true });
    weightedScore += weights.history * 0.5;
  } else {
    steps.push({ check: 'Transaction history', result: 'No transactions', passed: false });
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

  // 4. Known recipient (reuse storedTxs from parallel fetch)
  const priorPayments = storedTxs.filter((tx: any) => tx.recipient === recipient);
  if (priorPayments.length > 0) {
    steps.push({ check: 'Known recipient', result: `Paid ${priorPayments.length} time${priorPayments.length > 1 ? 's' : ''} before`, passed: true });
    weightedScore += weights.known;
  } else {
    steps.push({ check: 'Known recipient', result: 'First-time recipient', passed: false });
  }

  // 5. Amount anomaly (reuse storedTxs)
  const sentTxs = storedTxs.filter((tx: any) => tx.type === 'sent' && tx.amount > 0);
  if (sentTxs.length >= 3) {
    const avg = sentTxs.reduce((s: number, t: any) => s + t.amount, 0) / sentTxs.length;
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

  const fallbackSummaries: Record<RiskLevel, string> = {
    green: 'Recipient looks safe',
    yellow: 'Proceed with caution',
    red: 'High risk — verify recipient',
  };
  const fallbackSummary = autoApprove ? `${skrTier} Tier — Auto-approved` : fallbackSummaries[risk];

  // AI-powered summary via Groq (fire-and-forget with timeout)
  const aiSummary = await getAiSummary(steps, risk, score, amount, recipient).catch(() => null);

  return {
    risk,
    score,
    steps,
    summary: aiSummary || fallbackSummary,
    autoApprove,
  };
}

async function getAiSummary(
  steps: GuardianStep[],
  risk: RiskLevel,
  score: number,
  amount: number,
  recipient: string,
): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) return null;

  const checksText = steps.map(s => `${s.check}: ${s.result} (${s.passed ? 'PASS' : 'FAIL'})`).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are PhasmaGuard, an AI payment security agent for a Solana mobile wallet. Analyze recipient risk checks and give a 1-sentence summary (max 15 words). Be direct and specific — reference the actual check results. No fluff.',
          },
          {
            role: 'user',
            content: `Payment: $${amount.toFixed(2)} USDC to ${recipient.slice(0, 8)}...${recipient.slice(-4)}\nRisk: ${risk.toUpperCase()} (${score}/100)\n\nChecks:\n${checksText}`,
          },
        ],
        max_tokens: 40,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

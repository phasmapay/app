import { PublicKey } from '@solana/web3.js';
import { TorqueSDK } from '@torque-labs/torque-ts-sdk';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY, RPC_URL, SOLANA_NETWORK } from '../utils/constants';
import { getPublicKey } from './signer';
import { loadAuthToken } from './storage';

let torqueSdk: TorqueSDK | null = null;
let torqueInitialized = false;

/**
 * Minimal adapter shim that bridges MWA signing to the wallet-adapter
 * interface that Torque SDK expects. Only implements what Torque actually
 * uses during initializeUser(): publicKey + signMessage.
 */
function createMwaAdapterShim(pubkey: PublicKey) {
  return {
    publicKey: pubkey,
    // Torque uses signMessage for basic auth (line 118 of user.js)
    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
      const stored = await loadAuthToken();
      return await transact(async (wallet) => {
        if (stored?.token) {
          try {
            await wallet.reauthorize({ auth_token: stored.token, identity: APP_IDENTITY });
          } catch {
            await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
          }
        } else {
          await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
        }
        const [signed] = await wallet.signMessages({
          addresses: [pubkey.toBase58()],
          payloads: [message],
        });
        return signed;
      });
    },
  };
}

/**
 * Initialize Torque SDK. Call after wallet is connected.
 * Gracefully degrades — never throws, returns false on failure.
 */
export async function initTorque(): Promise<boolean> {
  if (torqueInitialized) return true;

  const pubkey = getPublicKey();
  if (!pubkey) {
    console.warn('[Torque] No wallet connected, skipping init');
    return false;
  }

  try {
    torqueSdk = new TorqueSDK({
      rpc: RPC_URL,
      network: SOLANA_NETWORK,
      publisherHandle: 'phasmapay',
    });

    const adapter = createMwaAdapterShim(pubkey);
    await torqueSdk.initialize(adapter as any);
    torqueInitialized = true;
    console.log('[Torque] Initialized successfully');
    return true;
  } catch (err) {
    console.warn('[Torque] Init failed (non-blocking):', err);
    torqueSdk = null;
    return false;
  }
}

/**
 * Fetch available Torque campaigns/offers for this user.
 */
export async function getTorqueOffers() {
  if (!torqueSdk?.user) return [];
  try {
    const { campaigns } = await torqueSdk.user.getOffers();
    return campaigns;
  } catch (err) {
    console.warn('[Torque] Failed to fetch offers:', err);
    return [];
  }
}

/**
 * Accept a Torque campaign (enroll user in loyalty program).
 */
export async function acceptTorqueCampaign(campaignId: string) {
  if (!torqueSdk?.user) return null;
  try {
    const journey = await torqueSdk.user.acceptCampaign(campaignId);
    console.log('[Torque] Accepted campaign:', campaignId);
    return journey;
  } catch (err) {
    console.warn('[Torque] Failed to accept campaign:', err);
    return null;
  }
}

/**
 * Get the user's journey/progress for a specific campaign.
 */
export async function getTorqueJourney(campaignId: string) {
  if (!torqueSdk?.user) return null;
  try {
    return await torqueSdk.user.getCampaignJourney(campaignId);
  } catch (err) {
    console.warn('[Torque] Failed to get journey:', err);
    return null;
  }
}

/**
 * Get all user journeys across campaigns.
 */
export async function getTorqueJourneys() {
  if (!torqueSdk?.user) return [];
  try {
    return (await torqueSdk.user.getJourneys()) ?? [];
  } catch (err) {
    console.warn('[Torque] Failed to get journeys:', err);
    return [];
  }
}

/**
 * Get the Solana Action for a bounty step (used for on-chain verification).
 */
export async function getTorqueBountyAction(campaignId: string, stepIndex: number) {
  if (!torqueSdk?.user) return null;
  try {
    return await torqueSdk.user.getBountyStepAction(campaignId, stepIndex);
  } catch (err) {
    console.warn('[Torque] Failed to get bounty action:', err);
    return null;
  }
}

/**
 * Confirm a signed action for campaign requirement completion.
 */
export async function confirmTorqueAction(campaignId: string, stepIndex: number, signedMessage: string) {
  if (!torqueSdk?.user) return null;
  try {
    return await torqueSdk.user.confirmActionSignature(campaignId, stepIndex, signedMessage);
  } catch (err) {
    console.warn('[Torque] Failed to confirm action:', err);
    return null;
  }
}

/**
 * Track a payment as a Torque event. Call after successful payment.
 * This is the main integration point — each USDC payment is a trackable
 * on-chain action that Torque can reward.
 */
export async function trackPaymentWithTorque(txSignature: string, amount: number) {
  if (!torqueSdk?.user) return;
  try {
    // If user has active campaigns, confirm the action with the tx signature
    const journeys = await getTorqueJourneys();
    for (const journey of journeys) {
      if (journey && 'campaignId' in journey) {
        await confirmTorqueAction(
          (journey as any).campaignId,
          0,
          txSignature
        );
      }
    }
    console.log('[Torque] Tracked payment:', txSignature, 'amount:', amount);
  } catch (err) {
    console.warn('[Torque] Payment tracking failed (non-blocking):', err);
  }
}

export function isTorqueInitialized(): boolean {
  return torqueInitialized;
}

export function getTorqueSdk(): TorqueSDK | null {
  return torqueSdk;
}

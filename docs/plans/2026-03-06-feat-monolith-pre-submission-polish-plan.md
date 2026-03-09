---
title: MONOLITH Pre-Submission Polish
type: feat
status: active
date: 2026-03-06
---

# MONOLITH Pre-Submission Polish

## Overview

Final polish pass before MONOLITH hackathon submission (March 9). Four code changes + vault mechanics verification + demo video recording. All items are small, isolated edits with no shared dependencies.

## Brainstorm Reference

`docs/brainstorms/2026-03-06-monolith-sprint-gaps-brainstorm.md`

## Tasks

### Task 1: Receipt Ghost Mode Styling (~30min)

**File:** `app/receipt/[signature].tsx`

**Problem:** Ghost pay passes `ghostMode: 'true'` to receipt, but receipt looks identical to normal pay. The `ghostMode` param is not even in the `useLocalSearchParams` type.

**Changes:**
1. Add `ghostMode` to the search params type definition (line 16-25):
   ```typescript
   const params = useLocalSearchParams<{
     signature: string;
     amount: string;
     recipient: string;
     cashback: string;
     savedGas: string;
     received: string;
     skrBalance: string;
     cashbackSig: string;
     ghostMode: string;  // ADD THIS
   }>();
   ```
2. Extract boolean:
   ```typescript
   const isGhost = params.ghostMode === 'true';
   ```
3. Add ghost badge below subtitle text (after line 89, the "Transaction confirmed on Solana" text):
   ```tsx
   {isGhost && (
     <View style={{
       backgroundColor: colors.ghostDim, paddingHorizontal: 10, paddingVertical: 4,
       borderRadius: radius.sm, marginTop: 8,
     }}>
       <Text style={{ color: colors.ghost, fontSize: 11, fontWeight: '700' }}>GHOST MODE</Text>
     </View>
   )}
   ```
4. Change heading text (line 85): use `isGhost && isReceived ? 'Ghost Payment Received!' : isGhost ? 'Ghost Payment Sent!' : isReceived ? 'Payment Received!' : 'Payment Sent!'`

**Acceptance Criteria:**
- [ ] Ghost pay receipt shows "GHOST MODE" badge
- [ ] Ghost pay receipt shows "Ghost Payment Sent!" heading
- [ ] Normal pay receipt unchanged
- [ ] Claimable claim-all receipt shows ghost badge (depends on Task 4)

---

### Task 2: Ghost-Receive Next-Step CTA (~20min)

**File:** `app/ghost-receive.tsx`

**Problem:** After ghost-receive detects funds (`status === 'received'`, lines 270-293), there's only a "Claim to Wallet" button. If user cancels MWA or wants to claim later via the Claimable screen, there's no option. Also no way to navigate to Claimable directly.

**Current `received` state UI (lines 270-293):**
- Shows "Payment Received!" + amount
- Text: "Funds are in the one-time address. Claim to sweep to your wallet."
- Single "Claim to Wallet" green button

**Changes:**
1. After the existing "Claim to Wallet" button (line 292), add a "Claim Later" button:
   ```tsx
   <TouchableOpacity
     style={{
       backgroundColor: colors.surface2, borderRadius: 16,
       paddingVertical: 16, alignItems: 'center', marginTop: 10,
     }}
     onPress={() => router.replace('/')}
   >
     <Text style={{ color: colors.textSub, fontWeight: '600', fontSize: 15 }}>Claim Later</Text>
   </TouchableOpacity>
   <Text style={{ color: colors.textMute, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
     Funds are safe. Find them on the Claimable screen.
   </Text>
   ```

**Acceptance Criteria:**
- [ ] `received` state shows both "Claim to Wallet" and "Claim Later" buttons
- [ ] "Claim Later" routes to home
- [ ] "Claim to Wallet" triggers existing claim flow (unchanged)
- [ ] Small reassurance text about funds being safe

---

### Task 3: Settings Vault Shortcut (~15min)

**File:** `app/(tabs)/settings.tsx`

**Problem:** Vault is only accessible from home card. Settings should have a shortcut for discoverability.

**Existing patterns (from reading the file):**
- Each section is a `View` with `backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1`
- Section headers: `Text` with `color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4`
- Rows use `SettingRow` component (label + value + optional onPress/accent)
- Sections end with `<View style={{ height: 8 }} />`

**Changes:**
1. Import `router` from `expo-router` (already imported? check — NO, not currently imported)
2. Add `import { router } from 'expo-router';` at top
3. Add VAULT section after MODE section (after line 98, before APP section):
   ```tsx
   <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
     <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
       VAULT
     </Text>
     <SettingRow
       label="Tap Vault"
       value="Manage >"
       onPress={() => router.push('/vault')}
       accent={colors.green}
     />
     <View style={{ height: 8 }} />
   </View>
   ```

**Acceptance Criteria:**
- [ ] Settings screen shows "VAULT" section with "Tap Vault" row
- [ ] Tapping routes to `/vault`
- [ ] Green accent on "Manage >" text
- [ ] Consistent with existing section card styling (surface0 bg, elevation, border-radius)

---

### Task 4: Claimable Receipt Ghost Flag (~5min)

**File:** `app/claimable.tsx`

**Problem:** Claim-all routes to receipt without `ghostMode` param. Receipt won't show ghost badge.

**Changes:**
1. Add `ghostMode: 'true'` to `router.replace` params (around line 189):
   ```typescript
   params: {
     signature,
     amount: totalUsdc.toString(),
     recipient: '',
     cashback: '0',
     savedGas: '0',
     received: 'true',
     ghostMode: 'true',  // ADD THIS
   },
   ```

**Acceptance Criteria:**
- [ ] Claim-all receipt shows ghost mode badge and heading

---

### Task 5: Vault End-to-End Device Test (~30min)

**No code changes.** Manual testing on Oppo Reno 14 Pro.

**Test flow:**
1. Home screen shows "Set Up Tap Vault" card (no vault created yet)
2. Tap card -> navigates to `/vault`
3. Vault creation screen shows -> tap "Create Vault"
4. Vault created -> shows balance $0.00
5. Load $5 USDC -> MWA popup -> confirm -> vault shows $5.00
6. Go home -> vault card shows balance + daily remaining
7. NFC pay -> confirmation card shows "Pay from Vault (instant)" option
8. Tap vault pay -> instant (no MWA popup) -> receipt shows
9. Vault card on home shows updated balance + spent today
10. Vault screen shows yield accruing (should tick up every 10s)

**Acceptance Criteria:**
- [ ] Vault creation works from home card
- [ ] Vault loading works via MWA
- [ ] Vault pay is instant (no wallet popup)
- [ ] Daily limit enforced
- [ ] Yield numbers tick up on vault screen

---

### Task 6: Demo Video Recording (~60min)

**After all code changes are deployed and tested.**

**Demo script:**
1. Show home screen (wallet connected, USDC balance, SKR tier)
2. Show vault setup flow (create -> load)
3. Two-phone NFC tap: Merchant enters $1 on Phone B -> Customer taps Phone A
4. Show Guardian scan results (green/yellow)
5. Show vault instant pay (no popup)
6. Show receipt with SKR cashback + tier progress
7. Show ghost pay flow (same NFC but ephemeral address)
8. Show claimable screen with sweep
9. Show vault yield accruing
10. Show settings and mode switching

## Parallelization

Tasks 1-4 are independent code edits — can all be done in parallel.
Task 5 requires Tasks 1-4 to be deployed to device.
Task 6 requires Task 5 to pass.

```
[Task 1] ─┐
[Task 2] ─┤
[Task 3] ─┼─> [Build & Deploy] ─> [Task 5: Device Test] ─> [Task 6: Video]
[Task 4] ─┘
```

## References

- Brainstorm: `docs/brainstorms/2026-03-06-monolith-sprint-gaps-brainstorm.md`
- Receipt screen: `app/receipt/[signature].tsx`
- Ghost receive: `app/ghost-receive.tsx`
- Settings: `app/(tabs)/settings.tsx`
- Claimable: `app/claimable.tsx`
- Design tokens: `src/design/tokens.ts` (ghost: `#00C853`, ghostDim: `rgba(0,200,83,0.08)`)
- Vault service: `src/services/vault.ts`

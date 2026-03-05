---
title: "Redesign Home Screen"
type: feat
status: active
date: 2026-03-03
deepened: 2026-03-03
---

# Redesign Home Screen

## Enhancement Summary

**Deepened on:** 2026-03-03
**Research agents:** Wallet UI patterns, RN performance, Clipboard/Eye/Time utilities

### Key Improvements from Research
1. **Eye toggle** — use animated opacity swap (real + masked text overlapping), not conditional render, to prevent layout jump
2. **Performance** — consolidate 3 `useState` calls into one `setHomeData`, parallelize AsyncStorage reads with `Promise.all`, add `cancelled` flag
3. **Android-specific** — remove all `shadow*` props (iOS-only, dead code), use `elevation` only, add `overScrollMode="never"` to ScrollView
4. **Action buttons** — keep 4 but with visual hierarchy (Pay/Receive primary, Ghost pair secondary/dimmed), don't cut to 3
5. **Clipboard** — use built-in `Clipboard` from react-native (no extra dep), no `expo-clipboard` needed
6. **Relative time** — pure JS helper, zero deps, covers "Just now" through "2y ago"
7. **Contrast fix** — current `#555` and `#666` text colors fail WCAG AA. Replace with `colors.textSub` (#6B6B80)

---

## Overview

Redesign `app/(tabs)/index.tsx` to match modern fintech wallet UI — inspired by reference designs (dark crypto wallet + fintech dashboard). The goal is a polished, demo-ready home screen for MONOLITH judging.

## Current State

The home screen already has:
- Wallet connect flow (disconnect state with "Connect Wallet" CTA)
- Balance card (USDC + SOL)
- 4 action buttons (Pay, Receive, Ghost Pay, Ghost Recv)
- Vault card (if enabled)
- Claimable ghost payments banner
- SKR tier card (via `SkrTierCard` component)

**What's missing/weak:**
- No eye toggle to hide balance (privacy)
- No "My Assets" section showing all tokens in a card
- No recent transactions on home screen
- Action buttons lack visual hierarchy — all 4 look like peers
- No wallet address pill in header (reference design pattern)
- Hardcoded `#555`/`#666` colors fail contrast on dark bg
- `shadow*` props are dead code on Android
- Sequential AsyncStorage reads cause 3 separate re-renders on focus

## Proposed Solution

Restructure the home screen into 8 distinct sections, top to bottom:

### Section Layout

```
[1. Header]        Address pill + devnet badge + settings
[2. Balance Card]  Big USDC amount + eye toggle + GlassCard
[3. Quick Actions] 4 buttons: Pay + Receive (primary) | Ghost Pay + Ghost Recv (secondary)
[4. Assets Card]   USDC, SOL, SKR rows with icons in a glass card
[5. Vault Card]    (existing, wrapped in GlassCard)
[6. Claimable]     (existing, no change)
[7. Transactions]  Last 3 recent txs from AsyncStorage
[8. SKR Tier]      (existing SkrTierCard, no change)
```

## Technical Approach

### 1. Header Redesign

**File:** `app/(tabs)/index.tsx` (inline, no new component)

Current: App icon + "PhasmaPay" + address underneath + devnet badge + notification bell

New:
- Left: Wallet address pill (`View` with rounded border, truncated address like `7LwY...CPhq`)
- Right: Devnet badge + settings gear icon
- Remove app icon and "PhasmaPay" text from header (it's the app, user knows)

```
┌─────────────────────────────────────────┐
│  [7LwY...CPhq]              [Devnet] ⚙  │
└─────────────────────────────────────────┘
```

**Implementation:**
- Use `shortAddress()` from `src/utils/solana.ts` (already exists)
- Address pill: `backgroundColor: colors.surface1`, `borderRadius: radius.full`, `paddingHorizontal: 14`
- Copy-to-clipboard on tap using built-in `Clipboard` from `react-native`

#### Research Insights: Clipboard

Use React Native's built-in `Clipboard` — no extra dependency needed:

```typescript
import { Clipboard } from 'react-native';

// In the address pill TouchableOpacity onPress:
Clipboard.setString(publicKey.toBase58());
// Show brief feedback (optional: use a transient state flag for "Copied!" text swap)
```

No need for `expo-clipboard` or `@react-native-clipboard/clipboard` — built-in is stable and sufficient.

### 2. Balance Card with Eye Toggle

**File:** `app/(tabs)/index.tsx` (inline)

Current: Plain dark card, USDC big + SOL row underneath

New:
- "AVAILABLE BALANCE" label (small caps, muted, use `type.label` token)
- Large USDC amount using `type.amountHero` token
- Eye icon toggle to hide/show balance
- Hidden state shows `$••••••` (bullets match digit count for visual stability)
- Use `GlassCard` component with purple glow
- SOL moves to Assets section

```
┌─────────────────────────────────────────┐
│  AVAILABLE BALANCE                  👁   │
│  $481.29                                │
└─────────────────────────────────────────┘
```

#### Research Insights: Eye Toggle Pattern

**Critical: use overlapping text, not conditional render.** Conditional rendering causes layout jump because masked text has different character widths.

```typescript
// Two overlapping Animated.Text views — real and masked
// Toggle opacity between them using Reanimated withTiming
const blur = useSharedValue(0);

const realStyle = useAnimatedStyle(() => ({
  opacity: interpolate(blur.value, [0, 1], [1, 0]),
}));
const maskedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(blur.value, [0, 1], [0, 1]),
  position: 'absolute' as const,
}));

// Mask function: replace digits with bullets, preserve dots/commas
const maskedUsdc = usdc.toFixed(2).replace(/\d/g, '•');
```

**Persistence:** store in AsyncStorage key `phasma:balance_hidden`. Load initial state in the consolidated `useFocusEffect`.

**Eye icons:** Add `EyeIcon` and `EyeOffIcon` to `src/components/Icons.tsx`:

```typescript
// EyeIcon — open eye (stroke-based, matches existing icon style)
export function EyeIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color} strokeWidth="1.8" fill="none" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
  );
}

// EyeOffIcon — crossed-out eye
export function EyeOffIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M1 1l22 22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
```

### 3. Quick Action Buttons (4 with hierarchy)

**File:** `app/(tabs)/index.tsx` (modify existing `ActionButton`)

**Research finding:** Don't cut to 3 buttons. Keep all 4 but create visual grouping — Pay/Receive at full opacity as primary, Ghost Pay/Ghost Recv dimmed as secondary. This tells the judge story: "primary actions, and stealth ones."

**Current problem:** Receive button uses `#0d2b1a` background — nearly invisible on dark. Ghost Pay uses `#2d1060` — also too dark. Judges won't parse actions at a glance.

**Fix:**
- **Pay**: `backgroundColor: colors.purple`, full elevation — primary
- **Receive**: `backgroundColor: colors.green` — primary (not `#0d2b1a`)
- **Ghost Pay**: `backgroundColor: colors.surface2`, `borderColor: colors.purpleDim` — secondary
- **Ghost Recv**: `backgroundColor: colors.surface2`, `borderColor: colors.ghostDim` — secondary

```typescript
// Data-driven action config
const ACTIONS = [
  { label: 'Pay', Icon: ArrowUpIcon, bg: colors.purple, isPrimary: true, route: '/pay' },
  { label: 'Receive', Icon: ArrowDownIcon, bg: colors.green, isPrimary: true, route: '/receive' },
  { label: 'Ghost Pay', Icon: GhostPayIcon, bg: colors.surface2, isPrimary: false, route: '/ghost-pay',
    borderColor: colors.purpleDim },
  { label: 'Ghost Recv', Icon: GhostReceiveIcon, bg: colors.surface2, isPrimary: false, route: '/ghost-receive',
    borderColor: colors.ghostDim },
];
```

#### Research Insights: Android Shadow

**Remove all `shadow*` props.** On Android, `shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset` are completely ignored — iOS-only. Only `elevation` works. Current ActionButton has both (dead code). Clean it:

```typescript
// BEFORE (dead shadow props on Android)
{ shadowColor: color, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: {width:0,height:4}, elevation: 6 }

// AFTER (Android-only app)
{ elevation: isPrimary ? 8 : 0 }
```

#### Research Insights: Spring Config

Current spring uses defaults. For snappier press feedback on Android:

```typescript
onPressIn={() => { scale.value = withSpring(0.88, { damping: 20, stiffness: 300, mass: 0.8 }); }}
```

### 4. My Assets Card

**File:** `app/(tabs)/index.tsx` (inline section)

Token balances in a `GlassCard` with stacked rows:

```
┌─────────────────────────────────────────┐
│  ASSETS                                  │
│  ──────────────────────────────────────  │
│  [●] USDC    USD Coin        $481.29    │
│  [◎] SOL     Solana          2.4510     │
│  [◈] SKR     Seeker          1,250      │
└─────────────────────────────────────────┘
```

**Implementation:**
- Each row: 40x40 icon circle (`colors.surface2` bg) → token symbol + name → right-aligned amount
- Separator: `borderBottomWidth: StyleSheet.hairlineWidth` (NOT `1` — hairline is device-pixel perfect)
- Use `SolanaIcon` for SOL, `DiamondIcon` for SKR
- USDC icon: simple View with `$` text in a circle

**Data sources:** All from existing `useBalances` hook:
- `usdc` → USDC amount
- `sol` → SOL amount
- `skrStatus.balance` → SKR amount

### 5. Vault Card (Minor Refresh)

Keep existing vault card. Wrap in `GlassCard` with green glow:

```typescript
<GlassCard glow={colors.green} style={{ padding: space.base, marginBottom: space.base }}>
  {/* existing vault card content */}
</GlassCard>
```

- Align border radius with `radius.xl`
- Keep progress bar, daily limit, balance display
- Remove manual `backgroundColor` and `borderWidth` (GlassCard handles it)

### 6. Recent Transactions Section

**File:** `app/(tabs)/index.tsx` (new section, data from `getTransactions()`)

```
┌─────────────────────────────────────────┐
│  RECENT TRANSACTIONS            See all  │
│  ──────────────────────────────────────  │
│  [↗] Sent      -$5.00     3fK2...9xPq  │
│       2 hours ago                        │
│  [↙] Received  +$10.00    7LwY...CPhq  │
│       Yesterday                          │
└─────────────────────────────────────────┘
```

**Implementation:**
- Import `getTransactions, StoredTransaction` from `src/services/storage`
- Load in consolidated `useFocusEffect` (see Performance section)
- Show last 3 transactions
- "See all" navigates to History tab
- Direction icon in colored bg circle (red for sent, green for received)
- Amount: `colors.error` for sent (negative), `colors.green` for received (positive)
- Empty state: "No transactions yet" in `colors.textSub`

**Data shape** (from `StoredTransaction`):
```ts
{ signature, sender, recipient, amount, timestamp, savedGas, cashback, strategy, type }
```

#### Research Insights: Relative Time Helper

Add to `src/utils/time.ts` — pure JS, zero dependencies:

```typescript
export function relativeTime(tsMs: number): string {
  const diff = Date.now() - tsMs;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
```

#### Research Insights: Transaction Row Colors

Use direction-colored background circles for icons (matches Phantom pattern):

```typescript
const TX_COLORS = {
  sent:     { color: colors.error, bg: 'rgba(255,59,92,0.12)' },
  received: { color: colors.green, bg: colors.greenDim },
};
```

### 7. SKR Tier Card

No changes needed — already polished with `GlassCard`, animated progress bar, tier badge.

**Performance note:** Wrap in `React.memo` to prevent re-renders from vault/transaction state changes:

```typescript
export const SkrTierCard = React.memo(SkrTierCardInner);
```

### 8. Claimable Banner

Keep as-is, position between Vault card and Recent Transactions.

## Section Order (Final)

1. Header (address pill + devnet + settings)
2. Balance Card (USDC hero + eye toggle)
3. Quick Actions (4 buttons with primary/secondary hierarchy)
4. Assets Card (USDC, SOL, SKR rows)
5. Vault Card (if enabled, wrapped in GlassCard)
6. Claimable Banner (if any)
7. Recent Transactions (last 3 + "See all")
8. SKR Tier Card

## Performance Optimizations

### Consolidate State (3 re-renders → 1)

Current: 3 separate `useState` + `setState` calls in `useFocusEffect` = 3 re-renders on every focus.

Fix: single state object:

```typescript
type HomeData = {
  claimableCount: number;
  vaultConfig: VaultConfig | null;
  vaultBalance: number;
  recentTxs: StoredTransaction[];
};

const [homeData, setHomeData] = useState<HomeData>({
  claimableCount: 0, vaultConfig: null, vaultBalance: 0, recentTxs: [],
});
```

### Parallelize AsyncStorage Reads

Current: sequential `getVaultConfig().then(cfg => { ... getVaultBalance() })` — waterfall.

Fix:

```typescript
useFocusEffect(
  useCallback(() => {
    if (!isConnected) return;
    let cancelled = false;

    async function load() {
      const [payments, cfg, txs] = await Promise.all([
        getUnclaimedPayments().catch(() => []),
        getVaultConfig().catch(() => null),
        getTransactions().catch(() => []),
      ]);
      if (cancelled) return;

      const bal = cfg ? await getVaultBalance(getConnection()).catch(() => 0) : 0;
      if (cancelled) return;

      setHomeData({
        claimableCount: payments.filter(p => p.status === 'received' || p.status === 'failed').length,
        vaultConfig: cfg,
        vaultBalance: bal,
        recentTxs: txs.slice(0, 3),
      });
    }

    load();
    return () => { cancelled = true; };
  }, [isConnected])
);
```

The `cancelled` flag prevents setState on unfocused screens.

### ScrollView Config

```typescript
<ScrollView
  overScrollMode="never"              // removes Android glow bounce
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  // ... existing props
>
```

### Android Shadow Cleanup

Remove ALL `shadow*` props from the codebase — they're iOS-only and dead code on this Android-only app. Use `elevation` only.

## Contrast Notes (Light Theme)

Light theme makes contrast easier:
- `colors.text` (#1A1A2E) on white → ~16:1 (excellent)
- `colors.textSub` (#6B7280) on white → ~5.0:1 (passes AA)
- `colors.purple` (#8B5CF6) on white → ~3.8:1 (passes AA for large text, use for buttons/accents)

**Replace all hardcoded `#555`/`#666`/`#999` with `colors.textSub` or `colors.textMute`.**

## Design Tokens — LIGHT THEME REWRITE

**Major shift: switching from dark to light theme.** The Phasma logo is a purple gradient (magenta-pink → deep violet), and light theme reads better on mobile for fintech/payment apps.

### New Color Palette (derived from Phasma logo)

```typescript
export const colors = {
  // Light theme backgrounds
  base:     '#F8F7FC',    // warm off-white with purple tint
  surface0: '#FFFFFF',    // cards — pure white
  surface1: '#F1EFF8',    // secondary cards / nested content
  surface2: '#E8E5F0',    // inputs, tags, pills
  border:   'rgba(0,0,0,0.06)',
  borderLit:'rgba(0,0,0,0.10)',

  // Phasma purple gradient (from logo)
  purple:   '#8B5CF6',    // primary — mid purple
  purpleLight: '#A78BFA', // lighter variant (top of logo gradient)
  purpleDark: '#6D28D9',  // deep variant (bottom of logo gradient)
  purpleDim:'rgba(139,92,246,0.12)', // purple tint for backgrounds

  // Functional
  green:    '#10B981',    // success / receive (softer for light theme)
  greenDim: 'rgba(16,185,129,0.10)',
  ghost:    '#00C853',
  ghostDim: 'rgba(0,200,83,0.08)',

  // Tier colors (slightly adjusted for light bg readability)
  gold:     '#F59E0B',
  silver:   '#6B7280',
  bronze:   '#D97706',

  error:    '#EF4444',
  warning:  '#F59E0B',

  // Text on light
  text:     '#1A1A2E',    // near-black with purple undertone
  textSub:  '#6B7280',    // gray-500
  textMute: '#9CA3AF',    // gray-400
};
```

### Key Differences from Dark Theme
- **Background:** `#F8F7FC` (purple-tinted off-white) instead of `#060608`
- **Cards:** Pure white `#FFFFFF` with subtle shadow instead of translucent glass
- **Text:** Dark on light (`#1A1A2E`) instead of light on dark
- **Shadows:** Real `elevation` shadows work well on light (visible!). No more faking glow with borders.
- **Purple accent:** `#8B5CF6` matches logo mid-tone (Solana's `#9945FF` is close but logo is slightly bluer)
- **GlassCard** needs rework: change from `rgba(255,255,255,0.04)` bg to `#FFFFFF` with shadow

### GlassCard Update for Light Theme

```typescript
// GlassCard on light: white card + subtle shadow + optional purple tint
style={[
  {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 2,
  },
  glow && {
    borderColor: `${glow}30`, // subtle colored border
    elevation: 4,
  },
]}
```

### Balance Card on Light Theme
- White card with purple gradient accent stripe at top (or purple tinted bg `purpleDim`)
- Hero amount in `colors.text` (#1A1A2E) — dark text on white
- Eye icon in `colors.textSub`

No new dependencies needed.

## Files Changed

| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Full redesign of connected state layout, consolidated state, perf fixes |
| `src/components/Icons.tsx` | Add `EyeIcon`, `EyeOffIcon` |
| `src/utils/time.ts` | New file: `relativeTime()` helper |

## Acceptance Criteria

- [ ] Header shows truncated address pill (tappable to copy) + devnet badge + settings icon
- [ ] Balance card shows USDC with eye toggle to hide/show (animated, no layout jump)
- [ ] Eye toggle state persists in AsyncStorage
- [ ] 4 action buttons with visual hierarchy (Pay/Receive primary, Ghost pair secondary)
- [ ] Receive button clearly visible (green, not `#0d2b1a`)
- [ ] My Assets card shows USDC, SOL, SKR balances in rows
- [ ] Recent Transactions shows last 3 from AsyncStorage with relative timestamps
- [ ] "See all" in transactions navigates to History tab
- [ ] Empty transaction state shows "No transactions yet"
- [ ] Vault card renders when enabled, wrapped in GlassCard (no regression)
- [ ] Claimable banner renders when unclaimed (no regression)
- [ ] SKR tier card renders (no regression)
- [ ] All styling uses `StyleSheet.create` / inline styles — no className, no NativeWind
- [ ] No `shadow*` props — `elevation` only (Android)
- [ ] No hardcoded `#555`/`#666` — use `colors.textSub`
- [ ] Dark theme consistent with `colors.base` background
- [ ] Connect wallet screen unchanged (no regression)
- [ ] Pull-to-refresh still works
- [ ] `overScrollMode="never"` on ScrollView
- [ ] Single `setHomeData` call (not 3 separate setStates)

## What NOT To Do

- No new npm dependencies
- Don't touch the tab bar or other screens
- Don't refactor existing services
- Don't add `expo-linear-gradient` — GlassCard is sufficient
- Don't use `shadow*` props (iOS-only, dead on Android)

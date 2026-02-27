import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

// Ionicons equivalents as SVG paths (from ionicons.com)
export function HomeIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M261.56 101.28a8 8 0 00-11.06 0L66.4 277.15a8 8 0 00-2.47 5.79L63.9 448a32 32 0 0032 32H192a16 16 0 0016-16V328a8 8 0 018-8h80a8 8 0 018 8v136a16 16 0 0016 16h96.06a32 32 0 0032-32V282.94a8 8 0 00-2.47-5.79z" fill={color} />
      <Path d="M490.91 244.15l-74.8-71.56V64a16 16 0 00-16-16h-48a16 16 0 00-16 16v51.69l-55.49-53.1c-5.35-5.12-14.9-11.59-24.62-11.59s-19.27 6.47-24.56 11.53L21.16 244.15c-6.09 5.83-6.73 15.6-1.42 22.17A16 16 0 0032 272h16v-1.15L256 75.08 464 270.85V272h16a16 16 0 0012.27-5.68c5.31-6.57 4.67-16.34-1.36-22.17z" fill={color} />
    </Svg>
  );
}

export function HomeOutlineIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M80 212v236a16 16 0 0016 16h96V328a24 24 0 0124-24h80a24 24 0 0124 24v136h96a16 16 0 0016-16V212" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M480 256L266.89 52c-5-5.28-16.69-5.34-21.78 0L32 256M400 179V64h-48v69" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function TimeIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208 208-93.13 208-208S370.87 48 256 48zm96 240H256a16 16 0 01-16-16V128a16 16 0 0132 0v128h80a16 16 0 010 32z" fill={color} />
    </Svg>
  );
}

export function TimeOutlineIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192S362 64 256 64z" stroke={color} strokeWidth="32" strokeMiterlimit="10" fill="none" />
      <Path d="M256 128v144h96" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M262.29 192.31a64 64 0 1057.4 57.4 64.13 64.13 0 00-57.4-57.4zM416.39 256a154.34 154.34 0 01-1.53 20.79l45.21 35.46a10.81 10.81 0 012.45 13.75l-42.77 74a10.81 10.81 0 01-13.14 4.59l-44.9-18.08a16.11 16.11 0 00-15.17 1.75A164.48 164.48 0 01325 400.8a15.94 15.94 0 00-8.82 12.14l-6.73 47.89a11.08 11.08 0 01-10.68 9.17h-85.54a11.11 11.11 0 01-10.69-8.87l-6.72-47.82a16.07 16.07 0 00-9-12.22 155.3 155.3 0 01-21.46-12.57 16 16 0 00-15.11-1.71l-44.89 18.07a10.81 10.81 0 01-13.14-4.58l-42.77-74a10.8 10.8 0 012.45-13.75l38.21-30a16.05 16.05 0 006-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 00-6.07-13.94l-38.19-30A10.81 10.81 0 0149.48 186l42.77-74a10.81 10.81 0 0113.14-4.59l44.9 18.08a16.11 16.11 0 0015.17-1.75A164.48 164.48 0 01187 111.2a15.94 15.94 0 008.82-12.14l6.73-47.89A11.08 11.08 0 01213.23 42h85.54a11.11 11.11 0 0110.69 8.87l6.72 47.82a16.07 16.07 0 009 12.22 155.3 155.3 0 0121.46 12.57 16 16 0 0015.11 1.71l44.89-18.07a10.81 10.81 0 0113.14 4.58l42.77 74a10.8 10.8 0 01-2.45 13.75l-38.21 30a16.05 16.05 0 00-6.05 14.08c.33 4.14.55 8.3.55 12.46z" fill={color} />
    </Svg>
  );
}

export function SettingsOutlineIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M262.29 192.31a64 64 0 1057.4 57.4 64.13 64.13 0 00-57.4-57.4zM416.39 256a154.34 154.34 0 01-1.53 20.79l45.21 35.46a10.81 10.81 0 012.45 13.75l-42.77 74a10.81 10.81 0 01-13.14 4.59l-44.9-18.08a16.11 16.11 0 00-15.17 1.75A164.48 164.48 0 01325 400.8a15.94 15.94 0 00-8.82 12.14l-6.73 47.89a11.08 11.08 0 01-10.68 9.17h-85.54a11.11 11.11 0 01-10.69-8.87l-6.72-47.82a16.07 16.07 0 00-9-12.22 155.3 155.3 0 01-21.46-12.57 16 16 0 00-15.11-1.71l-44.89 18.07a10.81 10.81 0 01-13.14-4.58l-42.77-74a10.8 10.8 0 012.45-13.75l38.21-30a16.05 16.05 0 006-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 00-6.07-13.94l-38.19-30A10.81 10.81 0 0149.48 186l42.77-74a10.81 10.81 0 0113.14-4.59l44.9 18.08a16.11 16.11 0 0015.17-1.75A164.48 164.48 0 01187 111.2a15.94 15.94 0 008.82-12.14l6.73-47.89A11.08 11.08 0 01213.23 42h85.54a11.11 11.11 0 0110.69 8.87l6.72 47.82a16.07 16.07 0 009 12.22 155.3 155.3 0 0121.46 12.57 16 16 0 0015.11 1.71l44.89-18.07a10.81 10.81 0 0113.14 4.58l42.77 74a10.8 10.8 0 01-2.45 13.75l-38.21 30a16.05 16.05 0 00-6.05 14.08c.33 4.14.55 8.3.55 12.46z" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Diagonal arrow up-right (send / pay)
export function ArrowUpIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17L17 7M17 7H8M17 7v9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Diagonal arrow down-left (receive)
export function ArrowDownIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 7L7 17M7 17h9M7 17V8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Scan / QR viewfinder with center dot
export function ScanIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3H4a1 1 0 00-1 1v3M17 3h3a1 1 0 011 1v3M21 17v3a1 1 0 01-1 1h-3M7 21H4a1 1 0 01-1-1v-3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="2.5" fill={color} />
      <Path d="M12 8v1M12 15v1M8 12h1M15 12h1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function FlashIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M315.27 33L96 304h128l-31.51 173.23a2.36 2.36 0 002.33 2.77 2.36 2.36 0 001.89-.95L416 208H288l31.66-173.25a2.45 2.45 0 00-2.44-2.75 2.42 2.42 0 00-1.95 1z" fill={color} />
    </Svg>
  );
}

export function DiamondIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M35.42 188.21l207.75 269.46a16.17 16.17 0 0025.66 0l207.75-269.46a16.52 16.52 0 00.95-18.75L407.06 55.71A16.22 16.22 0 00393.27 48H118.73a16.22 16.22 0 00-13.79 7.71L35.42 188.21z" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function NotificationIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path d="M427.68 351.43C402 320 383.87 304 383.87 217.35 383.87 138 343.35 109.73 310 96c-4.43-1.82-8.6-6-9.95-10.55C294.2 65.54 277.8 48 256 48s-38.21 17.55-44 37.47c-1.35 4.6-5.52 8.71-9.95 10.53-33.39 13.75-73.87 41.92-73.87 121.35C128.13 304 110 320 84.32 351.43 73.68 364.45 83 384 101.61 384h308.88c18.51 0 27.77-19.61 17.19-32.57zM320 384v16a64 64 0 01-128 0v-16" stroke={color} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Correct Solana logo — 3 left-leaning parallelogram bars
export function SolanaIcon({ size = 24, color = '#14F195' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 397.7 311.7" fill="none">
      <Path d="M64.6 237.9a11.5 11.5 0 018.1-3.4h317.4c5.1 0 7.7 6.2 4.1 9.8l-52.6 52.6a11.5 11.5 0 01-8.1 3.4H15.1c-5.1 0-7.7-6.2-4.1-9.8l53.6-52.6z" fill={color} />
      <Path d="M64.6 3.4A11.8 11.8 0 0172.7 0h317.4c5.1 0 7.7 6.2 4.1 9.8L341.6 62.4a11.5 11.5 0 01-8.1 3.4H15.1c-5.1 0-7.7-6.2-4.1-9.8L64.6 3.4z" fill={color} />
      <Path d="M333.1 120.1a11.5 11.5 0 00-8.1-3.4H7.5c-5.1 0-7.7 6.2-4.1 9.8l52.6 52.6a11.5 11.5 0 008.1 3.4h317.5c5.1 0 7.7-6.2 4.1-9.8l-52.6-52.6z" fill={color} />
    </Svg>
  );
}

// Ghost base shape
export function GhostIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C7.03 2 3 6.03 3 11v10l2.5-2.5L8 21l2.5-2.5L13 21l2.5-2.5L18 21l2.5-2.5V11C20.5 6.03 16.97 2 12 2z" fill={color} />
      <Circle cx="9.5" cy="11" r="1.5" fill="#0a0a0a" />
      <Circle cx="14.5" cy="11" r="1.5" fill="#0a0a0a" />
    </Svg>
  );
}

// Ghost Pay — ghost with up-right arrow (send privately)
export function GhostPayIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Ghost body */}
      <Path d="M10 2C5.58 2 2 5.58 2 10v9l2-2 2 2 2-2 2 2 2-2 2 2 2-2v-9C16 5.58 12.42 2 10 2z" fill={color} />
      <Circle cx="7.5" cy="10" r="1.2" fill="#2d1060" />
      <Circle cx="12.5" cy="10" r="1.2" fill="#2d1060" />
      {/* Arrow badge bottom-right */}
      <Circle cx="18" cy="18" r="4.5" fill="#9945FF" />
      <Path d="M16 20L20 16M20 16h-2.5M20 16v2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Ghost Receive — ghost with down-left arrow (receive privately)
export function GhostReceiveIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Ghost body */}
      <Path d="M10 2C5.58 2 2 5.58 2 10v9l2-2 2 2 2-2 2 2 2-2 2 2 2-2v-9C16 5.58 12.42 2 10 2z" fill={color} />
      <Circle cx="7.5" cy="10" r="1.2" fill="#2d1060" />
      <Circle cx="12.5" cy="10" r="1.2" fill="#2d1060" />
      {/* Arrow badge bottom-right */}
      <Circle cx="18" cy="18" r="4.5" fill="#14F195" />
      <Path d="M20 16L16 20M16 20h2.5M16 20v-2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

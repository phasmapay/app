import React, { useState, useEffect, useRef } from 'react';
import { Text, TextStyle } from 'react-native';
import { colors, type as typography } from '../design/tokens';

type DecryptTextProps = {
  text: string;
  trigger: boolean;
  duration?: number;
  style?: TextStyle;
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function DecryptText({ text, trigger, duration = 1000, style }: DecryptTextProps) {
  const [display, setDisplay] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!trigger || !text) {
      setDisplay('');
      return;
    }

    const startTime = Date.now();
    const len = text.length;

    setDisplay('\u2588'.repeat(len));

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let result = '';
      for (let i = 0; i < len; i++) {
        const charProgress = progress * len;
        if (i < charProgress - 2) {
          result += text[i];
        } else if (i < charProgress) {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          result += '\u2588';
        }
      }

      setDisplay(result);

      if (progress >= 1) {
        setDisplay(text);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 40);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [trigger, text, duration]);

  return (
    <Text
      style={[
        {
          fontFamily: 'JetBrainsMono-Regular',
          color: colors.ghost,
          fontSize: 14,
          letterSpacing: 1,
        },
        style,
      ]}
    >
      {display}
    </Text>
  );
}

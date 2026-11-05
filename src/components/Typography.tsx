import React, { createContext, useContext } from 'react';
import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

// The context is shared so a failed local font load falls back to system text.
const FontReady = createContext(false);
export const TypographyProvider = FontReady.Provider;
export function useTextFont(weight: TextStyle['fontWeight'] = '400') {
  const ready = useContext(FontReady);
  const numericWeight = weight === 'bold' ? 700 : Number(weight || 400);
  const family =
    numericWeight >= 700
      ? 'Manrope_700Bold'
      : numericWeight >= 600
        ? 'Manrope_600SemiBold'
        : numericWeight >= 500
          ? 'Manrope_500Medium'
          : 'Manrope_400Regular';
  return ready ? family : undefined;
}
export function Text({ style, ...props }: TextProps) {
  const fontFamily = useTextFont(StyleSheet.flatten(style)?.fontWeight);
  return <NativeText {...props} style={[fontFamily && { fontFamily }, style]} />;
}

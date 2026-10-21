/**
 * Segmented EN / FR language toggle with a sliding animated indicator.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, radius, typography } from '../theme/theme';
import { LANGUAGES, LanguageCode } from '../config/env';
import { useLanguage } from '../state/LanguageContext';
import { haptics } from '../utils/haptics';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const index = LANGUAGES.findIndex((l) => l.code === language);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * 100, { damping: 16 }) }],
  }));

  const select = (code: LanguageCode) => {
    haptics.tap();
    setLanguage(code);
  };

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.indicator, indicator]} />
      {LANGUAGES.map((l) => (
        <Pressable key={l.code} style={styles.segment} onPress={() => select(l.code)}>
          <Text style={[styles.label, language === l.code && styles.labelActive]}>
            {l.flag} {l.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 100,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  segment: { width: 100, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, color: colors.textMuted },
  labelActive: { color: colors.text },
});

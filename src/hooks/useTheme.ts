/**
 * useTheme — returns the active ThemeTokens based on the store's themeMode.
 *
 * Usage:
 *   const theme = useTheme();
 *   <View style={{ backgroundColor: theme.bg }} />
 */

import { useAppStore } from '../stores/useAppStore';
import { THEMES, ThemeTokens } from '../constants/theme';

export function useTheme(): ThemeTokens {
  const themeMode = useAppStore(s => s.themeMode);
  return THEMES[themeMode];
}

import React from 'react';
import { View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

interface FadingBorderProps {
  children: React.ReactNode;
  style?: object;
}

export const FadingBorder: React.FC<FadingBorderProps> = ({ children, style }) => (
  <View style={[{ borderRadius: 12, overflow: 'hidden' }, style]}>
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 1 }}
    />
    <ExpoLinearGradient
      colors={['transparent', 'rgba(226, 232, 240, 0.4)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 1 }}
    />
    {children}
  </View>
);

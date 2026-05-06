import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { Node, AtlasGraphView } from '../types';
import { ThemeTokens } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RadarProps {
  nodes: Node[];
  view: AtlasGraphView; // 'coordinates' | 'actions'
  theme: ThemeTokens;
  activeNodeId: string | null;
  onEntityPress?: (type: 'coordinate' | 'action', data: any) => void;
  onEmptyPress?: () => void;
}

export function Radar({ nodes, view, theme, activeNodeId, onEntityPress, onEmptyPress }: RadarProps) {
  // Slow continuous rotation
  const spinValue = useRef(new Animated.Value(0)).current;
  const currentSpinRef = useRef(0);
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = spinValue.addListener(({ value }) => {
      currentSpinRef.current = value;
    });
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 90000, 
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    ).start();

    return () => spinValue.removeListener(sub);
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4]
  });

  const SVG_SIZE = 340;
  const CENTER = SVG_SIZE / 2;

  const allGoals = useMemo(() => {
    return nodes.flatMap(n => n.goals.map(g => ({ ...g, nodeId: n.id, nodeColor: n.color })));
  }, [nodes]);

  const allActions = useMemo(() => {
    return nodes.flatMap(n => n.goals.flatMap(g => g.actions.map(a => ({ ...a, nodeId: n.id, nodeColor: n.color, __goalId: g.id, __goalName: g.name }))));
  }, [nodes]);

  const centerColor = activeNodeId ? (nodes.find(n => n.id === activeNodeId)?.color || '#FFFFFF') : '#FFFFFF';

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} onPress={onEmptyPress}>
          {/* Central Origin */}
          <Circle cx={CENTER} cy={CENTER} r={18} fill={centerColor} />
          <Circle cx={CENTER} cy={CENTER} r={28} fill={centerColor} opacity={0.2} />
          <Circle cx={CENTER} cy={CENTER} r={40} fill={centerColor} opacity={0.05} />

          {/* Render All Coordinates */}
          {view === 'coordinates' && allGoals.map((goal, i) => {
            const angle = (i / (allGoals.length || 1)) * 2 * Math.PI;
            const radius = 60 + (i % 3) * 30; 
            const cx = CENTER + radius * Math.cos(angle);
            const cy = CENTER + radius * Math.sin(angle);
            const cRadius = 6 + (goal.value / 10) * 6; 
            const isActive = !activeNodeId || activeNodeId === goal.nodeId;
            const color = isActive ? goal.nodeColor : theme.divider;
            const opacity = isActive ? 1 : 0.25;

            return (
              <G key={goal.id}>
                <Line x1={CENTER} y1={CENTER} x2={cx} y2={cy} stroke={color} strokeWidth={1} opacity={isActive ? 0.2 : 0.05} />
                
                {/* Interaction circle (larger hit area) */}
                <Circle 
                  cx={cx} cy={cy} r={25} 
                  fill="transparent" 
                  onPress={() => onEntityPress?.('coordinate', goal)} 
                />

                {/* Real Coordinate Moon */}
                <Circle cx={cx} cy={cy} r={cRadius} fill={color} opacity={opacity} pointerEvents="none" />
              </G>
            );
          })}

          {/* Render All Actions */}
          {view === 'actions' && allActions.map((act, i) => {
            const angle = (i / (allActions.length || 1)) * 2 * Math.PI;
            const radius = 125 - (i % 4) * 25; 
            const cx = CENTER + radius * Math.cos(angle);
            const cy = CENTER + radius * Math.sin(angle);
            const isCompleted = act.completed;
            const isActive = !activeNodeId || activeNodeId === act.nodeId;
            
            const color = isActive ? act.nodeColor : theme.divider;
            const fill = color;
            const opacity = isActive ? 1 : 0.2;

            return (
              <G key={act.id}>
                <Circle cx={CENTER} cy={CENTER} r={radius} stroke={color} strokeWidth={1} fill="none" opacity={isActive ? 0.15 : 0.05} />
                
                {/* Interaction circle */}
                <Circle 
                  cx={cx} cy={cy} r={25} 
                  fill="transparent" 
                  onPress={() => onEntityPress?.('action', act)} 
                />

                {isActive && isCompleted && (
                  <AnimatedCircle 
                    cx={cx} cy={cy} 
                    r={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [4.5, 15] })} 
                    fill={color} 
                    opacity={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })} 
                    pointerEvents="none"
                  />
                )}
                
                <Circle 
                  cx={cx} 
                  cy={cy} 
                  r={isCompleted ? 9 : 6} 
                  fill={fill} 
                  opacity={opacity} 
                  pointerEvents="none"
                />
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
);
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  }
});

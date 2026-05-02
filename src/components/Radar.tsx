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
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    return nodes.flatMap(n => n.goals.flatMap(g => g.actions.map(a => ({ ...a, nodeId: n.id, nodeColor: n.color, __goalId: g.id }))));
  }, [nodes]);

  const handleSvgPress = (e: any) => {
    const locX = e.nativeEvent.locationX;
    const locY = e.nativeEvent.locationY;
    
    let closestEntity: any = null;
    let closestDist = 40; // Max click radius (40px)
    let type: 'coordinate' | 'action' = 'coordinate';

    if (view === 'coordinates') {
      allGoals.forEach((goal, i) => {
        const angle = (i / (allGoals.length || 1)) * 2 * Math.PI;
        const radius = 60 + (i % 3) * 30; 
        const cx = CENTER + radius * Math.cos(angle);
        const cy = CENTER + radius * Math.sin(angle);
        const dist = Math.sqrt(Math.pow(cx - locX, 2) + Math.pow(cy - locY, 2));
        if (dist < closestDist) {
          closestDist = dist;
          closestEntity = goal;
          type = 'coordinate';
        }
      });
    } else if (view === 'actions') {
      allActions.forEach((act, i) => {
        const angle = (i / (allActions.length || 1)) * 2 * Math.PI;
        const radius = 50 + (i % 4) * 25; 
        const cx = CENTER + radius * Math.cos(angle);
        const cy = CENTER + radius * Math.sin(angle);
        const dist = Math.sqrt(Math.pow(cx - locX, 2) + Math.pow(cy - locY, 2));
        if (dist < closestDist) {
          closestDist = dist;
          closestEntity = act;
          type = 'action';
        }
      });
    }

    if (closestEntity && onEntityPress) {
      onEntityPress(type, closestEntity);
    } else if (onEmptyPress) {
      onEmptyPress();
    }
  };

  const centerColor = activeNodeId ? (nodes.find(n => n.id === activeNodeId)?.color || '#FFFFFF') : '#FFFFFF';

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} onPress={handleSvgPress}>
          
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
            const cRadius = 4 + (goal.value / 10) * 4; 
            const isActive = !activeNodeId || activeNodeId === goal.nodeId;
            const color = isActive ? goal.nodeColor : theme.divider;
            const opacity = isActive ? 1 : 0.25;

            return (
              <G key={goal.id}>
                <Line x1={CENTER} y1={CENTER} x2={cx} y2={cy} stroke={color} strokeWidth={1} opacity={isActive ? 0.2 : 0.05} />
                
                {/* Real Coordinate Moon */}
                <Circle cx={cx} cy={cy} r={cRadius} fill={color} opacity={opacity} pointerEvents="none" />
              </G>
            );
          })}

          {/* Render All Actions */}
          {view === 'actions' && allActions.map((act, i) => {
            const angle = (i / (allActions.length || 1)) * 2 * Math.PI;
            // Invert the radius step to make the spiral arms trail the clockwise rotation (galaxy effect)
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
                {/* Orbit Path */}
                <Circle cx={CENTER} cy={CENTER} r={radius} stroke={color} strokeWidth={1} fill="none" opacity={isActive ? 0.15 : 0.05} />
                
                {/* Pulsing Aura for active completed actions */}
                {isActive && isCompleted && (
                  <AnimatedCircle 
                    cx={cx} cy={cy} 
                    r={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [3, 10] })} 
                    fill={color} 
                    opacity={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })} 
                    pointerEvents="none"
                  />
                )}
                
                <Circle 
                  cx={cx} 
                  cy={cy} 
                  r={isCompleted ? 6 : 4} 
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

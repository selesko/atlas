import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { Node, AtlasGraphView } from '../types';
import { ThemeTokens } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CosmicSystemViewProps {
  nodes: Node[];
  view: AtlasGraphView; // 'coordinates' | 'actions'
  theme: ThemeTokens;
  activeNodeId: string | null;
  onEntityPress?: (type: 'coordinate' | 'action', data: any) => void;
}

export function CosmicSystemView({ nodes, view, theme, activeNodeId, onEntityPress }: CosmicSystemViewProps) {
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

  const activeNode = nodes.find(n => n.id === activeNodeId) || nodes[0];
  if (!activeNode) return null;

  // Generate deterministic "fake" background dots
  const fakeDots = useMemo(() => {
    const sr = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
    const count = view === 'coordinates' ? 18 : 60;
    return Array.from({ length: count }, (_, i) => {
      const angle = sr(i * 13.7) * 2 * Math.PI;
      const radius = 40 + sr(i * 7.3) * 100;
      return {
        cx: CENTER + radius * Math.cos(angle),
        cy: CENTER + radius * Math.sin(angle),
        r: view === 'coordinates' ? 1.5 + sr(i)*2 : 1 + sr(i),
        op: 0.1 + sr(i)*0.2
      };
    });
  }, [view]);

  const handleSvgPress = (e: any) => {
    const locX = e.nativeEvent.locationX;
    const locY = e.nativeEvent.locationY;
    
    let closestEntity: any = null;
    let closestDist = 40; // Max click radius (40px)
    let type: 'coordinate' | 'action' = 'coordinate';

    if (view === 'coordinates') {
      activeNode.goals.forEach((goal, i) => {
        const angle = (i / (activeNode.goals.length || 1)) * 2 * Math.PI;
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
      const allActions = activeNode.goals.flatMap(g => g.actions.map(a => ({ ...a, __goalId: g.id })));
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
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} onPress={handleSvgPress}>
          
          {/* Draw Fake Background Elements */}
          {fakeDots.map((d, i) => (
            <Circle key={`fake-${i}`} cx={d.cx} cy={d.cy} r={d.r} fill={activeNode.color} opacity={d.op} />
          ))}

          {/* Central Active Node */}
          <Circle cx={CENTER} cy={CENTER} r={18} fill={activeNode.color} />
          <Circle cx={CENTER} cy={CENTER} r={28} fill={activeNode.color} opacity={0.2} />
          <Circle cx={CENTER} cy={CENTER} r={40} fill={activeNode.color} opacity={0.05} />

          {/* Render Real Coordinates */}
          {view === 'coordinates' && activeNode.goals.map((goal, i) => {
            const angle = (i / (activeNode.goals.length || 1)) * 2 * Math.PI;
            // Spread them across multiple orbits if there are many
            const radius = 60 + (i % 3) * 30; 
            const cx = CENTER + radius * Math.cos(angle);
            const cy = CENTER + radius * Math.sin(angle);
            const cRadius = 4 + (goal.value / 10) * 4; 

            return (
              <G key={goal.id}>
                {/* Orbit Path */}
                <Circle cx={CENTER} cy={CENTER} r={radius} stroke={activeNode.color} strokeWidth={1} fill="none" strokeDasharray="2 6" opacity={0.1} />
                <Line x1={CENTER} y1={CENTER} x2={cx} y2={cy} stroke={activeNode.color} strokeWidth={1} opacity={0.2} />
                
                {/* Pulsing Aura */}
                <AnimatedCircle 
                  cx={cx} cy={cy} 
                  r={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [cRadius + 2, cRadius + 14] })} 
                  fill={activeNode.color} 
                  opacity={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })} 
                  pointerEvents="none"
                />
                
                {/* Real Coordinate Moon */}
                <Circle cx={cx} cy={cy} r={cRadius} fill={activeNode.color} pointerEvents="none" />
              </G>
            );
          })}

          {/* Render Real Actions directly orbiting the Node */}
          {view === 'actions' && (() => {
            const allActions = activeNode.goals.flatMap(g => g.actions);
            return allActions.map((act, i) => {
              const angle = (i / (allActions.length || 1)) * 2 * Math.PI;
              const radius = 50 + (i % 4) * 25; 
              const cx = CENTER + radius * Math.cos(angle);
              const cy = CENTER + radius * Math.sin(angle);
              const isCompleted = act.completed;

              return (
                <G key={act.id}>
                  {/* Orbit Path */}
                  <Circle cx={CENTER} cy={CENTER} r={radius} stroke={activeNode.color} strokeWidth={1} fill="none" opacity={0.05} />
                  
                  {/* Pulsing Aura for active actions */}
                  {isCompleted && (
                    <AnimatedCircle 
                      cx={cx} cy={cy} 
                      r={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [3, 10] })} 
                      fill={activeNode.color} 
                      opacity={pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })} 
                      pointerEvents="none"
                    />
                  )}
                  
                  <Circle 
                    cx={cx} 
                    cy={cy} 
                    r={isCompleted ? 3 : 2} 
                    fill={isCompleted ? activeNode.color : theme.divider} 
                    opacity={isCompleted ? 1 : 0.6} 
                    pointerEvents="none"
                  />
                </G>
              );
            });
          })()}

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

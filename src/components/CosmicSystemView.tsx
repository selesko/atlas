import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { Node, AtlasGraphView } from '../types';
import { ThemeTokens } from '../constants/theme';

interface CosmicSystemViewProps {
  nodes: Node[];
  view: AtlasGraphView; // 'coordinates' | 'actions'
  theme: ThemeTokens;
}

export function CosmicSystemView({ nodes, view, theme }: CosmicSystemViewProps) {
  // Slow continuous rotation
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 90000, // 90 seconds for a very slow, majestic rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const SVG_SIZE = 340;
  const CENTER = SVG_SIZE / 2;
  const SYSTEM_RADIUS = 95; // Radius of Node orbit around the center

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          
          {/* Central System Star (The User) */}
          <Circle cx={CENTER} cy={CENTER} r={16} fill={theme.text} opacity={0.9} />
          <Circle cx={CENTER} cy={CENTER} r={28} fill={theme.text} opacity={0.15} />
          <Circle cx={CENTER} cy={CENTER} r={40} fill={theme.text} opacity={0.05} />

          {/* Node Orbit Path */}
          <Circle cx={CENTER} cy={CENTER} r={SYSTEM_RADIUS} stroke={theme.divider} strokeWidth={1} fill="none" strokeDasharray="4 6" opacity={0.5} />

          {nodes.map((node, i) => {
            const nodeAngle = (i / nodes.length) * 2 * Math.PI;
            const nx = CENTER + SYSTEM_RADIUS * Math.cos(nodeAngle);
            const ny = CENTER + SYSTEM_RADIUS * Math.sin(nodeAngle);
            
            // Calculate Node size based on score
            const nodeScore = node.goals.length ? node.goals.reduce((s, g) => s + g.value, 0) / node.goals.length : 0;
            const nodeRadius = 8 + (nodeScore / 10) * 8; // 8 to 16

            const COORD_RADIUS = 40; // Orbit radius of Coordinates around the Node

            return (
              <G key={node.id}>
                {/* Gravity tether from center to node */}
                <Line x1={CENTER} y1={CENTER} x2={nx} y2={ny} stroke={node.color} strokeWidth={1} opacity={0.2} />

                {/* Coordinate Orbit Path around the Node */}
                <Circle cx={nx} cy={ny} r={COORD_RADIUS} stroke={node.color} strokeWidth={1} fill="none" opacity={0.2} strokeDasharray="2 4" />

                {/* Draw Coordinates (Moons) */}
                {node.goals.map((goal, j) => {
                  // Offset each moon's orbit so they don't align perfectly with the node's angle
                  const cAngle = (j / (node.goals.length || 1)) * 2 * Math.PI + nodeAngle + 0.5;
                  const cx = nx + COORD_RADIUS * Math.cos(cAngle);
                  const cy = ny + COORD_RADIUS * Math.sin(cAngle);
                  const cRadius = 3 + (goal.value / 10) * 4; // 3 to 7

                  return (
                    <G key={goal.id}>
                      {/* Tether from Node to Coordinate */}
                      <Line x1={nx} y1={ny} x2={cx} y2={cy} stroke={node.color} strokeWidth={1} opacity={0.3} />
                      
                      {/* Coordinate Moon */}
                      <Circle cx={cx} cy={cy} r={cRadius} fill={theme.textMuted} />

                      {/* If zoomed to Actions view, draw Action particles around the Coordinate */}
                      {view === 'actions' && (
                        <G>
                          {/* Inner orbital ring for actions */}
                          <Circle cx={cx} cy={cy} r={cRadius + 8} stroke={node.color} strokeWidth={1} fill="none" opacity={0.3} />
                          
                          {goal.actions.map((act, k) => {
                            const aRadius = cRadius + 8;
                            const aAngle = (k / (goal.actions.length || 1)) * 2 * Math.PI;
                            const ax = cx + aRadius * Math.cos(aAngle);
                            const ay = cy + aRadius * Math.sin(aAngle);
                            const isCompleted = act.completed;

                            return (
                              <Circle 
                                key={act.id} 
                                cx={ax} 
                                cy={ay} 
                                r={isCompleted ? 2 : 1.5} 
                                fill={isCompleted ? node.color : theme.divider} 
                                opacity={isCompleted ? 1 : 0.6} 
                              />
                            );
                          })}
                        </G>
                      )}
                    </G>
                  );
                })}

                {/* Draw the Node Planet (drawn last to be on top of lines) */}
                <Circle cx={nx} cy={ny} r={nodeRadius + 6} fill={node.color} opacity={0.2} />
                <Circle cx={nx} cy={ny} r={nodeRadius} fill={node.color} />
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

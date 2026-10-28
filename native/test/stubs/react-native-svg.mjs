// Stand-in for the shared react-native-svg import in Node.
// Each primitive becomes a host element so a test can look for it by name.
import React from 'react';

const host = (name) => (props) => React.createElement(name, props);

export const Svg = host('Svg');
export const G = host('G');
export const Path = host('Path');
export const Rect = host('Rect');
export const Circle = host('Circle');
export const Ellipse = host('Ellipse');
export const Polygon = host('Polygon');

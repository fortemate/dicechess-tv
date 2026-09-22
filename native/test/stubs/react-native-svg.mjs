// Stand-in for @amazon-devices/react-native-svg in Node, for the same reason.
// Each primitive becomes a host element so a test can look for it by name.
import React from 'react';

const host = (name) => (props) => React.createElement(name, props);

export const Svg = host('Svg');
export const G = host('G');
export const Path = host('Path');
export const Rect = host('Rect');
export const Circle = host('Circle');

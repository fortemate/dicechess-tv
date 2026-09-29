// @amazon-devices/react-native-svg in the browser. The pieces and faces use
// seven elements with plain attributes, which the DOM draws as they are, so
// each component is the SVG element of the same name.
import React from 'react';

type Props = React.PropsWithChildren<Record<string, unknown>>;

const element =
  (tag: string) =>
  ({ children, ...props }: Props) =>
    React.createElement(tag, props, children);

export const Svg = ({ children, ...props }: Props) =>
  React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      ...props,
      style: { display: 'block' },
    },
    children,
  );
export const G = element('g');
export const Path = element('path');
export const Rect = element('rect');
export const Circle = element('circle');
export const Ellipse = element('ellipse');
export const Polygon = element('polygon');

export default Svg;

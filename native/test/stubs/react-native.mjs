// Stand-in for react-native in Node. The real package cannot be imported
// outside a React Native runtime, and these tests are about the tree this
// renderer builds, not about how Vega paints it.
import React from 'react';

export const View = (props) => React.createElement('View', props);
export const Text = (props) => React.createElement('Text', props);
export const useWindowDimensions = () => ({
  width: 960,
  height: 540,
  scale: 2,
  fontScale: 1,
});

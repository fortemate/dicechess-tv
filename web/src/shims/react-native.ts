// react-native, as the screens in native/src/ see it in the browser:
// react-native-web, with one change. The window is the television's, not the
// browser's. Vega reports a 960 x 540 dp screen, and every layout in native/src/
// is worked out from that; the bench draws it on a stage of that size and
// scales the stage to the browser window (see ../stage.ts).
export * from 'react-native-web';

export const TV_WIDTH = 960;
export const TV_HEIGHT = 540;

const TV = { width: TV_WIDTH, height: TV_HEIGHT, scale: 2, fontScale: 1 };

export const useWindowDimensions = () => TV;

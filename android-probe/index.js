import React from 'react';
import { registerRootComponent } from 'expo';
import App from './src/App';
import { PortraitSources } from '../native/src/Portrait';
import { portraitSource } from './src/portraits';
/** Provide bundled portrait sources to every shared Android screen. */
function AndroidApp() {
  return React.createElement(
    PortraitSources.Provider,
    { value: portraitSource },
    React.createElement(App),
  );
}
registerRootComponent(AndroidApp);

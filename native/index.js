import { AppRegistry, LogBox } from 'react-native';
import React from 'react';
import { App } from './src/App';
import { createBotWorker } from './src/botWorker';
import { name as appName } from './app.json';

LogBox.ignoreAllLogs();

const NativeApp = (props) =>
  React.createElement(App, { ...props, createWorker: createBotWorker });
AppRegistry.registerComponent(appName, () => NativeApp);

import { AppRegistry, LogBox } from 'react-native';
import { NetworkProbe } from './src/NetworkProbe';
import { name as appName } from './app.json';

LogBox.ignoreAllLogs();

// Probe branch only (#80): the network probe replaces the game at launch.
AppRegistry.registerComponent(appName, () => NetworkProbe);

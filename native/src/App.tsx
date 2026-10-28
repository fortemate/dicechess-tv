// Vega startup. The browser bench also uses this wrapper through its shims.
import React from 'react';
import { useKeplerAppStateManager } from '@amazon-devices/react-native-kepler';
import { useReportFullyDrawn } from '@amazon-devices/kepler-performance-api';
import { GameApp, type AppProps } from './GameApp';
import { openVegaStorage } from './mmkvStore';

export type { AppProps } from './GameApp';

export const App = (props: AppProps) => {
  const appState = useKeplerAppStateManager();
  const reportFullyDrawn = useReportFullyDrawn();
  const environment = React.useMemo(
    () => ({ appState, reportFullyDrawn, openStorage: openVegaStorage }),
    [appState, reportFullyDrawn],
  );
  return <GameApp {...props} environment={environment} />;
};

import React from 'react';
import { useAndroidVoice } from './useAndroidVoice';
import { TutorialScreen } from '../../native/src/TutorialScreen';
import { LEARN_OPTION, type GameChoice } from '../../native/src/screen';
import type { Activity } from '../../native/src/activity';
import { RemoteSurface } from './RemoteSurface';
import { readHighlights } from '../../native/src/highlightsSetting';
import { createStore } from './store';
import { SETTINGS_STORE } from './soundPreferences';

const report = (detail: string) =>
  console.info(
    '[AndroidTutorial] ' + JSON.stringify({ event: 'state', detail }),
  );

/** Open shared lessons with saved Highlights; only a closing choice can request a real new game. */
export function LearnToPlay({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: (choice: GameChoice | null) => void;
}) {
  const voice = useAndroidVoice(activity);
  const [highlights] = React.useState(() =>
    readHighlights(createStore(SETTINGS_STORE)),
  );
  return (
    <RemoteSurface activity={activity} label={LEARN_OPTION}>
      <TutorialScreen
        voice={voice}
        highlights={highlights}
        onExit={onExit}
        onState={report}
      />
    </RemoteSurface>
  );
}

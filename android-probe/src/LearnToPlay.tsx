import React from 'react';
import { useAndroidVoice } from './useAndroidVoice';
import { TutorialScreen } from '../../native/src/TutorialScreen';
import { LEARN_OPTION, type GameChoice } from '../../native/src/screen';
import type { Activity } from '../../native/src/activity';
import { RemoteSurface } from './RemoteSurface';

const report = (detail: string) =>
  console.info(
    '[AndroidTutorial] ' + JSON.stringify({ event: 'state', detail }),
  );

// The shared tutorial owns its lesson state. It receives no game store or
// worker; only a closing choice can request the normal new-game flow.
export function LearnToPlay({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: (choice: GameChoice | null) => void;
}) {
  const voice = useAndroidVoice(activity);
  return (
    <RemoteSurface activity={activity} label={LEARN_OPTION}>
      <TutorialScreen voice={voice} onExit={onExit} onState={report} />
    </RemoteSurface>
  );
}

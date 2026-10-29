import React from 'react';
import { AboutScreen } from '../../native/src/AboutScreen';
import type { Activity } from '../../native/src/activity';
import { creditsFor } from '../../src/core/credits';
import { RemoteSurface } from './RemoteSurface';

// This probe ships the shared pieces/faces and both effect packs, but no music
// or portraits. Reuse the authors' credit wording; complete Android dependency
// notices are still a distribution gate, so do not claim they ship in this APK.
const content = {
  credits: creditsFor(false).filter(({ subject }) => subject !== 'Music'),
  notices: {
    subject: 'Source code and asset credits',
    line: 'Source and asset notices:',
    source: 'github.com/fortemate/dicechess-tv',
  },
};
const report = (detail: string) =>
  console.info('[AndroidAbout] ' + JSON.stringify({ event: 'state', detail }));

export function About({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: () => void;
}) {
  return (
    <RemoteSurface activity={activity} label="About Dice Chess">
      <AboutScreen content={content} onExit={onExit} onState={report} />
    </RemoteSurface>
  );
}

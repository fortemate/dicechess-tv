import React from 'react';
import { RulesScreen } from '../../native/src/RulesScreen';
import { RULES_OPTION } from '../../native/src/screen';
import type { Activity } from '../../native/src/activity';
import { RemoteSurface } from './RemoteSurface';

const report = (detail: string) =>
  console.info('[AndroidRules] ' + JSON.stringify({ event: 'state', detail }));

// Both entry points render Vega's screen, reducer and canonical rules text.
export function RulesContent({ onExit }: { onExit: () => void }) {
  return <RulesScreen onExit={onExit} onState={report} />;
}

export function RulesReference({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: () => void;
}) {
  return (
    <RemoteSurface activity={activity} label={RULES_OPTION}>
      <RulesContent onExit={onExit} />
    </RemoteSurface>
  );
}

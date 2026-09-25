// A throwaway probe for #80: can the Vega app reach play-api over HTTPS and a
// WebSocket? It runs once at launch and writes what happened on the screen,
// because a Release build sends no console output anywhere readable. It lives
// only on the probe branch and is never merged.
import React from 'react';
import { View, Text } from 'react-native';
import { THEME } from './theme';

const API = 'https://api.fortemate.com';
const WS = 'wss://api.fortemate.com';

type Line = { at: number; text: string };

const clip = (text: string, length = 110) =>
  text.length > length ? `${text.slice(0, length)}…` : text;

export const NetworkProbe = () => {
  const [lines, setLines] = React.useState<Line[]>([]);
  React.useEffect(() => {
    const started = Date.now();
    const say = (text: string) =>
      setLines((all) => [...all, { at: Date.now() - started, text }]);
    let socket: WebSocket | null = null;

    const read = async (path: string) => {
      try {
        const response = await fetch(`${API}${path}`);
        const body = await response.text();
        say(`GET ${path} → ${response.status} ${clip(body)}`);
        return body;
      } catch (error) {
        say(`GET ${path} failed: ${String(error)}`);
        return null;
      }
    };

    const open = (url: string) => {
      say(`WS ${url.replace(WS, '')}`);
      try {
        socket = new WebSocket(url);
      } catch (error) {
        say(`WS constructor threw: ${String(error)}`);
        return;
      }
      let messages = 0;
      socket.onopen = () => say('WS open');
      socket.onmessage = (event) => {
        messages += 1;
        if (messages <= 3)
          say(`WS message ${messages}: ${clip(String(event.data))}`);
      };
      socket.onerror = (event) =>
        say(
          `WS error: ${clip(JSON.stringify((event as { message?: string }).message ?? event))}`,
        );
      socket.onclose = (event) =>
        say(
          `WS close ${event.code} ${event.reason || '(no reason)'} after ${messages} messages`,
        );
    };

    void (async () => {
      await read('/health');
      const showcase = await read('/showcase');
      let url = `${WS}/games/probe/ws?mode=spectator`;
      try {
        const parsed = showcase ? JSON.parse(showcase) : null;
        const live = parsed?.spectator?.wsUrl ?? parsed?.currentGame?.wsUrl;
        if (typeof live === 'string')
          url = live.startsWith('/') ? `${WS}${live}` : live;
      } catch {
        // No live game to watch: the fallback shows whether the handshake happens.
      }
      open(url);
    })();

    return () => {
      socket?.close();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background, padding: 48 }}>
      <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 2 }}>
        NETWORK PROBE · #80
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ color: '#f0f4f8', fontSize: 18, marginTop: 8 }}>
          {`${String(line.at).padStart(5)} ms  ${line.text}`}
        </Text>
      ))}
    </View>
  );
};

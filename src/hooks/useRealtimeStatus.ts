"use client";

/**
 * Global realtime-connection status.
 *
 * A module-level Set tracks every subscribed channel name — hooks add
 * their name on subscribe, remove on cleanup. useRealtimeStatus() reads
 * the count. When ≥ 1 channel is subscribed we call the connection
 * "live" and the TopBar renders its green dot.
 */

import { useEffect, useState } from "react";

const subscribers = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function registerRealtimeChannel(name: string): () => void {
  subscribers.add(name);
  emit();
  return () => {
    subscribers.delete(name);
    emit();
  };
}

export function useRealtimeStatus(): { live: boolean; channels: number } {
  const [state, setState] = useState({
    live: subscribers.size > 0,
    channels: subscribers.size,
  });

  useEffect(() => {
    const update = () =>
      setState({ live: subscribers.size > 0, channels: subscribers.size });
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return state;
}

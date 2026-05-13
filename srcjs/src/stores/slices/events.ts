// Typed pub/sub event emitter.
//
// Pure data structure — no Svelte runes, no DOM. The store wraps this
// in a slice and fires typed events from $effect blocks; consumers
// (Shiny adapter, future JS API) subscribe with `on(event, cb)` and
// receive typed payloads.
//
// Why a separate utility (no `$state`): event subscribers care about
// edge-triggered notifications, not level-triggered reactivity. The
// store's reactive state stays reactive; the emitter fires when state
// transitions happen. This matches how external consumers think
// (event callbacks) rather than the Svelte-internal $effect model.

/** Map of event-name → payload type. Used as a generic constraint. */
export type EventMap = Record<string, unknown>;

/** Callback fired when an event is emitted. */
export type EventListener<T> = (payload: T) => void;

/** Returned by `on()`; call to remove the listener. */
export type Unsubscribe = () => void;

export interface EventEmitter<TEvents extends EventMap> {
  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Unsubscribe;
  /** Fire an event, synchronously notifying every current listener. */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
  /** Remove every listener for every event. */
  destroy(): void;
}

export function createEventEmitter<TEvents extends EventMap>(): EventEmitter<TEvents> {
  // Listener sets keyed by event name. `Set` so unsubscribe is O(1) and
  // duplicate listeners aren't possible.
  const listeners = new Map<keyof TEvents, Set<EventListener<unknown>>>();

  function getSet<K extends keyof TEvents>(event: K): Set<EventListener<unknown>> {
    let s = listeners.get(event);
    if (!s) {
      s = new Set();
      listeners.set(event, s);
    }
    return s;
  }

  return {
    on<K extends keyof TEvents>(event: K, listener: EventListener<TEvents[K]>): Unsubscribe {
      const set = getSet(event);
      set.add(listener as EventListener<unknown>);
      return () => set.delete(listener as EventListener<unknown>);
    },
    emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
      const set = listeners.get(event);
      if (!set) return;
      // Snapshot before iterating so a listener can unsubscribe without
      // breaking the loop. Defensive copy is cheap (small N).
      for (const cb of [...set]) {
        try {
          (cb as EventListener<TEvents[K]>)(payload);
        } catch (err) {
          // Don't let one bad listener take down the others. Surface in
          // console so a misbehaving subscriber is still noticeable.
          // eslint-disable-next-line no-console
          console.error("[tabviz events] listener threw:", err);
        }
      }
    },
    destroy(): void {
      listeners.clear();
    },
  };
}

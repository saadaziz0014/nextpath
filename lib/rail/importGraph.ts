import { bearing } from '@turf/turf';
import type { Coordinate } from '../routeData';
export interface RailEdge { to: number; km: number }

/** Search the entire ordered itinerary, rather than concatenating independent
 * shortest paths. An anchor may be passed on any connected platform track.
 * Keeping the incoming edge in the search state prevents reversing at anchors
 * and taking physically impossible near-180-degree switch movements. */
export function routeThroughAnchors(
  nodes: ReadonlyMap<number, Coordinate>, edges: ReadonlyMap<number, RailEdge[]>,
  starts: { id: number; km: number }[], targets: ReadonlySet<number>[],
) {
  interface State { id: number; previous: number | null; stage: number; km: number; parent?: State }
  const heap: State[] = [], costs = new Map<string, number>();
  const key = (state: State) => `${state.previous}:${state.id}:${state.stage}`;
  function push(state: State) {
    while (state.stage < targets.length && targets[state.stage].has(state.id)) state.stage++;
    const identity = key(state);
    if (state.km >= (costs.get(identity) ?? Infinity)) return;
    costs.set(identity, state.km);
    heap.push(state); let i = heap.length - 1;
    while (i > 0) { const parent = (i - 1) >>> 1; if (heap[parent].km <= state.km) break; heap[i] = heap[parent]; i = parent; }
    heap[i] = state;
  }
  function pop() {
    const root = heap[0], tail = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].km < heap[child].km) child++;
        if (heap[child].km >= tail.km) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = tail;
    }
    return root;
  }
  for (const start of starts) push({ ...start, previous: null, stage: 0 });
  while (heap.length) {
    const state = pop();
    if (state.km !== costs.get(key(state))) continue;
    if (state.stage === targets.length) {
      const ids: number[] = [];
      for (let cursor: State | undefined = state; cursor; cursor = cursor.parent) ids.push(cursor.id);
      return ids.reverse();
    }
    for (const edge of edges.get(state.id) ?? []) {
      if (state.previous !== null) {
        if (edge.to === state.previous) continue;
        const incoming = bearing(nodes.get(state.previous)!, nodes.get(state.id)!);
        const outgoing = bearing(nodes.get(state.id)!, nodes.get(edge.to)!);
        const turn = Math.abs(((outgoing - incoming + 540) % 360) - 180);
        if (turn > 100) continue;
      }
      push({ id: edge.to, previous: state.id, stage: state.stage, km: state.km + edge.km, parent: state });
    }
  }
  throw new Error('No connected rail itinerary through all anchors without reversing. Check source coverage; no gap repair is allowed.');
}

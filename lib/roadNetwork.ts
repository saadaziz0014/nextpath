import { along, bearing, distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { Feature, Geometry } from 'geojson';
import type { Coordinate } from './routeData';
import { roadLevelFromProperties, type RoadLevel } from './roadLevel';

export type Turn = 'left' | 'straight' | 'right';
export interface RoadEdge { id: string; from: string; to: string; a: Coordinate; b: Coordinate; km: number; heading: number; name: string; level: string; roadLevel: RoadLevel }
export interface RoadCursor { edgeId: string; km: number; history: string[] }
export interface JunctionDecision { nodeId: string; edgeId: string; turn: Turn }
export interface Junction { nodeId?: string; meters: number; choices: { turn: Turn; edge: RoadEdge; angle: number }[] }
const DRIVABLE = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'street', 'street_limited', 'service']);
const delta = (from: number, to: number) => ((to - from + 540) % 360) - 180;
const CELL = .0005; // ~50m index cells; connection tolerance remains only one metre.
const cellKey = (x: number, y: number, level: string) => [x, y, level].join(':');
const key = (point: Coordinate, level: string) => `${point[0].toFixed(6)},${point[1].toFixed(6)}:${level}`;
const turnOf = (angle: number): Turn => angle < -30 ? 'left' : angle > 30 ? 'right' : 'straight';

/** A local graph of actual road centerlines from loaded Mapbox Streets tiles.
 * Navigation traverses connected edges, never a free-space destination point.
 * Grade keys prevent a crossing bridge/tunnel becoming a ground intersection.
 * This is a driving simulation, not a traffic/turn-restriction routing engine.
 */
export class RoadNetwork {
  edges = new Map<string, RoadEdge>();
  outgoing = new Map<string, Set<string>>();
  private seen = new Set<string>();
  private paths = new Map<string, Set<string>>();
  private nodes = new Map<string, { point: Coordinate; level: string }>();
  private nodeCells = new Map<string, Set<string>>();
  private edgeCells = new Map<string, Set<string>>();
  // Keep old edges for cursors/history; replacements resolve them without teleporting.
  private replacements = new Map<string, { first: string; second: string; splitKm: number }>();
  private changedEdges = new Set<string>();
  private endpoints = new Map<string, Set<string>>();
  private gradeConnections = new Map<string, Set<string>>();

  private registerEndpoint(point: Coordinate, level: string) {
    if (!point.every(Number.isFinite)) return;
    const id = this.node(point, level);
    // Only shared source endpoints establish a grade transition. Interior
    // vertices and projected crossings remain isolated by their grade.
    const location = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
    const endpoints = this.endpoints.get(location) ?? new Set<string>();
    for (const other of endpoints) {
      const otherLevel = this.nodes.get(other)!.level;
      if (level === otherLevel || (level !== '0' && otherLevel !== '0')) continue;
      if (!this.gradeConnections.has(id)) this.gradeConnections.set(id, new Set());
      if (!this.gradeConnections.has(other)) this.gradeConnections.set(other, new Set());
      this.gradeConnections.get(id)!.add(other);
      this.gradeConnections.get(other)!.add(id);
    }
    endpoints.add(id);
    this.endpoints.set(location, endpoints);
  }

  private cells(a: Coordinate, b: Coordinate, level: string) {
    const result: string[] = [];
    for (let x = Math.floor(Math.min(a[0], b[0]) / CELL) - 1; x <= Math.floor(Math.max(a[0], b[0]) / CELL) + 1; x++) {
      for (let y = Math.floor(Math.min(a[1], b[1]) / CELL) - 1; y <= Math.floor(Math.max(a[1], b[1]) / CELL) + 1; y++) result.push(cellKey(x, y, level));
    }
    return result;
  }

  private node(point: Coordinate, level: string) {
    // Adjacent vector tiles quantize the same junction slightly differently.
    // Merge only within 1m and on the same grade, never across parallel lanes.
    for (const cell of this.cells(point, point, level)) {
      for (const id of this.nodeCells.get(cell) ?? []) {
        if (distance(point, this.nodes.get(id)!.point) <= .001) return id;
      }
    }
    const id = key(point, level);
    this.nodes.set(id, { point, level });
    const cell = cellKey(Math.floor(point[0] / CELL), Math.floor(point[1] / CELL), level);
    if (!this.nodeCells.has(cell)) this.nodeCells.set(cell, new Set());
    this.nodeCells.get(cell)!.add(id);
    return id;
  }

  private resolve(cursor: RoadCursor): RoadCursor {
    let edgeId = cursor.edgeId, km = cursor.km;
    while (this.replacements.has(edgeId)) {
      const split = this.replacements.get(edgeId)!;
      if (km < split.splitKm) edgeId = split.first;
      else { km -= split.splitKm; edgeId = split.second; }
    }
    return { ...cursor, edgeId, km };
  }

  private connectJunctions() {
    const candidates = new Set<string>();
    for (const id of this.changedEdges) {
      const edge = this.edges.get(id)!;
      for (const cell of this.cells(edge.a, edge.b, edge.level)) {
        for (const node of this.nodeCells.get(cell) ?? []) candidates.add(node);
      }
    }
    this.changedEdges.clear();
    for (const nodeId of candidates) {
      const node = this.nodes.get(nodeId)!;
      const nearby = new Set<string>();
      for (const cell of this.cells(node.point, node.point, node.level)) {
        for (const id of this.edgeCells.get(cell) ?? []) nearby.add(id);
      }
      for (const id of nearby) {
        const edge = this.edges.get(id)!;
        if (this.replacements.has(id) || edge.from === nodeId || edge.to === nodeId) continue;
        const projection = nearestPointOnLine(lineString([edge.a, edge.b]), node.point);
        const km = projection.properties.location ?? 0;
        if ((projection.properties.dist ?? Infinity) > .001 || km < .001 || edge.km - km < .001) continue;
        // A T-junction can end inside another road segment without a matching vertex.
        // Split both directed edges independently, retaining one-way restrictions.
        const first = this.addEdge(edge.a, node.point, edge.level, edge.name, edge.roadLevel);
        const second = this.addEdge(node.point, edge.b, edge.level, edge.name, edge.roadLevel);
        if (!first || !second) continue;
        for (const path of this.paths.get(id) ?? []) {
          this.recordPath(first, path); this.recordPath(second, path);
        }
        this.outgoing.get(edge.from)?.delete(id);
        this.replacements.set(id, { first, second, splitKm: this.edges.get(first)!.km });
      }
    }
    this.changedEdges.clear();
  }

  ingest(features: Feature<Geometry>[]) {
    for (const feature of features) {
      const properties = feature.properties ?? {};
      if (!DRIVABLE.has(String(properties.class)) || properties.access === 'restricted') continue;
      const geometry = feature.geometry;
      const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : [];
      const level = String(properties.layer ?? (properties.structure === 'bridge' ? 1 : properties.structure === 'tunnel' ? -1 : 0));
      const roadLevel = roadLevelFromProperties(properties);
      for (const coordinates of lines) {
        const signature = `${level}:${properties.oneway}:${JSON.stringify(coordinates)}`;
        if (this.seen.has(signature)) continue;
        this.seen.add(signature);
        if (coordinates.length >= 2) {
          this.registerEndpoint(coordinates[0] as Coordinate, level);
          this.registerEndpoint(coordinates[coordinates.length - 1] as Coordinate, level);
        }
        for (let i = 1; i < coordinates.length; i++) {
          const a = coordinates[i - 1] as Coordinate, b = coordinates[i] as Coordinate;
          if (!a.every(Number.isFinite) || !b.every(Number.isFinite) || distance(a, b) < .0001) continue;
          const forward = this.addEdge(a, b, level, String(properties.name ?? properties.ref ?? 'Unnamed road'), roadLevel);
          if (forward) this.recordPath(forward, signature);
          if (properties.oneway !== 'true' && properties.oneway !== true) {
            const reverse = this.addEdge(b, a, level, String(properties.name ?? properties.ref ?? 'Unnamed road'), roadLevel);
            if (reverse) this.recordPath(reverse, signature);
          }
        }
      }
    }
    this.connectJunctions();
  }

  private addEdge(a: Coordinate, b: Coordinate, level: string, name: string, roadLevel: RoadLevel) {
    const from = this.node(a, level), to = this.node(b, level), id = `${from}>${to}`;
    if (from === to) return null;
    if (this.edges.has(id)) return id;
    a = this.nodes.get(from)!.point; b = this.nodes.get(to)!.point;
    this.edges.set(id, { id, from, to, a, b, km: distance(a, b), heading: (bearing(a, b) + 360) % 360, name, level, roadLevel });
    if (!this.outgoing.has(from)) this.outgoing.set(from, new Set());
    this.outgoing.get(from)!.add(id);
    for (const cell of this.cells(a, b, level)) {
      if (!this.edgeCells.has(cell)) this.edgeCells.set(cell, new Set());
      this.edgeCells.get(cell)!.add(id);
    }
    this.changedEdges.add(id);
    return id;
  }

  nearest(position: Coordinate, heading: number, maximumMeters = 20): RoadCursor | null {
    let best: { score: number; cursor: RoadCursor } | null = null;
    for (const edge of this.edges.values()) {
      if (this.replacements.has(edge.id)) continue;
      const point = nearestPointOnLine(lineString([edge.a, edge.b]), position, { units: 'kilometers' });
      const meters = (point.properties.dist ?? Infinity) * 1000;
      if (meters > maximumMeters) continue;
      const score = meters + Math.abs(delta(heading, edge.heading)) / 25;
      if (!best || score < best.score) best = { score, cursor: { edgeId: edge.id, km: point.properties.location ?? 0, history: [] } };
    }
    return best?.cursor ?? null;
  }

  sample(cursor: RoadCursor) {
    cursor = this.resolve(cursor);
    const edge = this.edges.get(cursor.edgeId)!;
    const km = Math.max(0, Math.min(edge.km, cursor.km));
    const position = km === edge.km ? edge.b : along(lineString([edge.a, edge.b]), km).geometry.coordinates as Coordinate;
    return { position, heading: edge.heading, name: edge.name, roadLevel: edge.roadLevel };
  }

  private recordPath(id: string, path: string) {
    if (!this.paths.has(id)) this.paths.set(id, new Set());
    this.paths.get(id)!.add(path);
    // Already-split edges may also arrive from another tile/feature later.
    const split = this.replacements.get(id);
    if (split) { this.recordPath(split.first, path); this.recordPath(split.second, path); }
  }

  private followsGeometry(incoming: RoadEdge, outgoing: RoadEdge, angle: number) {
    // A 30-degree bearing cutoff alone mistakes curved road geometry for a
    // junction turn. Preserve continuity only with evidence from the same
    // source polyline, and still reject sharp corners and U-turns. Road names
    // alone are insufficient: two side roads can share the same street name.
    if (Math.abs(angle) > 65) return false;
    const paths = this.paths.get(outgoing.id);
    return [...(this.paths.get(incoming.id) ?? [])].some(path => paths?.has(path));
  }
  private choices(edge: RoadEdge) {
    const nodes = [edge.to, ...(this.gradeConnections.get(edge.to) ?? [])];
    return [...new Set(nodes.flatMap(node => [...(this.outgoing.get(node) ?? [])]))].map(id => this.edges.get(id)!)
      .filter(next => next.to !== edge.from && !this.gradeConnections.get(edge.from)?.has(next.to))
      .map(next => {
        const angle = delta(edge.heading, next.heading);
        return { edge: next, angle, turn: this.followsGeometry(edge, next, angle) ? 'straight' as const : turnOf(angle) };
      });
  }

  junction(cursor: RoadCursor, maximumMeters = 150): Junction | null {
    cursor = this.resolve(cursor);
    let edge = this.edges.get(cursor.edgeId);
    if (!edge) return null;
    let meters = (edge.km - cursor.km) * 1000;
    const visited = new Set<string>();
    while (meters <= maximumMeters && !visited.has(edge.id)) {
      visited.add(edge.id);
      const choices = this.choices(edge);
      if (choices.length !== 1 || choices[0].turn !== 'straight') return { nodeId: edge.to, meters, choices };
      edge = choices[0].edge; meters += edge.km * 1000;
    }
    return null;
  }

  decide(cursor: RoadCursor, turn: Turn): JunctionDecision | null {
    const junction = this.junction(cursor);
    if (!junction || junction.meters > 50) return null;
    const choice = junction.choices.filter(choice => choice.turn === turn).sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0];
    return choice ? { nodeId: junction.nodeId ?? choice.edge.from, edgeId: choice.edge.id, turn } : null;
  }
  advance(cursor: RoadCursor, signedKm: number, requestedTurn: Turn | null, decision: JunctionDecision | null = null) {
    let current = { ...this.resolve(cursor), history: [...cursor.history] };
    let remaining = signedKm, movedKm = 0, queuedTurn = requestedTurn;
    let blocked: string | null = null;
    // A tile split can resolve a cursor already at the node directly onto the
    // chosen outgoing segment. Treat that as passage too, so the lock releases.
    const selectedStart = decision ? this.resolve({ edgeId: decision.edgeId, km: 0, history: [] }) : null;
    let decisionPassed = !!decision && current.edgeId === selectedStart?.edgeId && (this.edges.get(current.edgeId)?.from === decision.nodeId || !!this.gradeConnections.get(decision.nodeId)?.has(this.edges.get(current.edgeId)!.from));
    for (let transitions = 0; Math.abs(remaining) > 1e-12 && transitions < 100; transitions++) {
      current = this.resolve(current);
      const edge = this.edges.get(current.edgeId);
      if (!edge) { blocked = 'Waiting for road data'; break; }
      if (remaining < 0) {
        const amount = Math.min(-remaining, current.km);
        current.km -= amount; remaining += amount; movedKm += amount;
        if (remaining >= -1e-12) break;
        const previous = current.history.pop();
        if (!previous || !this.edges.has(previous)) { blocked = 'Start of driven road — move forward'; break; }
        current.edgeId = previous; current.km = this.edges.get(previous)!.km;
        continue;
      }
      const amount = Math.min(remaining, Math.max(0, edge.km - current.km));
      current.km += amount; remaining -= amount; movedKm += amount;
      if (remaining <= 1e-12) break;
      const choices = this.choices(edge);

      // Only a forward exit is automatic. Never pick the least sharp side road
      // as a fallback: a T-junction (even with one legal exit) requires A/D.
      const isJunction = choices.length > 1 || (choices.length === 1 && choices[0].turn !== 'straight');
      const requested = isJunction && queuedTurn ? choices.filter(choice => choice.turn === queuedTurn).sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0] : undefined;
      const ahead = choices.filter(choice => choice.turn === 'straight').sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0];
      // A prompt commits an actual connected edge, not a heading category that
      // may change when another tile arrives. Follow that exact road at its node.
      let next: RoadEdge | undefined = (requested ?? ahead)?.edge;
      const atDecision = !decisionPassed && decision?.nodeId === edge.to;
      if (atDecision && decision) {
        const resolved = this.resolve({ edgeId: decision.edgeId, km: 0, history: [] });
        const committed = this.edges.get(resolved.edgeId);
        next = committed && choices.some(choice => choice.edge.id === committed.id) ? committed : undefined;
      }
      if (requested) queuedTurn = null;
      if (!next) {
        blocked = choices.length ? 'No road ahead — choose an available turn with A/D' : 'Road ends or tiles are loading — brake or reverse';
        break;
      }
      if (atDecision) { decisionPassed = true; queuedTurn = null; }
      current.history.push(edge.id); current.edgeId = next.id; current.km = 0;
    }
    return { cursor: current, movedKm, queuedTurn, blocked, decisionPassed };
  }
}










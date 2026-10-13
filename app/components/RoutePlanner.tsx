'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Crosshair, LocateFixed, LoaderCircle, Search, X } from 'lucide-react';
import type { Coordinate } from '@/lib/routeData';
import { searchPlaces, type Place } from '@/lib/routes';

export type Endpoint = 'start' | 'end';
export interface PlaceDraft { query: string; place: Place | null }

function PlaceSearch({ label, draft, token, disabled, onEdit, onSelect, onPick, country, getSearchProximity, locating, onUseLocation }: {
  locating: boolean; onUseLocation: () => void;
  country: 'pk' | 'worldwide'; getSearchProximity: () => Coordinate;
  label: string; draft: PlaceDraft; token: string; disabled: boolean;
  onEdit: (query: string) => void; onSelect: (place: Place) => void; onPick: () => void;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.query.trim().length < 2) return;
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null); setResults([]); setResultQuery(draft.query);
    try {
      const places = await searchPlaces(draft.query.trim(), token, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), { country, proximity: getSearchProximity() });
      if (controller.signal.aborted) return;
      setResults(places);
      if (!places.length) setError(country === 'pk' ? 'No matching places in Pakistan. Add a city name, try Worldwide, or pick on the map.' : 'No places found. Add a city name or pick on the map.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === 'TimeoutError' ? 'Search timed out. Try again.' : failure instanceof Error ? failure.message : 'Search failed.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <div>
    <form onSubmit={search}>
      <label className="mb-1.5 block text-xs text-slate-400" htmlFor={`place-${label}`}>{label}</label>
      <div className="flex gap-2">
        <input id={`place-${label}`} value={draft.query} onChange={event => { requestRef.current?.abort(); setLoading(false); setResults([]); setError(null); onEdit(event.target.value); }} placeholder="Place or latitude, longitude" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm" />
        <button type="submit" disabled={disabled || loading || draft.query.trim().length < 2} aria-label={`Search ${label.toLowerCase()}`} className="rounded-lg border border-slate-600 px-2 disabled:opacity-40">{loading ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}</button>
        <button type="button" onClick={onPick} disabled={disabled} aria-label={`Pick ${label.toLowerCase()} on map`} className="rounded-lg border border-slate-600 px-2 text-sky-300 disabled:opacity-40"><Crosshair size={17} /></button>
      </div>
    </form>
    <button type="button" onClick={onUseLocation} disabled={disabled || locating} aria-label={`Use my location as ${label.toLowerCase()}`} className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-sky-300 hover:text-sky-200 disabled:opacity-40">{locating ? <LoaderCircle size={14} className="animate-spin" /> : <LocateFixed size={14} />}{locating ? 'Finding your location...' : 'Use my location'}</button>
    {results.length > 0 && resultQuery === draft.query && <ul aria-label={`${label} search results`} className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950">{results.map((place, index) => <li key={`${place.coordinate.join(',')}-${index}`}><button onClick={() => { onSelect(place); setResults([]); setError(null); }} className="w-full border-b border-slate-800 px-3 py-2 text-left text-xs hover:bg-slate-800">{place.label}</button></li>)}</ul>}
    {error && <p role="alert" className="mt-2 text-xs text-amber-300">{error}</p>}
  </div>;
}

interface Props {
  locating: Endpoint | null; locationError: string | null; onUseLocation: (endpoint: Endpoint) => void;
  getSearchProximity: () => Coordinate;
  token: string; start: PlaceDraft; end: PlaceDraft; picking: Endpoint | null;
  freeDriving: boolean; onFreeDrive: () => void;
  loading: boolean; ready: boolean; error: string | null; hasRoute: boolean;
  onEdit: (endpoint: Endpoint, query: string) => void;
  onSelect: (endpoint: Endpoint, place: Place) => void;
  onPick: (endpoint: Endpoint | null) => void;
  onBuild: () => void; onPreset: () => void; onOverview: () => void;
}
export default function RoutePlanner({ locating, locationError, onUseLocation, getSearchProximity, token, start, end, picking, loading, ready, error, hasRoute, freeDriving, onFreeDrive, onEdit, onSelect, onPick, onBuild, onPreset, onOverview }: Props) {
  const [country, setCountry] = useState<'pk' | 'worldwide'>('pk');
  const [expanded, setExpanded] = useState(false);
  return <section aria-label="Route planner" className="glass absolute left-3 right-14 top-3 z-20 rounded-2xl sm:left-6 sm:right-auto sm:top-6 sm:w-96">
    <button onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><div><p className="text-sm font-semibold">NextPath <span className="ml-2 text-xs font-normal text-sky-300">{freeDriving ? 'Free drive' : 'Plan a journey'}</span></p><p className="mt-1 truncate text-[11px] text-slate-400">{start.place?.label ?? 'Choose start'}{!freeDriving && <> → {end.place?.label ?? 'Choose destination'}</>}</p></div>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
    {expanded && <div className="max-h-[calc(100dvh-470px)] space-y-3 overflow-y-auto border-t border-slate-700/60 p-4">
      <label className="flex items-center justify-between gap-2 text-xs text-slate-300">Search region<select aria-label="Search region" value={country} onChange={event => setCountry(event.target.value as 'pk' | 'worldwide')} className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2"><option value="pk">Pakistan</option><option value="worldwide">Worldwide</option></select></label>
      <p className="text-[11px] text-slate-400">Nearby results are prioritized using the map view. Add a city name for a distant place.</p>
      <PlaceSearch locating={locating === 'start'} onUseLocation={() => onUseLocation('start')} key={`${country}-start`} country={country} getSearchProximity={getSearchProximity} label="Start" draft={start} token={token} disabled={!ready || loading} onEdit={query => onEdit('start', query)} onSelect={place => onSelect('start', place)} onPick={() => { onPick('start'); setExpanded(false); }} />
      <button disabled={!ready || loading || !start.place} onClick={() => { onFreeDrive(); setExpanded(false); }} className="w-full rounded-xl border border-sky-400 px-4 py-2.5 text-sm font-semibold text-sky-300 disabled:opacity-40">Free drive from start</button>
      <p className="text-[11px] text-slate-400">Explore nearby roads without a destination, or plan a route below.</p>
      <PlaceSearch locating={locating === 'end'} onUseLocation={() => onUseLocation('end')} key={`${country}-end`} country={country} getSearchProximity={getSearchProximity} label="Destination" draft={end} token={token} disabled={!ready || loading} onEdit={query => onEdit('end', query)} onSelect={place => onSelect('end', place)} onPick={() => { onPick('end'); setExpanded(false); }} />
      {locating && <p role="status" className="text-xs text-sky-300">Allow location access in your browser to set your {locating === 'start' ? 'start' : 'destination'}.</p>}
      {locationError && <p role="alert" className="text-xs text-amber-300">{locationError}</p>}
      <p className="text-[11px] text-slate-500">Search then choose a result, or use the target buttons to pick on the map.</p>
      <button disabled={!ready || loading || !start.place || !end.place} onClick={() => { onBuild(); setExpanded(false); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{loading && <LoaderCircle size={16} className="animate-spin" />}{loading ? 'Finding road route…' : 'Build road route'}</button>
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      <div className="flex justify-between gap-3 text-xs"><button disabled={loading} onClick={onPreset} className="text-slate-400 underline underline-offset-4 disabled:opacity-40">Lahore → Karachi example</button>{hasRoute && <button onClick={onOverview} className="text-sky-300">Route overview</button>}</div>
    </div>}
    {loading && !expanded && <p role="status" className="border-t border-slate-700 px-4 py-3 text-xs text-sky-300">Finding road route…</p>}
    {locating && !expanded && <p role="status" className="border-t border-slate-700 px-4 py-3 text-xs text-sky-300">Finding your location for {locating === 'start' ? 'start' : 'destination'}...</p>}
    {locationError && !expanded && <div role="alert" className="border-t border-slate-700 px-4 py-3 text-xs text-amber-300">{locationError}<button onClick={() => setExpanded(true)} className="ml-2 underline">Edit journey</button></div>}
    {error && !expanded && <div role="alert" className="border-t border-slate-700 px-4 py-3 text-xs text-amber-300">{error}<button onClick={() => setExpanded(true)} className="ml-2 underline">Edit route</button></div>}
    {picking && <div role="status" className="flex items-center justify-between gap-2 border-t border-slate-700 bg-sky-950/70 px-4 py-3 text-xs text-sky-200">Click the map to set your {picking === 'start' ? 'start' : 'destination'}.<button onClick={() => onPick(null)} aria-label="Cancel map selection"><X size={16} /></button></div>}
  </section>;
}






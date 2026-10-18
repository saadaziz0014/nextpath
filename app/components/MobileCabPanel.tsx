'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, LocateFixed, Volume2 } from 'lucide-react';

export default function MobileCabPanel({ children, speed, active, paused, onPause, onFollow, onSound, following, sound, status, onOverview }: {
  children?: ReactNode; speed: number; active: boolean; paused: boolean; onPause: () => void;
  onFollow: () => void; onSound: () => void; following: boolean; sound: boolean;
  status: string; onOverview: () => void;
}) {
  const [choice, setChoice] = useState({ active, expanded: false });
  if (choice.active !== active) setChoice({ active, expanded: false });
  const expanded = choice.active === active ? choice.expanded || !active : !active;
  const id = useId();
  return <div data-selecting={!active} className={`mobile-cab-panel ${expanded ? 'cab-expanded' : ''}`}>
    <div className="mobile-cab-toolbar">
      <strong>{Math.abs(speed * 3.6).toFixed(0)} <small>km/h</small></strong>
      {active && <button type="button" onClick={onPause} aria-label={paused ? 'Resume simulation' : 'Pause simulation'}>{paused ? <Play size={18}/> : <Pause size={18}/>}</button>}
      {active && <button type="button" onClick={onFollow} aria-label="Follow vehicle" aria-pressed={following}><LocateFixed size={18}/></button>}
      {active && <button type="button" onClick={onSound} aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound}><Volume2 size={18}/></button>}
      {active ? <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setChoice({ active, expanded: !expanded })}>
        {expanded ? 'Hide cab' : active ? 'Cab settings' : 'Choose journey'}
        {expanded ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
      </button> : <span className="mobile-journey-title">Choose your journey</span>}
    </div>
    {active && <p className="mobile-drive-status">{paused ? 'Paused · ' : ''}{status}</p>}
    <div id={id} className="mobile-cab-content"><button type="button" className="mobile-line-overview" onClick={onOverview}>Line overview</button>{children}</div>
  </div>;
}

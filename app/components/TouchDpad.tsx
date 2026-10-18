'use client';

import { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  DoorClosed,
  Megaphone,
  Gauge,
  ArrowUpDown,
  Sparkles,
  Gamepad2,
  X,
} from 'lucide-react';

/**
 * Floating on-screen driving controls for mobile / touch devices.
 *
 * Provides responsive touch-enabled arrow controls for all 4 NextPath modes:
 * - `road`: 4-way arrow cross (Up: W, Down: S, Left: A, Right: D)
 * - `rail`: Vertical arrows (Up: W, Down: S) + action buttons (Cruise: C, Reverser: V, Horn: H)
 * - `transit`: Vertical arrows (Up: W, Down: S) + action buttons (Doors: O, Auto stops: T, Horn: H)
 *
 * All hold buttons (W, S, Horn) use pointer capture (`setPointerCapture`) so that
 * dragging or releasing anywhere reliably ends traction/braking without stuck keys.
 */
export interface TouchDpadProps {
  /** Mode determines button layout and available action buttons */
  mode: 'road' | 'rail' | 'transit';
  /** Whether the simulation is active and driving */
  active: boolean;
  sessionActive?: boolean;

  /** W key press/release (Accelerate / Power) */
  onAccelerate: (pressed: boolean) => void;
  /** S key press/release (Brake / Reverse) */
  onBrake: (pressed: boolean) => void;
  /** A key press (road turn left) */
  onLeft?: () => void;
  /** D key press (road turn right) */
  onRight?: () => void;

  /** Extra disabled checks */
  upDisabled?: boolean;
  downDisabled?: boolean;
  leftDisabled?: boolean;
  rightDisabled?: boolean;

  // Rail-specific actions
  onCruise?: () => void;
  cruiseActive?: boolean;
  onReverser?: () => void;
  reverserBacking?: boolean;
  reverserDisabled?: boolean;

  // Transit-specific actions (Metro & Bus)
  onDoors?: () => void;
  doorsOpen?: boolean;
  doorsDisabled?: boolean;
  onAutomatic?: () => void;
  automaticActive?: boolean;

  // Audio action
  onHorn?: (pressed: boolean) => void;
  hornDisabled?: boolean;
}

function HoldButton({
  label,
  icon,
  onPress,
  disabled,
  className = '',
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`touch-dpad-btn relative ${className}`}
      onPointerDown={event => {
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        onPress(true);
      }}
      onPointerUp={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
      onLostPointerCapture={() => onPress(false)}
    >
      {icon}
      {badge && <span className="touch-dpad-badge">{badge}</span>}
      {badge && <span className="touch-dpad-caption">{({ W: 'Power', S: 'Brake', H: 'Horn', C: 'Cruise', V: 'Reverse', O: 'Doors', T: 'Auto', A: 'Left', D: 'Right' } as Record<string, string>)[badge]}</span>}
    </button>
  );
}

function TapButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  className = '',
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={event => {
        event.preventDefault();
        onClick();
      }}
      className={`touch-dpad-btn relative ${active ? 'touch-dpad-btn-active' : ''} ${className}`}
    >
      {icon}
      {badge && <span className="touch-dpad-badge">{badge}</span>}
      {badge && <span className="touch-dpad-caption">{({ O: 'Doors', T: 'Auto', C: 'Cruise', V: 'Reverse', A: 'Left', D: 'Right' } as Record<string, string>)[badge]}</span>}
    </button>
  );
}

export default function TouchDpad(props: TouchDpadProps) {
  const {
    mode,
    active,
    onAccelerate,
    onBrake,
    onLeft,
    onRight,
    upDisabled,
    downDisabled,
    leftDisabled,
    rightDisabled,
    onCruise,
    cruiseActive,
    onReverser,
    reverserBacking,
    reverserDisabled,
    onDoors,
    doorsOpen,
    doorsDisabled,
    onAutomatic,
    automaticActive,
    onHorn,
    hornDisabled,
  } = props;

  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div className="touch-dpad" role="group" aria-label="Touch controls">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand on-screen driving controls"
          className="touch-dpad-pill"
        >
          <Gamepad2 size={18} />
          <span>Drive</span>
        </button>
      </div>
    );
  }

  const showLateral = mode === 'road' && !!onLeft && !!onRight;
  const showRailActions = mode === 'rail' && (!!onCruise || !!onReverser || !!onHorn);
  const showTransitActions = mode === 'transit' && (!!onDoors || !!onAutomatic || !!onHorn);

  return (
    <aside className={`touch-dpad touch-dpad-${mode}`} aria-label="On-screen driving controls" role="region">
      {/* Header bar with minimize toggle */}
      <div className="touch-dpad-bar">
        <span className="touch-dpad-label">
          {mode === 'road' ? 'Drive' : mode === 'rail' ? 'Train' : 'Transit'}
        </span>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize touch controls"
          className="touch-dpad-min-btn"
        >
          <X size={14} />
        </button>
      </div>

      <div className="touch-dpad-body">
        {/* Rail action buttons: Horn, Cruise, Reverser */}
        {showRailActions && (
          <div className="touch-dpad-actions" aria-label="Train actions">
            {onHorn && (
              <HoldButton
                label="Train horn (H)"
                badge="H"
                icon={<Megaphone size={18} />}
                onPress={onHorn}
                disabled={!active || hornDisabled}
                className="touch-dpad-btn-sm"
              />
            )}
            {onCruise && (
              <TapButton
                label="Cruise control (C)"
                badge="C"
                active={cruiseActive}
                icon={<Gauge size={18} />}
                onClick={onCruise}
                disabled={!(props.sessionActive ?? active)}
                className="touch-dpad-btn-sm"
              />
            )}
            {onReverser && (
              <TapButton
                label="Reverser direction (V)"
                badge="V"
                active={reverserBacking}
                icon={<ArrowUpDown size={18} />}
                onClick={onReverser}
                disabled={!active || reverserDisabled}
                className="touch-dpad-btn-sm"
              />
            )}
          </div>
        )}

        {/* Transit action buttons: Doors, Auto stops, Horn */}
        {showTransitActions && (
          <div className="touch-dpad-actions" aria-label="Transit actions">
            {onDoors && (
              <TapButton
                label={doorsOpen ? 'Close doors (O)' : 'Open doors (O)'}
                badge="O"
                active={doorsOpen}
                icon={doorsOpen ? <DoorOpen size={18} className="text-amber-400" /> : <DoorClosed size={18} />}
                onClick={onDoors}
                disabled={!active || doorsDisabled}
                className={`touch-dpad-btn-sm ${doorsOpen ? 'border-amber-400' : ''}`}
              />
            )}
            {onAutomatic && (
              <TapButton
                label={automaticActive ? 'Auto stops active (T)' : 'Manual drive (T)'}
                badge="T"
                active={automaticActive}
                icon={<Sparkles size={18} />}
                onClick={onAutomatic}
                disabled={!(props.sessionActive ?? active)}
                className="touch-dpad-btn-sm"
              />
            )}
            {onHorn && (
              <HoldButton
                label="Horn / chime (H)"
                badge="H"
                icon={<Megaphone size={18} />}
                onPress={onHorn}
                disabled={!active || hornDisabled}
                className="touch-dpad-btn-sm"
              />
            )}
          </div>
        )}

        {/* Directional arrow cluster */}
        <div className={showLateral ? 'touch-dpad-cross' : 'touch-dpad-vertical'}>
          {/* Up arrow — Accelerate / Power / W */}
          <div className="touch-dpad-up">
            <HoldButton
              label="Accelerate forward (W)"
              badge="W"
              icon={<ChevronUp size={28} strokeWidth={3} />}
              onPress={onAccelerate}
              disabled={!active || upDisabled}
              className="touch-dpad-btn-primary"
            />
          </div>

          {showLateral && (
            /* Left arrow — Turn left / A */
            <div className="touch-dpad-left">
              <TapButton
                label="Turn left at junction (A)"
                badge="A"
                icon={<ChevronLeft size={28} strokeWidth={3} />}
                onClick={() => onLeft!()}
                disabled={!active || leftDisabled}
              />
            </div>
          )}

          {/* Down arrow — Brake / S */}
          <div className="touch-dpad-down">
            <HoldButton
              label="Brake / Reverse (S)"
              badge="S"
              icon={<ChevronDown size={28} strokeWidth={3} />}
              onPress={onBrake}
              disabled={!active || downDisabled}
              className="touch-dpad-btn-brake"
            />
          </div>

          {showLateral && (
            /* Right arrow — Turn right / D */
            <div className="touch-dpad-right">
              <TapButton
                label="Turn right at junction (D)"
                badge="D"
                icon={<ChevronRight size={28} strokeWidth={3} />}
                onClick={() => onRight!()}
                disabled={!active || rightDisabled}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

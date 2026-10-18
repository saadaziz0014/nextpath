import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TouchDpad, { type TouchDpadProps } from '../app/components/TouchDpad';
import MobileCabPanel from '../app/components/MobileCabPanel';

const noop = () => {};
function controls(props: Partial<TouchDpadProps>) {
  const html = renderToStaticMarkup(createElement(TouchDpad, {
    mode: 'transit', active: true, sessionActive: true,
    onAccelerate: noop, onBrake: noop, onDoors: noop, onAutomatic: noop,
    onHorn: noop, ...props,
  }));
  return (label: string) => {
    const button = html.match(/<button\b[^>]*>/g)?.find(tag => tag.includes(`aria-label="${label}"`));
    assert.ok(button, `Missing mobile control: ${label}`);
    return button;
  };
}

test('mobile paused transit keeps the Auto selector available while movement and horn are disabled', () => {
  const button = controls({ active: false, automaticActive: true });
  assert.doesNotMatch(button('Auto stops active (T)'), /disabled=/);
  assert.match(button('Auto stops active (T)'), /aria-pressed="true"/);
  for (const label of ['Accelerate forward (W)', 'Brake / Reverse (S)', 'Horn / chime (H)']) {
    assert.match(button(label), /disabled=/);
  }
});

test('mobile door interlock blocks power and exposes the close-door action without blocking braking', () => {
  const button = controls({ doorsOpen: true, upDisabled: true });
  assert.match(button('Accelerate forward (W)'), /disabled=/);
  assert.doesNotMatch(button('Brake / Reverse (S)'), /disabled=/);
  assert.doesNotMatch(button('Close doors (O)'), /disabled=/);
  assert.match(button('Close doors (O)'), /aria-pressed="true"/);
});

test('mobile cab opens journey selection before departure and starts compact for active or restored trips', () => {
  const render = (active: boolean) => renderToStaticMarkup(createElement(MobileCabPanel, {
    active, speed: 0, paused: true, onPause: noop, onFollow: noop,
    onSound: noop, following: true, sound: false, status: 'Paused', onOverview: noop,
  }, createElement('select', { 'aria-label': 'Starting station' })));
  assert.match(render(false), /class="mobile-cab-panel cab-expanded"/);
  const driving = render(true);
  assert.doesNotMatch(driving, /class="mobile-cab-panel cab-expanded"/);
  for (const label of ['Resume simulation', 'Follow vehicle', 'Enable sound']) {
    assert.ok(driving.includes(`aria-label="${label}"`));
  }
  assert.match(driving, /aria-expanded="false"/);
});

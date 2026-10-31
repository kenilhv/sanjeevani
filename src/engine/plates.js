// The Level 1 plate. Two chained springs give an S-curve: it lifts off gently, then accelerates,
// and lands softly, and any mode change can interrupt it mid-air without a jolt.
import { FLOOR_HEIGHT } from '../world/plan.js';
import { snap, spring, step } from './motion.js';

export const STACK_LIFT = 15;
const OMEGA = 5.4;
const COVERED = FLOOR_HEIGHT + 0.4;

export function createPlates(floors, { farY, offFrame }) {
  const lead = spring(200), y = spring(200);
  let mode = 'ground';
  const place = () => { floors[1].position.y = y.x; };
  const goal = (m) => (m === 'level1' ? FLOOR_HEIGHT : m === 'stack' ? FLOOR_HEIGHT + STACK_LIFT : farY());

  floors[1].visible = false;
  place();

  return {
    get mode() { return mode; },
    set(next, instant) {
      mode = next;
      if (mode !== 'ground') {
        if (!floors[1].visible) { const far = farY(); snap(y, far); snap(lead, far); }
        floors[1].visible = true;
      }
      lead.g = goal(mode);
      if (instant) { snap(lead); snap(y, lead.g); floors[1].visible = mode !== 'ground'; place(); }
    },
    update(dt) {
      step(lead, OMEGA, dt);
      y.g = lead.x;
      step(y, OMEGA, dt);
      if (mode === 'ground' && floors[1].visible) {
        // Keep flying past the top of the frame so its shadow slides off the site instead of popping out.
        lead.g = goal('ground');
        if (y.x > lead.g - 6) floors[1].visible = false;
      }
      place();
    },
    top: () => (floors[1].visible ? y.x + 3.4 : 0),
    goalY: (i) => (i === 0 ? 0 : goal(mode)),
    visible(i) {
      if (i === 0) return !floors[1].visible || y.x > COVERED;
      return floors[1].visible && !(mode === 'ground' && offFrame(y.x));
    },
  };
}

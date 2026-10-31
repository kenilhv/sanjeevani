// The opening. Runs through the same setFloorMode and flyTo as everything else, so a skip is just
// "hand everything to the springs", and the view state it leaves behind is the ordinary one.
import { atRest, clamp, smooth, snap, spring, step } from './motion.js';

const RAD = Math.PI / 180;
const T = { veil: 0.2, veilFor: 1.3, descend: 1.15, liftOff: 2.95, camera: 4.9, skip: 0.85 };
const START = { dy: 7, lz: Math.log(0.68), th: -34 * RAD, el: 56 * RAD, rise: -13 };
const soft = (t) => 0.4 * smooth(t) + 0.6 * (1 - (1 - t) ** 3);

export function createIntro({ rig, sky, plates, setFloorMode, reduced }) {
  const rise = spring(0);
  let run = null;

  function fly(pose, opts) {
    const id = ++run.flight;
    rig.flyTo(pose, opts).then(() => { if (run?.flight === id) run.flown = true; });
  }

  function finish() {
    const r = run;
    run = null;
    snap(rise, 0);
    rig.setLift(0);
    sky.setVeil(0);
    if (!r.skipped) setFloorMode(r.final);      // after a skip the floor is the user's now
    r.resolve();
  }

  return {
    get active() { return !!run; },
    get locked() { return !!run && !run.skipped; },
    play() {
      if (run) return run.promise;
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      run = { t: 0, final: plates.mode, end: rig.pose(), resolve, promise, veil: 1, flight: 0, down: false, up: false, skipped: false, flown: false, calm: reduced.matches };
      sky.setVeil(1);
      if (run.calm) return promise;
      snap(rise, START.rise); rise.g = 0;
      rig.setLift(-rise.x);
      rig.jump(START);
      // The flight's end pose is resolved against the final mode's framing, so fly first and only then clear the plate.
      fly({ ...run.end, duration: T.camera }, { ease: soft, arc: false, framed: false });
      setFloorMode('ground', true);
      return promise;
    },
    /** Any input during the opening. Everything is already sprung, so it just heads home quickly from wherever it is. */
    skip() {
      if (!run || run.skipped) return;
      run.skipped = true;
      if (run.calm) return;
      setFloorMode(run.final);
      fly({ ...run.end, duration: T.skip }, { arc: false, framed: false });
    },
    update(dt) {
      if (!run) return;
      const r = run;
      r.t += dt;
      if (r.calm) {
        r.veil = r.skipped ? 0 : 1 - smooth(r.t / 0.9);
        sky.setVeil(r.veil);
        if (r.veil <= 0) finish();
        return;
      }
      r.veil = r.skipped ? Math.max(0, r.veil - dt * 3.2) : 1 - soft(clamp((r.t - T.veil) / T.veilFor));
      sky.setVeil(r.veil);
      if (r.t > T.veil * 0.5 || r.skipped) step(rise, r.skipped ? 8 : 2.5, dt);
      rig.setLift(-rise.x);
      if (!r.skipped) {
        if (!r.down && r.t >= T.descend) { r.down = true; setFloorMode('level1'); }
        if (!r.up && r.t >= T.liftOff) { r.up = true; setFloorMode(r.final); }
      }
      if (r.flown && r.veil <= 0.002 && atRest(rise, 0.01)) finish();
    },
  };
}

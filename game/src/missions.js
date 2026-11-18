// The story: three missions in order, each with its steps, its dialogue
// and its pay. A mission is a small state machine — the world reports
// where the player is and what he does, and this module says which step
// is live, when it is done, and what line of dialogue shows next.

import { MISSIONS } from './config.js';

export function createMissions() {
  let index = 0;
  let step = 0;
  let holdProgress = 0;
  let dialog = [];
  let dialogIndex = 0;
  let dialogTimer = 0;
  let done = false;
  let lastPay = 0;

  function current() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function currentStep() {
    const mission = current();
    return mission ? mission.steps[step] : null;
  }

  function startDialog(lines) {
    dialog = lines.slice();
    dialogIndex = 0;
    dialogTimer = 5;
  }

  function begin(indexValue) {
    index = indexValue;
    step = 0;
    holdProgress = 0;
    done = false;
    const mission = current();
    if (mission) startDialog(mission.intro);
  }

  function reset() {
    begin(0);
  }

  function advance() {
    const mission = current();
    if (!mission) return 0;
    step += 1;
    holdProgress = 0;
    if (step >= mission.steps.length) {
      lastPay = mission.pay;
      startDialog(mission.outro);
      return mission.pay;
    }
    return 0;
  }

  /**
   * One fixed step. `ctx` carries the player's position, whether he is
   * holding E, and the wanted level. Returns the pay when a mission
   * completes, else 0.
   */
  function update(dt, ctx) {
    if (dialogTimer > 0) dialogTimer -= dt;
    else if (dialogIndex < dialog.length - 1) {
      dialogIndex += 1;
      dialogTimer = 5;
    }
    const mission = current();
    if (!mission || done) return 0;
    const s = mission.steps[step];
    if (!s) return 0;
    const dist = Math.hypot(ctx.x - s.x, ctx.y - s.y);
    if (s.type === 'goto') {
      if (dist < s.radius) return advance();
    } else if (s.type === 'hold') {
      if (dist < s.radius && ctx.holdingE) {
        holdProgress += dt;
        if (holdProgress >= (s.holdSeconds || 3)) return advance();
      } else {
        holdProgress = Math.max(0, holdProgress - dt * 2);
      }
    } else if (s.type === 'escape') {
      // Reaching the hideout clears the heat: the job is done.
      if (dist < s.radius) return advance();
    }
    return 0;
  }

  /** The line of dialogue showing now, or null when the scene is quiet. */
  function dialogLine() {
    if (dialogTimer <= 0 || dialogIndex >= dialog.length) return null;
    return dialog[dialogIndex];
  }

  function isDone() {
    return index >= MISSIONS.length;
  }

  function nextMission() {
    index += 1;
    step = 0;
    holdProgress = 0;
    if (index >= MISSIONS.length) {
      done = true;
      return;
    }
    startDialog(current().intro);
  }

  return {
    reset,
    begin,
    update,
    dialogLine,
    current,
    currentStep,
    isDone,
    nextMission,
    get index() {
      return index;
    },
    set index(value) {
      index = value;
    },
    get step() {
      return step;
    },
    get holdProgress() {
      return holdProgress;
    },
    get lastPay() {
      return lastPay;
    },
  };
}

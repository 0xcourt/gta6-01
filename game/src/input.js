// Keyboard and mouse input, read every frame. The world gets a plain
// control object (move, steer, gas, brake, actions) and the renderer gets
// the mouse position in world pixels for aiming. Edge-triggered actions
// (enter car, punch, shoot, pause) are consumed once per press.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'brake',
  KeyE: 'enter',
  KeyF: 'punch',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'confirm',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (name === 'brake' || name === 'up' || name === 'down') event.preventDefault();
    if (!event.repeat) {
      held.add(name);
      pressed.add(name);
    }
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held.delete(name);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouse.down = true;
    mouse.clicked = true;
    pressed.add('confirm');
    onMouseMove(event);
  }

  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** The held movement keys as a direction, for walking. */
  function moveDirection() {
    const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    return { x, y };
  }

  /**
   * The whole control object for one step. Call once per frame; only the
   * gameplay keys are consumed here, so a menu press (Enter / P) queued
   * between frames is still there for takeActions.
   */
  function readControl() {
    const move = moveDirection();
    const control = {
      moveX: move.x,
      moveY: move.y,
      steer: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      gas: held.has('up'),
      brake: held.has('down'),
      handbrake: held.has('brake'),
      run: held.has('run'),
      enter: pressed.has('enter'),
      punch: pressed.has('punch'),
      shoot: mouse.clicked || mouse.down,
      holdingE: held.has('enter'),
      aimX: mouse.x,
      aimY: mouse.y,
      mute: pressed.has('mute'),
    };
    pressed.delete('enter');
    pressed.delete('punch');
    pressed.delete('mute');
    mouse.clicked = false;
    return control;
  }

  /** Edge-triggered menu actions (confirm / pause), consumed once. */
  function takeActions() {
    let result = 0;
    if (pressed.has('confirm')) result |= ACTION_CONFIRM;
    if (pressed.has('pause')) result |= ACTION_PAUSE;
    pressed.delete('confirm');
    pressed.delete('pause');
    return result;
  }

  return { readControl, takeActions, mouse };
}

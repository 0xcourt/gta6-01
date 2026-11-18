// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// sets the real world to a staged pose from a fresh reset — the player in a
// car on a busy street, a police chase at three stars, on foot at the bank
// — then steps the rules forward a few seconds, so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_CONTROL = {
  moveX: 0,
  moveY: 0,
  steer: 0,
  gas: false,
  brake: false,
  handbrake: false,
  run: false,
  enter: false,
  punch: false,
  shoot: false,
  holdingE: false,
  aimX: 0,
  aimY: 0,
  mute: false,
};

/** Drive the player's car forward, gently steering along its road. */
function driveForward(world, seconds) {
  const control = { ...IDLE_CONTROL, gas: true };
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, control, false);
  }
}

/** Let the world idle (traffic, pedestrians, police) for a few seconds. */
function idle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, IDLE_CONTROL, false);
  }
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it and the best score.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  /** The player's own car, parked by the hideout after reset. */
  function takeOwnCar() {
    const car = state.parked[0];
    state.parked.splice(0, 1);
    car.kind = 'player';
    state.car = car;
    state.player.car = car;
    return car;
  }
  if (name === 'drive') {
    // On the avenue at speed, traffic ahead, pedestrians on the sidewalk,
    // mission 1 live with its objective on the HUD.
    const car = takeOwnCar();
    car.x = 1300;
    car.y = 700;
    car.angle = 0;
    car.speed = 320;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.car = car;
    state.money = 1250;
    state.camera.x = car.x;
    state.camera.y = car.y;
    world.startMission(0);
    driveForward(world, 3.5);
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'chase') {
    // Three stars, three police cars closing in on the avenue, mission 2 live.
    const car = takeOwnCar();
    car.x = 1300;
    car.y = 1150;
    car.angle = 0;
    car.speed = 380;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.car = car;
    state.money = 1650;
    state.camera.x = car.x;
    state.camera.y = car.y;
    world.startMission(1);
    driveForward(world, 2.5);
    return { screen: SCREEN_PLAY, best: 1650 };
  }
  if (name === 'mission') {
    // On foot at the Bank of Leonida, pistol out, mission 3 live with its
    // dialogue showing.
    state.player.x = 1720;
    state.player.y = 620;
    state.player.angle = 0.5;
    state.player.ammo = 18;
    state.money = 2250;
    state.camera.x = 1800;
    state.camera.y = 700;
    world.startMission(2);
    idle(world, 1.5);
    return { screen: SCREEN_PLAY, best: 2250 };
  }
  // Start: the title over a living city, traffic cruising past.
  for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, IDLE_CONTROL, true);
  return { screen: SCREEN_TITLE, best: 2250 };
}

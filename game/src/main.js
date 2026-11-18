// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, game over and win.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED, EVENT_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { best: scene.best, save: null, banner: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = world.loadSave();
  let banner = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    world.startMission(0);
    banner = null;
    screen = SCREEN_PLAY;
    announce('Bermain. Misi 1: Paket Tengah Malam.');
  }

  function continueGame() {
    world.reset();
    if (save) {
      world.state.money = save.money;
      world.startMission(Math.min(save.mission, 2));
    } else {
      world.startMission(0);
    }
    banner = null;
    screen = SCREEN_PLAY;
    announce('Lanjutan dimuat.');
  }

  function retryMission() {
    const money = world.state.money;
    const mission = world.missions.index;
    world.reset();
    world.state.money = money;
    world.startMission(Math.min(mission, 2));
    banner = null;
    screen = SCREEN_PLAY;
    announce('Misi diulang.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_BUSTED) audio.busted();
    if (events & EVENT_WASTED) audio.busted();
    if (events & EVENT_MISSION) {
      audio.mission();
      banner = { text: 'MISI SELESAI!', ttl: 3 };
      if (world.state.money > best) best = world.state.money;
    }
    if (events & EVENT_WON) {
      screen = SCREEN_WIN;
      announce('Menang! Tiga misi selesai. Leonida milikmu.');
    } else if (world.state.over) {
      screen = SCREEN_OVER;
      announce(world.state.over.kind === 'busted' ? 'Ketangkap polisi.' : 'Kamu tumbang.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Jeda. Progres tersimpan.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Lanjut bermain.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      audio.unlock();
      if (save) continueGame();
      else startNewGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) {
      audio.unlock();
      retryMission();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) {
      audio.unlock();
      save = null;
      startNewGame();
    }
  }

  /** Mouse position in canvas pixels, converted to world pixels for aiming. */
  function aimWorld(control) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    const offsetX = (rect.width - VIEW.width * scale) / 2;
    const offsetY = (rect.height - VIEW.height * scale) / 2;
    const viewX = (control.aimX - offsetX) / scale;
    const viewY = (control.aimY - offsetY) / scale;
    return {
      x: world.state.camera.x + viewX - VIEW.width / 2,
      y: world.state.camera.y + viewY - VIEW.height / 2,
    };
  }

  function step() {
    const control = input.readControl();
    if (control.mute) audio.toggle();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, control, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aim = aimWorld(control);
    control.aimX = aim.x;
    control.aimY = aim.y;
    const events = world.step(STEP, control, false);
    if (banner) {
      banner.ttl -= STEP;
      if (banner.ttl <= 0) banner = null;
    }
    const player = world.state.player;
    const speed = player.car ? Math.abs(player.car.speed) : 0;
    let policeNear = false;
    for (const cop of world.police.cars) {
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < 520) policeNear = true;
    }
    audio.update(STEP, speed, policeNear);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, { best, save, banner });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Jeda.');
    }
  });

  announce('Leonida Nights. Tekan Enter atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

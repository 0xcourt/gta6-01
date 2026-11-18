// The game's rules and state, with no drawing and no browser in it: the
// player on foot and behind the wheel, stealing cars, combat, the wanted
// level, missions, pickups and saving. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds,
// announcements) without the world knowing about screens or sound.

import {
  BEST_KEY,
  CAR,
  GUN,
  HEALTH,
  PLAYER,
  POLICE,
  SAVE_KEY,
  WANTED,
  WATER_Y,
  WORLD,
} from './config.js';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { pick, range } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_STEAL = 8;
export const EVENT_PICKUP = 16;
export const EVENT_MISSION = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_WON = 256;
export const EVENT_ALARM = 512;

const PICKUP_KINDS = ['health', 'ammo', 'cash'];

/** Push a circle out of a rectangle; returns true when it overlapped. */
function circleRectPush(body, radius, rect) {
  const cx = Math.max(rect.x, Math.min(body.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(body.y, rect.y + rect.h));
  const dx = body.x - cx;
  const dy = body.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * radius;
    body.y = cy + (dy / d) * radius;
  } else {
    body.x = rect.x - radius;
  }
  return true;
}

export function createWorld(random) {
  const city = buildCity(random);
  const traffic = createTraffic(random);
  const police = createPolice(random);
  const missions = createMissions();

  const state = {
    player: {
      x: 300,
      y: 2100,
      angle: 0,
      health: PLAYER.health,
      ammo: GUN.startAmmo,
      car: null,
      punchCooldown: 0,
      gunCooldown: 0,
      invuln: 0,
    },
    car: null,
    parked: [],
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    money: 0,
    wanted: 0,
    elapsed: 0,
    shake: 0,
    over: null,
    camera: { x: 300, y: 2100 },
    pickupTimer: 12,
    attractAngle: 0,
    missionWait: 0,
    alarmRaised: false,
  };

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, ttl: 1.8 });
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        ttl: range(random, 0.3, 0.8),
        color,
        size: range(random, 2, 5),
      });
    }
  }

  function addCrime(amount) {
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
  }

  function collideBuildings(body, radius) {
    for (const b of city.buildings) {
      if (body.x > b.x - radius && body.x < b.x + b.w + radius && body.y > b.y - radius && body.y < b.y + b.h + radius) {
        circleRectPush(body, radius, b);
      }
    }
  }

  function spawnPickup() {
    const kinds = PICKUP_KINDS;
    const kind = pick(random, kinds);
    const x = range(random, 120, WORLD.width - 120);
    const y = range(random, 120, 2100);
    state.pickups.push({ x, y, kind, bob: random() * Math.PI * 2 });
  }

  function startMission(index) {
    missions.begin(index);
    if (index === 1) {
      state.wanted = Math.max(state.wanted, 3);
      addFloater(state.player.x, state.player.y - 40, 'WANTED ★★★', '#e74c3c');
    }
  }

  function reset() {
    const p = state.player;
    p.x = 300;
    p.y = 2100;
    p.angle = -Math.PI / 2;
    p.health = PLAYER.health;
    p.ammo = GUN.startAmmo;
    p.car = null;
    p.punchCooldown = 0;
    p.gunCooldown = 0;
    p.invuln = 0;
    state.car = null;
    state.parked.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.pickups.length = 0;
    state.money = 0;
    state.wanted = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.over = null;
    state.pickupTimer = 12;
    state.missionWait = 0;
    state.alarmRaised = false;
    traffic.reset();
    police.reset();
    missions.reset();
    // A car of the player's own, parked by the hideout.
    const own = {
      kind: 'player',
      x: 340,
      y: 2050,
      angle: -Math.PI / 2,
      speed: 0,
      color: '#00e5ff',
      health: CAR.health,
    };
    state.parked.push(own);
    spawnPickup();
    spawnPickup();
  }

  function save() {
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ mission: missions.index, money: state.money, best: best() }),
      );
    } catch {
      // Storage can be off (private windows): progress then lasts this visit only.
    }
  }

  function best() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Ignore: best score is a nicety, not the game.
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** The nearest drivable car to the player, within reach, or null. */
  function nearestCar() {
    const p = state.player;
    let bestCar = null;
    let bestDist = 78;
    const all = [...traffic.cars, ...state.parked];
    if (state.car) all.push(state.car);
    for (const car of all) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        bestCar = car;
      }
    }
    return bestCar;
  }

  function enterCar(events) {
    const car = nearestCar();
    if (!car) return events;
    const p = state.player;
    if (car.kind === 'traffic') {
      const i = traffic.cars.indexOf(car);
      if (i >= 0) traffic.cars.splice(i, 1);
      addCrime(WANTED.stealCar);
      addFloater(p.x, p.y - 40, 'MOBIL DICURI!', '#f39c12');
      events |= EVENT_STEAL;
    }
    if (car.kind === 'parked') {
      const i = state.parked.indexOf(car);
      if (i >= 0) state.parked.splice(i, 1);
    }
    car.kind = 'player';
    state.car = car;
    p.car = car;
    return events;
  }

  function exitCar() {
    const p = state.player;
    const car = state.car;
    if (!car) return;
    car.speed = 0;
    car.kind = 'parked';
    state.parked.push(car);
    state.car = null;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    collideBuildings(p, PLAYER.radius);
  }

  function shoot(events, aimX, aimY) {
    const p = state.player;
    if (p.gunCooldown > 0 || p.ammo <= 0 || p.car) return events;
    p.gunCooldown = GUN.cooldown;
    p.ammo -= 1;
    p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * 20,
      y: p.y + Math.sin(p.angle) * 20,
      angle: p.angle,
      speed: GUN.bulletSpeed,
      travelled: 0,
    });
    addCrime(0); // Shooting alone is loud: the heat comes from who it hits.
    return events | EVENT_SHOT;
  }

  function punch(events) {
    const p = state.player;
    if (p.punchCooldown > 0 || p.car) return events;
    p.punchCooldown = PLAYER.punchCooldown;
    let hit = false;
    for (const ped of traffic.peds) {
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < PLAYER.punchRange) {
        ped.health -= PLAYER.punchDamage;
        ped.state = 'flee';
        ped.fleeTimer = 4;
        addParticles(ped.x, ped.y, '#e74c3c', 8, 160);
        hit = true;
        if (ped.health <= 0) addCrime(WANTED.killPed);
      }
    }
    for (const cop of police.cars) {
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d < PLAYER.punchRange + 14) {
        cop.health -= PLAYER.punchDamage;
        addParticles(cop.x, cop.y, '#e74c3c', 8, 160);
        hit = true;
        if (cop.health <= 0) {
          addCrime(WANTED.killCop);
          addParticles(cop.x, cop.y, '#f39c12', 24, 320);
        }
      }
    }
    return hit ? events | EVENT_PUNCH : events;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return;
    p.health -= amount;
    p.invuln = 0.4;
    state.shake = Math.max(state.shake, 0.5);
    if (p.health <= 0) {
      p.health = 0;
      state.over = { kind: 'wasted', reason: 'Kamu tumbang di jalanan Leonida.' };
    }
  }

  function stepPlayerOnFoot(dt, control) {
    const p = state.player;
    const run = control.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = control.moveX;
    const my = control.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      const nx = mx / len;
      const ny = my / len;
      p.x += nx * run * dt;
      p.y += ny * run * dt;
      p.angle = Math.atan2(ny, nx);
    }
    p.x = Math.max(20, Math.min(WORLD.width - 20, p.x));
    p.y = Math.max(20, Math.min(WATER_Y - 24, p.y));
    collideBuildings(p, PLAYER.radius);
  }

  function stepPlayerCar(dt, control) {
    const car = state.car;
    const p = state.player;
    if (!car) return 0;
    let events = 0;
    if (control.gas) car.speed += CAR.accel * dt;
    if (control.brake) car.speed -= CAR.brake * dt;
    if (control.handbrake) car.speed -= CAR.brake * 1.6 * dt;
    car.speed -= car.speed * CAR.drag * dt;
    car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
    const steerAmount = control.steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 180) * (car.speed >= 0 ? 1 : -1);
    car.angle += steerAmount * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
    car.y = Math.max(24, Math.min(WATER_Y - 24, car.y));
    const before = { x: car.x, y: car.y };
    collideBuildings(car, 26);
    if ((car.x !== before.x || car.y !== before.y) && Math.abs(car.speed) > 120) {
      car.speed *= -0.25;
      state.shake = Math.max(state.shake, 0.6);
      addParticles(car.x, car.y, '#f39c12', 10, 220);
      events |= EVENT_CRASH;
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.travelled += b.speed * dt;
      let dead = b.travelled > GUN.range;
      if (!dead) {
        for (const building of city.buildings) {
          if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
            addParticles(b.x, b.y, '#b9b3a4', 5, 120);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of traffic.peds) {
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 15) {
            ped.health -= GUN.damage;
            ped.state = 'flee';
            ped.fleeTimer = 4;
            addParticles(b.x, b.y, '#e74c3c', 8, 180);
            addCrime(WANTED.shoot);
            if (ped.health <= 0) addCrime(WANTED.killPed);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const cop of police.cars) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 28) {
            cop.health -= GUN.damage;
            addParticles(b.x, b.y, '#f39c12', 10, 220);
            addCrime(WANTED.shoot);
            if (cop.health <= 0) {
              addCrime(WANTED.killCop);
              addParticles(cop.x, cop.y, '#f39c12', 26, 340);
              state.shake = Math.max(state.shake, 0.8);
            }
            dead = true;
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function stepCarCollisions(dt) {
    const car = state.car;
    if (!car) return 0;
    let events = 0;
    if (car.crashCooldown > 0) car.crashCooldown -= dt;
    const all = [...traffic.cars, ...police.cars, ...state.parked];
    for (const other of all) {
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (other.x - car.x) / d;
        const ny = (other.y - car.y) / d;
        other.x += nx * push;
        other.y += ny * push;
        car.x -= nx * push;
        car.y -= ny * push;
        if (Math.abs(car.speed) > 90 && car.crashCooldown <= 0) {
          car.crashCooldown = 0.8;
          car.speed *= 0.45;
          state.shake = Math.max(state.shake, 0.7);
          addParticles(car.x, car.y, '#f39c12', 12, 260);
          events |= EVENT_CRASH;
          if (other.kind === 'police') {
            addCrime(WANTED.ramCop);
            damagePlayer(6);
          }
        }
      }
    }
    return events;
  }

  /**
   * One fixed step. `control` is { moveX, moveY, steer, gas, brake,
   * handbrake, run, enter, punch, shoot, aimX, aimY, holdingE }. With
   * `attract` set (the title screen's backdrop) traffic and pedestrians
   * move but nothing scores and the player is not there.
   */
  function step(dt, control, attract) {
    let events = 0;
    state.elapsed += dt;
    const p = state.player;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.gunCooldown > 0) p.gunCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

    const gunfire = control.shoot ? { x: p.x, y: p.y } : null;
    const runOver = traffic.update(dt, state.car, p.x, p.y, gunfire);
    for (const ped of runOver) {
      ped.health = 0;
      addCrime(WANTED.hitPed);
      addParticles(ped.x, ped.y, '#e74c3c', 14, 240);
      state.shake = Math.max(state.shake, 0.5);
      events |= EVENT_CRASH;
    }

    if (attract) {
      state.attractAngle += dt * 0.05;
      state.camera.x = WORLD.width / 2 + Math.cos(state.attractAngle) * 500;
      state.camera.y = 1200 + Math.sin(state.attractAngle) * 300;
      return 0;
    }

    if (state.over) return 0;

    if (control.enter) {
      if (p.car) exitCar();
      else events = enterCar(events);
    }
    if (p.car) events |= stepPlayerCar(dt, control);
    else {
      stepPlayerOnFoot(dt, control);
      if (control.punch) events = punch(events);
      if (control.shoot) events = shoot(events, control.aimX, control.aimY);
    }
    events |= stepBullets(dt);
    events |= stepCarCollisions(dt);

    // Police chase, ram and bust; wanted decays when the heat is off.
    const policeResult = police.update(dt, state.wanted, p.x, p.y, !!p.car, p.car ? p.car.speed : 0);
    state.wanted = policeResult.wanted;
    if (policeResult.busted) {
      state.over = { kind: 'busted', reason: 'Polisi menangkapmu. Denda $200.' };
      state.money = Math.max(0, state.money - 200);
      events |= EVENT_BUSTED;
    }
    // A police ram hurts while they are on top of the player's car.
    if (p.car) {
      for (const cop of police.cars) {
        if (Math.hypot(cop.x - p.x, cop.y - p.y) < 46) damagePlayer(POLICE.ramDamage * dt);
      }
    }

    // Health comes back slowly once the heat is off.
    if (state.wanted === 0 && p.health > 0) {
      p.health = Math.min(PLAYER.health, p.health + HEALTH.regenPerSecond * dt);
    }

    // Pickups appear on the streets and wait to be collected.
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 4) {
      spawnPickup();
      state.pickupTimer = 18;
    }
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.bob += dt * 3;
      if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 34) {
        if (pickup.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + HEALTH.pickup);
          addFloater(p.x, p.y - 30, '+40 NYAWA', '#2ecc71');
        } else if (pickup.kind === 'ammo') {
          p.ammo = Math.min(GUN.maxAmmo, p.ammo + HEALTH.ammoPickup);
          addFloater(p.x, p.y - 30, '+12 PELURU', '#f1c40f');
        } else {
          state.money += 150;
          addFloater(p.x, p.y - 30, '+$150', '#2ecc71');
        }
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }

    // Missions: the bank job's alarm goes off the moment the safe opens.
    // A finished mission waits a few seconds (its outro dialogue plays)
    // before the next one begins, and escaping clears the heat.
    const pay = missions.update(dt, { x: p.x, y: p.y, holdingE: control.holdingE, wanted: state.wanted });
    if (missions.index === 2 && missions.step === 2 && state.missionWait <= 0 && !state.alarmRaised) {
      state.alarmRaised = true;
      state.wanted = Math.max(state.wanted, 4);
      events |= EVENT_ALARM;
      addFloater(p.x, p.y - 50, 'ALARM BERBUNYI!', '#e74c3c');
    }
    if (pay > 0) {
      state.money += pay;
      if (missions.index >= 1) state.wanted = 0;
      addFloater(p.x, p.y - 40, `MISI SELESAI  +$${pay}`, '#2ecc71');
      events |= EVENT_MISSION;
      state.missionWait = 6;
      save();
    }
    if (state.missionWait > 0) {
      state.missionWait -= dt;
      if (state.missionWait <= 0) {
        state.alarmRaised = false;
        if (missions.index >= 2) {
          missions.nextMission();
          state.over = { kind: 'won', reason: 'Tiga misi selesai. Leonida milikmu.' };
          if (state.money > best()) saveBest(state.money);
          events |= EVENT_WON;
        } else {
          missions.nextMission();
          startMission(missions.index);
        }
      }
    }

    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.ttl -= dt;
      f.y -= 24 * dt;
      if (f.ttl <= 0) state.floaters.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.ttl -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
      if (pt.ttl <= 0) state.particles.splice(i, 1);
    }

    // The camera chases the player and stays inside the city.
    const targetX = p.car ? p.car.x : p.x;
    const targetY = p.car ? p.car.y : p.y;
    state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);

    if (state.over && state.over.kind === 'wasted') events |= EVENT_WASTED;
    return events;
  }

  /** Every car in the world, for the renderer, in draw order. */
  function allCars() {
    return [...state.parked, ...traffic.cars, ...police.cars, ...(state.car ? [state.car] : [])];
  }

  reset();
  return {
    state,
    city,
    traffic,
    police,
    missions,
    reset,
    startMission,
    step,
    save,
    best,
    saveBest,
    loadSave,
    allCars,
  };
}

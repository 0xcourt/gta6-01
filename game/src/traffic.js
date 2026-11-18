// Traffic cars and pedestrians: the living city. Traffic cars cruise the
// street grid in their lanes and slow for the car ahead; pedestrians stroll
// the sidewalks and run away from gunfire. Neither knows about the player
// beyond what the world tells it each step.

import { PED, ROADS_H, ROADS_V, ROAD_W, TRAFFIC, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';
import { nearestRoadPoint, onRoad, randomRoadPoint } from './city.js';

/** A fresh traffic car on a random road, heading along it. */
function spawnCar(random) {
  const point = randomRoadPoint(random);
  const dir = random() < 0.5 ? 1 : -1;
  const lane = range(random, 14, 26);
  return {
    kind: 'traffic',
    x: point.x,
    y: point.y,
    angle: point.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
    speed: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    cruise: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    vertical: point.vertical,
    dir,
    lane,
    color: pick(random, TRAFFIC.colours),
    health: 100,
    honk: 0,
  };
}

/** A fresh pedestrian on a sidewalk beside a random road. */
function spawnPed(random) {
  const point = randomRoadPoint(random);
  const side = random() < 0.5 ? 1 : -1;
  const x = point.vertical ? point.x + side * (ROAD_W / 2 + 12) : point.x;
  const y = point.vertical ? point.y : point.y + side * (ROAD_W / 2 + 12);
  return {
    x,
    y,
    angle: range(random, 0, Math.PI * 2),
    speed: range(random, PED.walkSpeed * 0.7, PED.walkSpeed * 1.3),
    state: 'walk',
    color: pick(random, PED.colours),
    health: 100,
    fleeTimer: 0,
    wanderTimer: range(random, 2, 6),
  };
}

export function createTraffic(random) {
  const cars = [];
  const peds = [];
  let carTimer = 0;
  let pedTimer = 0;

  function reset() {
    cars.length = 0;
    peds.length = 0;
    carTimer = 0;
    pedTimer = 0;
    for (let i = 0; i < 8; i += 1) cars.push(spawnCar(random));
    for (let i = 0; i < 14; i += 1) peds.push(spawnPed(random));
  }

  /** The traffic car ahead of `car` in its lane, if one is close. */
  function carAhead(car, gap) {
    for (const other of cars) {
      if (other === car) continue;
      if (other.vertical !== car.vertical) continue;
      const along =
        car.vertical ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const across = car.vertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < gap && across < 34) return other;
    }
    return null;
  }

  /**
   * One fixed step. `playerCar` is the car the player drives (or null), so
   * traffic slows behind it too. Returns peds the player's car just ran over.
   */
  function update(dt, playerCar, playerX, playerY, gunfire) {
    carTimer -= dt;
    if (carTimer <= 0 && cars.length < TRAFFIC.maxCars) {
      cars.push(spawnCar(random));
      carTimer = TRAFFIC.spawnEvery;
    }
    pedTimer -= dt;
    if (pedTimer <= 0 && peds.length < PED.maxPeds) {
      peds.push(spawnPed(random));
      pedTimer = PED.spawnEvery;
    }

    for (const car of cars) {
      const ahead = carAhead(car, 130);
      const target = ahead ? Math.min(car.cruise, ahead.speed * 0.85) : car.cruise;
      if (playerCar && playerCar !== car) {
        const dx = playerCar.x - car.x;
        const dy = playerCar.y - car.y;
        const along = car.vertical ? dy * car.dir : dx * car.dir;
        const across = car.vertical ? Math.abs(dx) : Math.abs(dy);
        if (along > 0 && along < 150 && across < 34) car.speed = Math.min(car.speed, 40);
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      const step = car.speed * dt;
      if (car.vertical) car.y += car.dir * step;
      else car.x += car.dir * step;
      // Wrap around the far edge of the city so traffic never runs out.
      if (car.vertical && (car.y < -80 || car.y > WORLD.height + 80)) car.y = car.dir > 0 ? -60 : WORLD.height + 60;
      if (!car.vertical && (car.x < -80 || car.x > WORLD.width + 80)) car.x = car.dir > 0 ? -60 : WORLD.width + 60;
    }

    const runOver = [];
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (ped.health <= 0) {
        peds.splice(i, 1);
        continue;
      }
      if (gunfire) {
        const d = Math.hypot(ped.x - gunfire.x, ped.y - gunfire.y);
        if (d < 320 && ped.state !== 'flee') {
          ped.state = 'flee';
          ped.fleeTimer = range(random, 3, 5);
        }
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const away = Math.atan2(ped.y - playerY, ped.x - playerX);
        ped.angle = away;
        ped.x += Math.cos(away) * PED.fleeSpeed * dt;
        ped.y += Math.sin(away) * PED.fleeSpeed * dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      } else {
        ped.wanderTimer -= dt;
        if (ped.wanderTimer <= 0) {
          ped.wanderTimer = range(random, 2, 6);
          const near = nearestRoadPoint(ped.x, ped.y);
          ped.angle = Math.atan2(near.y - ped.y, near.x - ped.x) + range(random, -0.9, 0.9);
        }
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (!onRoad(ped.x, ped.y)) {
          const near = nearestRoadPoint(ped.x, ped.y);
          ped.angle = Math.atan2(near.y - ped.y, near.x - ped.x);
        }
      }
      ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD.height - 20, ped.y));
      if (playerCar) {
        const d = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
        if (d < 34 && Math.abs(playerCar.speed) > 60) runOver.push(ped);
      }
    }
    return runOver;
  }

  reset();
  return { cars, peds, reset, update, spawnCar };
}

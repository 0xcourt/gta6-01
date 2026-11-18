// The police: how many cars hunt the player for each wanted level, how
// they chase, ram and bust, and how the wanted level cools off when the
// player lays low. Police cars are real cars in the world: they can be
// outrun, crashed and shot.

import { POLICE, WANTED, WORLD } from './config.js';
import { range } from './random.js';
import { randomRoadPoint } from './city.js';

export function createPolice(random) {
  const cars = [];
  let bustTimer = 0;
  let decayTimer = 0;

  function reset() {
    cars.length = 0;
    bustTimer = 0;
    decayTimer = 0;
  }

  /** Put a fresh police car on a road near the player, facing the chase. */
  function spawnNear(playerX, playerY) {
    const point = randomRoadPoint(random);
    const angle = Math.atan2(playerY - point.y, playerX - point.x);
    cars.push({
      kind: 'police',
      x: point.x,
      y: point.y,
      angle,
      speed: range(random, 300, 420),
      color: '#dfe6f2',
      health: 100,
      siren: random() * 2,
    });
  }

  /**
   * One fixed step. Returns 'busted' when a police car has held the player
   * on foot long enough, and the new wanted level after decay.
   */
  function update(dt, wanted, playerX, playerY, playerInCar, playerSpeed) {
    const want = WANTED.copsForLevel[Math.min(wanted, WANTED.max)];
    while (cars.length < want) spawnNear(playerX, playerY);
    while (cars.length > want) cars.pop();

    let busted = false;
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (car.health <= 0) {
        cars.splice(i, 1);
        continue;
      }
      car.siren += dt;
      const dx = playerX - car.x;
      const dy = playerY - car.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > POLICE.despawnDistance) {
        // Teleport back into the hunt instead of driving across the city.
        const point = randomRoadPoint(random);
        car.x = point.x;
        car.y = point.y;
        car.speed = 380;
      }
      const targetAngle = Math.atan2(dy, dx);
      let turn = targetAngle - car.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
      car.speed = Math.min(POLICE.maxSpeed, car.speed + POLICE.accel * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
      car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));

      if (!playerInCar && dist < 44) {
        bustTimer += dt;
        if (bustTimer >= POLICE.bustSeconds) busted = true;
      }
    }
    if (playerInCar || cars.length === 0) bustTimer = 0;

    // Wanted decay: only when no police car is anywhere near the player.
    let nearest = Infinity;
    for (const car of cars) nearest = Math.min(nearest, Math.hypot(car.x - playerX, car.y - playerY));
    if (wanted > 0 && nearest > 700) {
      decayTimer += dt;
      if (decayTimer >= WANTED.decaySeconds) {
        decayTimer = 0;
        wanted -= 1;
      }
    } else {
      decayTimer = 0;
    }
    return { busted, wanted };
  }

  reset();
  return { cars, reset, update };
}

// The city of Leonida: a night grid of avenues and streets, the buildings
// that fill the blocks between them, the beach and water along the south
// edge, and the named landmarks the missions point at. Everything is laid
// out from the seed, so the same seed builds the same city every time.

import { BEACH_Y, LANDMARKS, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

const BUILDING_COLOURS = ['#3a4a7a', '#5a3a6e', '#2f5d4a', '#6e4a2f', '#4a4a6e', '#7a3a3a', '#33506b'];
const ROOF_COLOURS = ['#232a44', '#2e2140', '#1e3a2e', '#3a2a1e', '#2a2a40'];
const NEON_SIGNS = ['#ff2d78', '#00e5ff', '#f5d76e', '#9b59b6', '#2ecc71'];

/** The street blocks: the rectangles between the roads, for buildings. */
export function buildBlocks() {
  const xs = [-ROAD_W / 2, ...ROADS_V.map((x) => x + ROAD_W / 2)];
  const xe = [...ROADS_V.map((x) => x - ROAD_W / 2), WORLD.width + ROAD_W / 2];
  const ys = [-ROAD_W / 2, ...ROADS_H.map((y) => y + ROAD_W / 2)];
  const ye = [...ROADS_H.map((y) => y - ROAD_W / 2), BEACH_Y - ROAD_W / 2];
  const blocks = [];
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = 0; j < ys.length; j += 1) {
      blocks.push({ x0: xs[i], y0: ys[j], x1: xe[i], y1: ye[j] });
    }
  }
  return blocks;
}

/** Is the point on a road (including the sidewalk ring around it)? */
export function onRoad(x, y) {
  const margin = ROAD_W / 2 + 14;
  for (const rx of ROADS_V) if (Math.abs(x - rx) < margin) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < margin) return true;
  return false;
}

/** The nearest point on any road centre line, for snapping cars and peds. */
export function nearestRoadPoint(x, y) {
  let best = { x, y, dist: Infinity };
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < best.dist) best = { x: rx, y, dist: d };
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < best.dist) best = { x, y: ry, dist: d };
  }
  return best;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const x = pick(random, ROADS_V);
    return { x: x + range(random, -30, 30), y: range(random, 60, WORLD.height - 60), vertical: true };
  }
  const y = pick(random, ROADS_H);
  return { x: range(random, 60, WORLD.width - 60), y: y + range(random, -30, 30), vertical: false };
}

export function buildCity(random) {
  const blocks = buildBlocks();
  const buildings = [];
  const lamps = [];
  const palms = [];
  const parks = [];

  // One park block in the middle of the city, and one beside the beach.
  const parkBlocks = [
    { x0: 2240, y0: 1090, x1: 2360, y1: 1210 },
    { x0: 1240, y0: 1990, x1: 1360, y1: 2110 },
  ];
  for (const park of parkBlocks) {
    parks.push(park);
    for (let i = 0; i < 6; i += 1) {
      palms.push({ x: range(random, park.x0 + 14, park.x1 - 14), y: range(random, park.y0 + 14, park.y1 - 14) });
    }
  }

  function inPark(x, y, w, h) {
    for (const park of parks) {
      if (x < park.x1 && x + w > park.x0 && y < park.y1 && y + h > park.y0) return true;
    }
    return false;
  }

  function nearLandmark(x, y, w, h) {
    for (const mark of LANDMARKS) {
      if (Math.abs(mark.x - (x + w / 2)) < 130 && Math.abs(mark.y - (y + h / 2)) < 110) return true;
    }
    return false;
  }

  for (const block of blocks) {
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    if (bw < 90 || bh < 90) continue;
    // A couple of buildings per block, leaving a plaza gap between them.
    const count = rangeInt(random, 1, 3);
    for (let i = 0; i < count; i += 1) {
      const w = range(random, 80, Math.min(180, bw - 30));
      const h = range(random, 70, Math.min(150, bh - 30));
      const x = range(random, block.x0 + 12, block.x1 - w - 12);
      const y = range(random, block.y0 + 12, block.y1 - h - 12);
      if (inPark(x, y, w, h) || nearLandmark(x, y, w, h)) continue;
      if (random() < 0.18) continue;
      buildings.push({
        x,
        y,
        w,
        h,
        color: pick(random, BUILDING_COLOURS),
        roof: pick(random, ROOF_COLOURS),
        windows: Math.floor(random() * 100000),
        neon: random() < 0.3 ? pick(random, NEON_SIGNS) : null,
      });
    }
  }

  // Landmark buildings: bigger, drawn with their sign, and solid like the
  // rest. They sit just off the road corner, never on the asphalt itself,
  // so the mission marker on the street stays reachable.
  for (const mark of LANDMARKS) {
    buildings.push({
      x: mark.x + 80,
      y: mark.y + 80,
      w: 140,
      h: 100,
      color: '#3a4a7a',
      roof: '#232a44',
      windows: 424242,
      neon: mark.color,
      landmark: mark.short,
    });
  }

  // Street lamps along every avenue and street, and palms along the beach.
  for (const rx of ROADS_V) {
    for (let y = 140; y < BEACH_Y; y += 260) lamps.push({ x: rx + ROAD_W / 2 + 8, y });
  }
  for (const ry of ROADS_H) {
    for (let x = 140; x < WORLD.width; x += 260) lamps.push({ x, y: ry + ROAD_W / 2 + 8 });
  }
  for (let x = 120; x < WORLD.width; x += 170) {
    palms.push({ x: x + range(random, -20, 20), y: BEACH_Y + 46 + range(random, -10, 30) });
  }

  return { blocks, buildings, lamps, palms, parks, landmarks: LANDMARKS, beachY: BEACH_Y, waterY: WATER_Y };
}

// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. A night
// city: dark streets, neon signs, lamp glow, headlights, the HUD with its
// minimap, wanted stars and mission objective, and the menu panels.

import { BEACH_Y, FONT, PALETTE, ROADS_H, ROADS_V, ROAD_W, VIEW, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const MINIMAP = { x: 1040, y: 548, w: 216, h: 156 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, w, h);
  }

  /** The world rectangle the camera shows right now, for culling. */
  function visibleRect(state) {
    const cam = state.camera;
    return {
      x0: cam.x - VIEW.width / 2 - 80,
      y0: cam.y - VIEW.height / 2 - 80,
      x1: cam.x + VIEW.width / 2 + 80,
      y1: cam.y + VIEW.height / 2 + 80,
    };
  }

  function drawGround(world, vis) {
    const city = world.city;
    rect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0, PALETTE.ground);
    // Beach sand and water along the south edge.
    rect(vis.x0, BEACH_Y, vis.x1 - vis.x0, WATER_Y - BEACH_Y, PALETTE.sand);
    rect(vis.x0, WATER_Y, vis.x1 - vis.x0, vis.y1 - WATER_Y, PALETTE.water);
    context.fillStyle = PALETTE.waterLight;
    for (let x = 0; x < WORLD.width; x += 90) {
      const wave = Math.sin((x + world.state.elapsed * 40) / 130) * 6;
      context.fillRect(x, WATER_Y + 30 + wave, 46, 3);
      context.fillRect(x + 40, WATER_Y + 90 - wave, 40, 3);
    }
    // Parks.
    for (const park of city.parks) {
      rect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0, PALETTE.park);
    }
    // Sidewalk rings, then the asphalt itself.
    for (const rx of ROADS_V) rect(rx - ROAD_W / 2 - 14, 0, ROAD_W + 28, BEACH_Y, PALETTE.sidewalk);
    for (const ry of ROADS_H) rect(0, ry - ROAD_W / 2 - 14, WORLD.width, ROAD_W + 28, PALETTE.sidewalk);
    for (const rx of ROADS_V) rect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y, PALETTE.road);
    for (const ry of ROADS_H) rect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W, PALETTE.road);
    // Lane dashes.
    context.fillStyle = PALETTE.laneDash;
    for (const rx of ROADS_V) {
      for (let y = 30; y < BEACH_Y; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_H) {
      for (let x = 30; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Kerb lines where road meets sidewalk.
    context.strokeStyle = 'rgba(245, 215, 110, 0.35)';
    context.lineWidth = 2;
    for (const rx of ROADS_V) {
      context.beginPath();
      context.moveTo(rx - ROAD_W / 2, 0);
      context.lineTo(rx - ROAD_W / 2, BEACH_Y);
      context.moveTo(rx + ROAD_W / 2, 0);
      context.lineTo(rx + ROAD_W / 2, BEACH_Y);
      context.stroke();
    }
  }

  function drawBuildings(world, vis) {
    for (const b of world.city.buildings) {
      if (b.x > vis.x1 || b.x + b.w < vis.x0 || b.y > vis.y1 || b.y + b.h < vis.y0) continue;
      rect(b.x, b.y, b.w, b.h, b.color);
      rect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, b.roof);
      // Lit windows, seeded per building so they never flicker.
      let seed = b.windows;
      const next = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 24));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (next() < 0.42) {
            rect(b.x + 10 + cx * 26, b.y + 10 + cy * 24, 12, 10, next() < 0.8 ? '#ffd97a' : '#9fd8ff');
          }
        }
      }
      if (b.neon) {
        context.fillStyle = b.neon;
        context.fillRect(b.x + 8, b.y - 4, b.w - 16, 5);
      }
      if (b.landmark) {
        text(b.landmark, b.x + b.w / 2, b.y + b.h / 2, 15, '#ffffff', 'center', 'middle');
      }
    }
    // Palms: a trunk dot and a green crown.
    for (const palm of world.city.palms) {
      if (palm.x < vis.x0 || palm.x > vis.x1 || palm.y < vis.y0 || palm.y > vis.y1) continue;
      circle(palm.x, palm.y, 9, PALETTE.parkLight);
      circle(palm.x, palm.y, 5, '#2a6b3c');
    }
  }

  function drawLampGlow(world, vis) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const lamp of world.city.lamps) {
      if (lamp.x < vis.x0 || lamp.x > vis.x1 || lamp.y < vis.y0 || lamp.y > vis.y1) continue;
      const glow = context.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 70);
      glow.addColorStop(0, 'rgba(255, 217, 122, 0.20)');
      glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 70, 0, Math.PI * 2);
      context.fill();
      circle(lamp.x, lamp.y, 3, '#ffd97a');
    }
    context.restore();
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = 28;
    const halfW = 14;
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.fillRect(-halfL + 3, -halfW + 3, halfL * 2, halfW * 2);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-halfL, -halfW, halfL * 2, halfW * 2, 8);
    context.fill();
    // Cabin, windshield and roof.
    rect(-8, -halfW + 3, 18, halfW * 2 - 6, 'rgba(20, 28, 48, 0.9)');
    rect(-halfL + 4, -halfW + 4, 8, 6, 'rgba(220, 235, 255, 0.75)');
    rect(-halfL + 4, halfW - 10, 8, 6, 'rgba(220, 235, 255, 0.75)');
    // Headlights.
    context.fillStyle = '#fff6c9';
    context.fillRect(halfL - 2, -halfW + 2, 4, 5);
    context.fillRect(halfL - 2, halfW - 7, 4, 5);
    if (car.kind === 'police') {
      rect(-4, -halfW + 2, 10, 5, '#ffffff');
      rect(-4, halfW - 7, 10, 5, '#111111');
      const flash = Math.floor(car.siren * 2) % 2 === 0;
      circle(-2, -halfW - 2, 5, flash ? '#ff2d55' : '#2d7bff');
      circle(6, -halfW - 2, 5, flash ? '#2d7bff' : '#ff2d55');
      text('POLISI', 0, 0, 9, '#111111', 'center', 'middle');
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.neonCyan;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-halfL - 3, -halfW - 3, halfL * 2 + 6, halfW * 2 + 6, 10);
      context.stroke();
    }
    context.restore();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    context.rotate(ped.angle);
    circle(0, 0, 10, ped.color);
    circle(4, 0, 5, '#f2c9a0');
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(-8, -3, 6, 6);
    context.restore();
    if (ped.health < 100 && ped.health > 0) {
      rect(ped.x - 12, ped.y - 20, 24, 4, '#333');
      rect(ped.x - 12, ped.y - 20, 24 * (ped.health / 100), 4, '#e74c3c');
    }
  }

  function drawPlayer(world) {
    const p = world.state.player;
    if (p.car) return;
    // Blink while invulnerable after a hit.
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    circle(0, 0, 13, PALETTE.player);
    circle(5, 0, 6, '#f2c9a0');
    context.fillStyle = '#111827';
    context.fillRect(8, -3, 10, 6);
    context.restore();
    circle(p.x, p.y, 18, 'rgba(0, 229, 255, 0.18)');
  }

  function drawPickups(world, vis) {
    for (const pickup of world.state.pickups) {
      if (pickup.x < vis.x0 || pickup.x > vis.x1 || pickup.y < vis.y0 || pickup.y > vis.y1) continue;
      const bob = Math.sin(pickup.bob) * 3;
      const color = pickup.kind === 'health' ? '#2ecc71' : pickup.kind === 'ammo' ? '#f1c40f' : '#2ecc71';
      circle(pickup.x, pickup.y + bob, 12, color);
      text(pickup.kind === 'health' ? '+' : pickup.kind === 'ammo' ? 'A' : '$', pickup.x, pickup.y + bob + 5, 14, '#0b0f1e', 'center', 'middle');
    }
  }

  function drawBullets(world) {
    context.strokeStyle = '#ffe27a';
    context.lineWidth = 3;
    for (const b of world.state.bullets) {
      context.beginPath();
      context.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  function drawParticles(world) {
    for (const pt of world.state.particles) {
      context.globalAlpha = Math.max(0, pt.ttl / 0.8);
      circle(pt.x, pt.y, pt.size, pt.color);
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(world) {
    for (const f of world.state.floaters) {
      context.globalAlpha = Math.min(1, f.ttl);
      text(f.text, f.x, f.y, 18, f.color, 'center', 'middle');
    }
    context.globalAlpha = 1;
  }

  function drawMissionMarker(world, vis) {
    const step = world.missions.currentStep();
    if (!step || world.missions.isDone()) return;
    const pulse = 1 + Math.sin(world.state.elapsed * 4) * 0.15;
    const onScreen =
      step.x > vis.x0 && step.x < vis.x1 && step.y > vis.y0 && step.y < vis.y1;
    if (onScreen) {
      context.save();
      context.strokeStyle = PALETTE.neonYellow;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(step.x, step.y, 34 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(step.x, step.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.neonYellow;
      context.beginPath();
      context.moveTo(step.x, step.y - 52);
      context.lineTo(step.x - 10, step.y - 30);
      context.lineTo(step.x + 10, step.y - 30);
      context.closePath();
      context.fill();
      context.restore();
      if (step.type === 'hold' && world.missions.holdProgress > 0) {
        const frac = world.missions.holdProgress / (step.holdSeconds || 3);
        rect(step.x - 40, step.y - 70, 80, 8, 'rgba(0,0,0,0.6)');
        rect(step.x - 40, step.y - 70, 80 * frac, 8, PALETTE.neonYellow);
      }
    } else {
      // An arrow on the screen edge, pointing at the off-screen objective.
      // It is kept clear of the minimap in the bottom-right corner.
      const cam = world.state.camera;
      const dx = step.x - cam.x;
      const dy = step.y - cam.y;
      const angle = Math.atan2(dy, dx);
      let ex = cam.x + Math.cos(angle) * (VIEW.width / 2 - 60);
      let ey = cam.y + Math.sin(angle) * (VIEW.height / 2 - 60);
      const screenX = ex - cam.x + VIEW.width / 2;
      const screenY = ey - cam.y + VIEW.height / 2;
      if (screenX > 1000 && screenY > 500) {
        ex = cam.x + (1000 - VIEW.width / 2);
        ey = cam.y + (500 - VIEW.height / 2);
      }
      context.save();
      context.translate(ex, ey);
      context.rotate(angle);
      context.fillStyle = PALETTE.neonYellow;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      const dist = Math.round(Math.hypot(dx, dy));
      text(`${dist}m`, ex, ey - 22, 15, PALETTE.neonYellow, 'center', 'middle');
    }
  }

  function drawMinimap(world) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    panel(x - 6, y - 6, w + 12, h + 12);
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    rect(x, y, w, h, PALETTE.groundDark);
    rect(x, y + (BEACH_Y - 0) * sy, w, (WATER_Y - BEACH_Y) * sy, PALETTE.sand);
    rect(x, y + WATER_Y * sy, w, h - WATER_Y * sy, PALETTE.water);
    context.strokeStyle = '#4a5168';
    context.lineWidth = 2;
    for (const rx of ROADS_V) {
      context.beginPath();
      context.moveTo(x + rx * sx, y);
      context.lineTo(x + rx * sx, y + BEACH_Y * sy);
      context.stroke();
    }
    for (const ry of ROADS_H) {
      context.beginPath();
      context.moveTo(x, y + ry * sy);
      context.lineTo(x + WORLD.width * sx, y + ry * sy);
      context.stroke();
    }
    const step = world.missions.currentStep();
    if (step && !world.missions.isDone()) {
      circle(x + step.x * sx, y + step.y * sy, 6, PALETTE.neonYellow);
    }
    for (const cop of world.police.cars) {
      circle(x + cop.x * sx, y + cop.y * sy, 4, '#ff2d55');
    }
    const p = world.state.player;
    circle(x + p.x * sx, y + p.y * sy, 5, PALETTE.neonCyan);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x + p.x * sx, y + p.y * sy, 8, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    text('PETA — LEONIDA', x + w / 2, y - 12, 12, PALETTE.muted, 'center', 'alphabetic');
  }

  function drawHud(world, best) {
    const state = world.state;
    const p = state.player;
    // Top-left: money and health.
    panel(16, 14, 250, 64);
    text(`$${state.money.toLocaleString('id-ID')}`, 30, 40, 26, PALETTE.text, 'left', 'alphabetic');
    text('UANG', 30, 64, 12, PALETTE.muted, 'left', 'alphabetic');
    rect(150, 30, 100, 12, '#333');
    rect(150, 30, 100 * Math.max(0, p.health / 100), 12, p.health > 40 ? PALETTE.good : PALETTE.bad);
    text('NYAWA', 150, 58, 11, PALETTE.muted, 'left', 'alphabetic');
    // Top-right: wanted stars.
    panel(1014, 14, 250, 64);
    text('WANTED', 1028, 40, 15, PALETTE.muted, 'left', 'alphabetic');
    for (let i = 0; i < 5; i += 1) {
      text('★', 1110 + i * 28, 46, 26, i < state.wanted ? '#ffd94d' : 'rgba(255,255,255,0.18)', 'left', 'alphabetic');
    }
    // Top-centre: mission objective.
    const mission = world.missions.current();
    const step = world.missions.currentStep();
    if (mission && step) {
      const label = `${mission.title}  ·  ${step.label}`;
      context.font = `15px ${FONT}`;
      const width = Math.min(640, context.measureText(label).width + 40);
      panel((VIEW.width - width) / 2, 14, width, 44);
      text(label, VIEW.width / 2, 42, 15, PALETTE.text, 'center', 'alphabetic');
    } else if (world.missions.isDone()) {
      panel(440, 14, 400, 44);
      text('SEMUA MISI SELESAI — LEONIDA MILIKMU', VIEW.width / 2, 42, 15, PALETTE.good, 'center', 'alphabetic');
    }
    // Bottom-left: controls and ammo.
    panel(16, 640, 330, 64);
    if (p.car) {
      text(`KECEPATAN ${Math.round(Math.abs(p.car.speed) * 0.36)} km/j`, 30, 664, 15, PALETTE.text, 'left', 'alphabetic');
      text('WASD mengemudi · Spasi rem · E keluar mobil', 30, 688, 13, PALETTE.muted, 'left', 'alphabetic');
    } else {
      text(`PELURU ${p.ammo}  ·  Klik tembak · F pukul`, 30, 664, 15, PALETTE.text, 'left', 'alphabetic');
      text('WASD jalan · Shift lari · E masuk/curi mobil · P jeda', 30, 688, 13, PALETTE.muted, 'left', 'alphabetic');
    }
    // Bottom-right: minimap.
    drawMinimap(world);
    // Dialogue line at the bottom centre.
    const line = world.missions.dialogLine();
    if (line) {
      context.font = `17px ${FONT}`;
      const width = Math.min(760, context.measureText(line).width + 48);
      panel((VIEW.width - width) / 2, 560, width, 52);
      text(line, VIEW.width / 2, 592, 17, '#ffe9f3', 'center', 'alphabetic');
    }
    if (best > 0) text(`Rekor uang: $${best.toLocaleString('id-ID')}`, 16, 632, 13, PALETTE.muted, 'left', 'alphabetic');
  }

  function drawBanner(banner) {
    if (!banner) return;
    context.globalAlpha = Math.min(1, banner.ttl);
    context.font = `22px ${FONT}`;
    const width = Math.min(700, context.measureText(banner.text).width + 60);
    panel((VIEW.width - width) / 2, 96, width, 52);
    text(banner.text, VIEW.width / 2, 130, 22, PALETTE.neonYellow, 'center', 'alphabetic');
    context.globalAlpha = 1;
  }

  function drawPanelScreen(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center', 'alphabetic');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center', 'alphabetic');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.neonYellow, 'center', 'alphabetic');
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen. */
  function draw(world, screen, extras) {
    const state = world.state;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e1a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    const camX = state.camera.x + shakeX;
    const camY = state.camera.y + shakeY;
    context.save();
    context.translate(VIEW.width / 2 - camX, VIEW.height / 2 - camY);
    const vis = visibleRect(state);
    drawGround(world, vis);
    drawBuildings(world, vis);
    drawLampGlow(world, vis);
    drawPickups(world, vis);
    for (const car of world.allCars()) drawCar(car, car === state.car);
    for (const ped of world.traffic.peds) drawPed(ped);
    drawPlayer(world);
    drawBullets(world);
    drawParticles(world);
    drawFloaters(world);
    if (screen !== SCREEN_TITLE) drawMissionMarker(world, vis);
    context.restore();

    // Night vignette over the whole frame.
    const vignette = context.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95,
    );
    vignette.addColorStop(0, 'rgba(5, 8, 20, 0)');
    vignette.addColorStop(1, 'rgba(5, 8, 20, 0.55)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, VIEW.width, VIEW.height);

    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(5, 8, 20, 0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const save = extras.save;
      const lines = [
        'Kota Leonida, tengah malam. Jalan kaki, curi mobil, kabur dari polisi.',
        'Tiga misi, satu cerita: paket, razia, dan Bank Leonida.',
        'WASD jalan / mengemudi · E masuk & curi mobil · Klik tembak · F pukul · P jeda',
        save ? `Lanjutan tersimpan: Misi ${save.mission + 1}, uang $${save.money.toLocaleString('id-ID')}` : 'Belum ada simpanan — mulai dari Misi 1.',
        extras.best > 0 ? `Rekor uang: $${extras.best.toLocaleString('id-ID')}` : '',
      ];
      drawPanelScreen('LEONIDA NIGHTS', lines, save ? 'Enter: lanjutkan  ·  N: permainan baru' : 'Enter / klik: mulai', PALETTE.neonCyan);
      return;
    }
    drawHud(world, extras.best);
    drawBanner(extras.banner);
    if (screen === SCREEN_PAUSED) {
      drawPanelScreen('Jeda', ['Kota Leonida menunggumu.', 'Progres tersimpan otomatis tiap misi selesai.'], 'P: lanjutkan', PALETTE.neonCyan);
    } else if (screen === SCREEN_OVER) {
      const over = state.over || { kind: 'busted', reason: '' };
      const title = over.kind === 'busted' ? 'KETANGKAP!' : 'TUMBANG!';
      drawPanelScreen(title, [over.reason, `Uang: $${state.money.toLocaleString('id-ID')}  ·  Misi ${world.missions.index + 1} dari 3`], 'Enter: coba lagi dari misi ini', PALETTE.bad);
    } else if (screen === SCREEN_WIN) {
      drawPanelScreen(
        'LEONIDA MILIKMU',
        ['Tiga misi selesai. $1.500 dari Bank Leonida sudah di tangan.', `Total uang: $${state.money.toLocaleString('id-ID')}`, 'Raka dan Rico kini menguasai malam di kota Leonida.'],
        'Enter: main lagi dari awal',
        PALETTE.good,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

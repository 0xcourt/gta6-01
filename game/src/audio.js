// Sound, all synthesised with WebAudio: no audio files, no network. A
// tiny engine hum that follows the car's speed, a two-tone police siren,
// and one-shot blips for shots, punches, crashes, pickups and missions.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
    } catch {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
    return true;
  }

  /** Call from a user gesture so the browser lets audio start. */
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!enabled || !ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio is decoration: a failure here must never break the game.
    }
  }

  function noise(duration, volume, lowpass) {
    if (!enabled || !ensure()) return;
    try {
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // See blip: audio never breaks the game.
    }
  }

  return {
    unlock,
    shot() {
      noise(0.12, 0.5, 3200);
      blip(180, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.09, 0.4, 500);
      blip(120, 0.1, 'sine', 0.3, 50);
    },
    crash() {
      noise(0.25, 0.5, 900);
      blip(90, 0.2, 'sawtooth', 0.25, 40);
    },
    steal() {
      blip(520, 0.09, 'square', 0.15);
      setTimeout(() => blip(660, 0.12, 'square', 0.15), 90);
    },
    pickup() {
      blip(880, 0.1, 'sine', 0.2);
      setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 90);
    },
    mission() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => blip(freq, 0.16, 'sine', 0.22), i * 110));
    },
    alarm() {
      blip(1200, 0.3, 'square', 0.16, 900);
      setTimeout(() => blip(1200, 0.3, 'square', 0.16, 900), 320);
    },
    busted() {
      [400, 300, 200].forEach((freq, i) => setTimeout(() => blip(freq, 0.25, 'sawtooth', 0.2), i * 160));
    },
    /** Engine hum follows speed; the siren wails while police are close. */
    update(dt, speed, policeNear) {
      if (!ctx || !enabled) return;
      try {
        const target = speed > 20 ? 0.05 + Math.min(0.08, Math.abs(speed) / 9000) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.16, ctx.currentTime, 0.1);
        if (policeNear) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenTimer = 0.42;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
          }
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        }
      } catch {
        // Audio never breaks the game.
      }
    },
    toggle() {
      enabled = !enabled;
      if (!enabled && ctx) {
        engineGain.gain.value = 0;
        sirenGain.gain.value = 0;
      }
      return enabled;
    },
  };
}

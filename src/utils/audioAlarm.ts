/**
 * Web Audio API synthesizer & vibration utility for Geofence Proximity Alarm.
 * Does not require external MP3 downloads and works completely offline.
 */

let audioCtx: AudioContext | null = null;
let alarmIntervalId: number | null = null;
let vibrationIntervalId: number | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a pleasant but attention-grabbing high-urgency chime sequence.
 * 2 pulses: 587.33 Hz (D5) -> 880.00 Hz (A5)
 */
export function playChimeBeep(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Pulse 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);

    // Pulse 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.32); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.55); // D6

    gain2.gain.setValueAtTime(0, now + 0.32);
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.32);
    osc2.stop(now + 0.7);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

/**
 * Triggers device vibration pattern if supported by browser.
 */
export function triggerVibration(pattern: number[] = [400, 180, 400, 180, 700]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

/**
 * Starts continuous alarm loop (sound and/or vibration).
 */
export function startAlarmLoop(enableSound = true, enableVibration = true): void {
  stopAlarmLoop();

  // Play immediately once
  if (enableSound) {
    playChimeBeep();
  }
  if (enableVibration) {
    triggerVibration([500, 200, 500, 200, 800]);
  }

  // Periodic repetition
  if (enableSound) {
    alarmIntervalId = window.setInterval(() => {
      playChimeBeep();
    }, 1100);
  }

  if (enableVibration) {
    vibrationIntervalId = window.setInterval(() => {
      triggerVibration([500, 200, 500, 200, 800]);
    }, 1800);
  }
}

/**
 * Stops any active alarm loop and cancels vibration.
 */
export function stopAlarmLoop(): void {
  if (alarmIntervalId !== null) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  if (vibrationIntervalId !== null) {
    clearInterval(vibrationIntervalId);
    vibrationIntervalId = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}

import { SFX, type SfxId, type SfxLayer, TRACKS, type TrackId, trackBpm } from "@/content/audio";

type Ctx = AudioContext;

const midiToHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/**
 * All sound in v0 is synthesized from content/audio (MM-120): WebAudio unlocks on the first touch,
 * music loops on a look-ahead scheduler, and everything goes quiet when the app is in the background.
 */
class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;
  private track: TrackId | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSfx = new Map<SfxId, number>();
  private suspended = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.5;
      this.musicGain.connect(this.master);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
    }
    if (this.ctx.state === "suspended" && !this.suspended) void this.ctx.resume().catch(() => undefined);
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.value = music * 0.5;
  }

  /** Mute while the app is in the background; resume when it returns. */
  setActive(active: boolean): void {
    this.suspended = !active;
    if (!this.ctx) return;
    if (active) void this.ctx.resume().catch(() => undefined);
    else void this.ctx.suspend().catch(() => undefined);
  }

  private layer(l: SfxLayer, at: number, dest: AudioNode, gainScale = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = at + (l.delay ?? 0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, l.gain * gainScale), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + l.dur);
    g.connect(dest);
    if (l.type === "tone") {
      const o = ctx.createOscillator();
      o.type = l.wave ?? "sine";
      o.frequency.setValueAtTime(l.from, t0);
      if (l.to !== l.from) o.frequency.exponentialRampToValueAtTime(Math.max(20, l.to), t0 + l.dur);
      o.connect(g);
      o.start(t0);
      o.stop(t0 + l.dur + 0.02);
    } else if (this.noise) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = l.filter ?? "lowpass";
      f.frequency.setValueAtTime(l.from, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, l.to), t0 + l.dur);
      src.connect(f);
      f.connect(g);
      src.start(t0, Math.random() * 0.1);
      src.stop(t0 + l.dur + 0.02);
    }
  }

  sfx(id: SfxId, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0 || ctx.state !== "running") return;
    // Don't stack the same sound within a couple of frames.
    const now = ctx.currentTime;
    if (now - (this.lastSfx.get(id) ?? -1) < 0.03) return;
    this.lastSfx.set(id, now);
    for (const l of SFX[id]) this.layer(l, now, this.sfxGain, volume);
  }

  music(id: TrackId | null): void {
    if (id === this.track) return;
    this.track = id;
    this.step = 0;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!id) return;
    this.nextTime = 0;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.track || ctx.state !== "running") return;
    const tr = TRACKS[this.track];
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const i = this.step % tr.lead.length;
      const stepDur = 60 / trackBpm(tr, Math.floor(this.step / tr.lead.length)) / 4;
      const t = this.nextTime;
      const lead = tr.lead[i];
      if (lead) {
        const hz = midiToHz(lead);
        this.layer({ type: "tone", wave: tr.leadWave, from: hz, to: hz, dur: stepDur * 1.7, gain: 0.11 }, t, this.musicGain);
      }
      const bass = tr.bass[i % tr.bass.length];
      if (bass) {
        const hz = midiToHz(bass);
        this.layer({ type: "tone", wave: "triangle", from: hz, to: hz, dur: stepDur * 1.5, gain: 0.3 }, t, this.musicGain);
      }
      const d = tr.drums[i % tr.drums.length];
      if (d === "k") this.layer({ type: "tone", wave: "sine", from: 150, to: 45, dur: 0.11, gain: 0.5 }, t, this.musicGain);
      else if (d === "s") this.layer({ type: "noise", from: 2200, to: 900, dur: 0.09, gain: 0.26, filter: "bandpass" }, t, this.musicGain);
      else if (d === "h") this.layer({ type: "noise", from: 7000, to: 6000, dur: 0.03, gain: 0.09, filter: "highpass" }, t, this.musicGain);
      else if (d === "c") {
        this.layer({ type: "tone", wave: "sine", from: 2637, to: 2637, dur: 0.16, gain: 0.06 }, t, this.musicGain);
        this.layer({ type: "noise", from: 8000, to: 7000, dur: 0.05, gain: 0.06, filter: "highpass" }, t, this.musicGain);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();

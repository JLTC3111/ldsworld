const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (min, max, value) => { const t = clamp((value - min) / (max - min)); return t * t * (3 - 2 * t); };
const presets = { sunrise: 6.1 / 24, day: 12 / 24, sunset: 17.9 / 24, night: 22 / 24 };
export const TIME_MODES = Object.freeze(['auto', 'sunrise', 'day', 'sunset', 'night']);
export const WEATHER_MODES = Object.freeze(['clear', 'rain', 'snow', 'auto']);

export class EnvironmentClock {
  constructor({ cycleSeconds = 270, phase = 8.5 / 24, weatherInterval = 80 } = {}) {
    this.cycleSeconds = Number.isFinite(Number(cycleSeconds)) ? Math.max(30, Number(cycleSeconds) || 270) : 270;
    this.weatherInterval = Number.isFinite(Number(weatherInterval)) ? Math.max(10, Number(weatherInterval) || 80) : 80;
    const initialPhase = Number.isFinite(Number(phase)) ? Number(phase) : 8.5 / 24;
    this.phase = (initialPhase % 1 + 1) % 1;
    this.timeMode = 'auto';
    this.weatherMode = 'clear';
    this.weatherElapsed = 0;
  }
  setTimeMode(mode) {
    if (!TIME_MODES.includes(mode)) throw new RangeError(`Unknown time mode: ${mode}`);
    this.timeMode = mode;
    if (mode !== 'auto') this.phase = presets[mode];
    return this.getState();
  }
  setWeather(mode) {
    if (!WEATHER_MODES.includes(mode)) throw new RangeError(`Unknown weather mode: ${mode}`);
    this.weatherMode = mode;
    if (mode === 'auto') this.weatherElapsed = 0;
    return this.getState();
  }
  update(elapsed = 0, paused = false) {
    const dt = !paused && Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    if (this.timeMode === 'auto') this.phase = (this.phase + dt / this.cycleSeconds) % 1;
    if (this.weatherMode === 'auto') this.weatherElapsed = (this.weatherElapsed + dt) % (this.weatherInterval * 3);
    return this.getState();
  }
  getState() {
    const hour = this.phase * 24;
    const sunAngle = (this.phase - .25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = smooth(-.18, .25, sunHeight);
    const night = 1 - smooth(-.16, .15, sunHeight);
    const warmth = clamp(1 - Math.abs(sunHeight) / .42) * (1 - night * .55);
    const weather = this.weatherMode === 'auto' ? ['clear', 'rain', 'snow'][Math.floor(this.weatherElapsed / this.weatherInterval)] : this.weatherMode;
    return {
      phase: this.phase, hour, daylight, night, warmth, sunHeight, sunAngle,
      weather, weatherMode: this.weatherMode, timeMode: this.timeMode,
      cycleLabel: hour < 5.5 || hour >= 19 ? 'night' : hour < 7 ? 'sunrise' : hour >= 17 ? 'sunset' : 'day'
    };
  }
}

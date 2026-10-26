// The world-facing title follows the actual sunlight; panel theme stays separate.
export function getScenePresentation(environment = {}) {
  const phase = ['day','sunrise','sunset','night'].includes(environment.cycleLabel) ? environment.cycleLabel : 'day';
  const dark = Number(environment.night) > .5;
  const wet = environment.weather === 'rain';
  const wash = dark ? '#202020' : wet ? '#dedede' : phase === 'sunrise' ? '#f0f0f0' : phase === 'sunset' ? '#e6e6e6' : '#f5f5f5';
  return {
    key:`${phase}-${dark?'dark':'light'}-${wet?'rain':'clear'}`, phase,
    ink:dark?'#fafafa':'#171717', muted:dark?'#d5d5d5':'#4b4b4b', wash
  };
}

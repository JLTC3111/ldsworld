// The world-facing title follows the actual sunlight; panel theme stays separate.
export function getScenePresentation(environment = {}) {
  const phase = ['day','sunrise','sunset','night'].includes(environment.cycleLabel) ? environment.cycleLabel : 'day';
  const dark = Number(environment.night) > .5;
  const wet = environment.weather === 'rain';
  const wash = dark ? '#182d3c' : wet ? '#d7e1df' : phase === 'sunrise' ? '#f4d3ad' : phase === 'sunset' ? '#e9c9b9' : '#eef0e6';
  return {
    key:`${phase}-${dark?'dark':'light'}-${wet?'rain':'clear'}`, phase,
    ink:dark?'#f5f1de':'#29392e', muted:dark?'#cbd8d5':'#425448', wash
  };
}

// The world-facing title follows the actual sunlight; panel theme stays separate.
export function getScenePresentation(environment = {}) {
  const phase = ['day','sunrise','sunset','night'].includes(environment.cycleLabel) ? environment.cycleLabel : 'day';
  const dark = Number(environment.night) > .5;
  const wet = environment.weather === 'rain';
  const wash = dark ? '#24282d' : wet ? '#dfdedc' : phase === 'sunrise' ? '#eee8dd' : phase === 'sunset' ? '#e7dfd3' : '#ece9e1';
  return {
    key:`${phase}-${dark?'dark':'light'}-${wet?'rain':'clear'}`, phase,
    ink:dark?'#e4e0d7':'#41474b', muted:dark?'#c2c4c4':'#575e62', wash
  };
}

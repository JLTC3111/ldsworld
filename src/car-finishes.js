const palettes={
  '8-ball':{red:'#ff3829',red_lite:'#ffb08c',red_dark:'#c92328',white:'#fff5e4',domed_black:'#19232f',black:'#343c45'},
  'monster-truck':{green:'#46b968',green_light:'#a9ee8b',green_dark:'#287a50',gold:'#e7bd52',gold_bright:'#ffe18a',croc_belly:'#e5efb7'},
  'toy-story':{blue:'#299fdf',yellow:'#ffd45d',brown:'#bf9068',brown_dark:'#76533e',gold:'#ebc35d',white:'#fff4df'}
};

export function suppliedCarFinish(id,meshName,original){
  const name=meshName.split('__').at(-1),rubber=/tire|rubber|tread/.test(name),canopy=/domed_black|glass/.test(name);
  const paint=!rubber&&!canopy&&/^(?:red|green|yellow|blue|brown|croc_belly)/.test(name);
  return {
    color:rubber?'#32383f':palettes[id]?.[name]||original.color,
    roughness:rubber?.88:canopy?.13:paint?.25:/white|light/.test(name)?.32:original.roughness,
    metalness:rubber?0:paint?.16:original.metalness,
    clearcoat:(paint||canopy) ? .95 : 0,clearcoatRoughness:canopy ? .12 : .2,
    visibilityPaint:paint,emissiveIntensity:paint?.035:0
  };
}

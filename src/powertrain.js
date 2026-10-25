const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const GEAR_SPEEDS=[0,7,13,20,29,40,62];

// A virtual six-speed transmission keeps the sound climbing and dropping through
// the gears instead of sitting on one note once the car reaches cruising speed.
export function powertrainState(speed,{throttle=0,airborne=false,boosting=false}={}){
  const velocity=Math.abs(Number.isFinite(speed)?speed:0),load=clamp(throttle,0,1);
  const next=GEAR_SPEEDS.findIndex(limit=>limit>velocity);
  const gear=speed<-.2?-1:velocity<.2?0:next<0?6:next;
  const low=gear>0?GEAR_SPEEDS[gear-1]:0,high=gear>0?GEAR_SPEEDS[gear]:13;
  const progress=clamp((velocity-low)/(high-low),0,1);
  let rpm=gear===0?950:(gear===1||gear===-1?950:3200)+progress*(gear===1||gear===-1?7050:4800)+load*650;
  if(airborne&&(load||boosting))rpm=Math.max(rpm,6200+load*2400+(boosting?250:0));
  return {gear,rpm:clamp(rpm,950,9000)};
}

// Keep the cars distinct with a soft, low cruising hum. These audio redlines
// do not change vehicle speed, acceleration or the physical transmission.
export const ENGINE_VOICES={
  '8-ball':{redline:5200,firing:1/30,sub:.18,body:.32,edge:.025,top:.008,filter:.9,gain:1},
  'monster-truck':{redline:3800,firing:1/40,sub:.24,body:.3,edge:.018,top:.005,filter:.72,gain:1},
  'toy-story':{redline:4300,firing:1/35,sub:.21,body:.31,edge:.02,top:.006,filter:.8,gain:1},
  explorer:{redline:4700,firing:1/32,sub:.2,body:.31,edge:.022,top:.007,filter:.85,gain:1}
};

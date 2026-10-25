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

// The roadster takes its high-rev character from a naturally aspirated flat-six.
// The larger toys use lower redlines, stronger subharmonics, and softer intakes.
export const ENGINE_VOICES={
  '8-ball':{redline:9000,firing:1/20,sub:.34,body:.5,edge:.2,top:.11,filter:1.15,gain:1},
  'monster-truck':{redline:6200,firing:1/30,sub:.62,body:.5,edge:.12,top:.04,filter:.66,gain:1.08},
  'toy-story':{redline:6800,firing:1/30,sub:.5,body:.48,edge:.14,top:.07,filter:.83,gain:1.02},
  explorer:{redline:7600,firing:1/24,sub:.4,body:.48,edge:.16,top:.08,filter:.96,gain:1}
};

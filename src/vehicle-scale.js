import { CAR_PIVOT_HEIGHT } from './aerial-dynamics.js';
export const VEHICLE_SCALE=1.4;

// Keep model coordinates local while collision bounds, suspension travel and
// the aerial pivot agree with the larger car in world metres.
export function scaleVehicle(vehicle,{THREE:T,scale=VEHICLE_SCALE}){
  const profile=vehicle.profile,update=vehicle.update.bind(vehicle),offset=new T.Vector3();
  vehicle.visualProfile=profile;
  vehicle.profile=Object.fromEntries(Object.entries(profile).map(([key,value])=>[key,typeof value==='number'?value*scale:value]));
  vehicle.profile.pivotHeight=CAR_PIVOT_HEIGHT*scale;vehicle.profile.scale=scale;
  vehicle.root.scale.setScalar(scale);
  vehicle.headLights.forEach(light=>light.distance*=scale);
  const localDriver={};
  vehicle.update=(dt,options)=>{
    const driver=options.driver;Object.setPrototypeOf(localDriver,driver);
    localDriver.speed=(driver.speed||0)/scale;
    localDriver.rideHeight=(driver.rideHeight??vehicle.profile.raised)/scale;
    localDriver.hydraulicOffset=(driver.hydraulicOffset||0)/scale;
    localDriver.wheelHeights=Object.fromEntries(Object.entries(driver.wheelHeights||{}).map(([key,value])=>[key,(driver.groundHeight||0)+(value-(driver.groundHeight||0))/scale]));
    update(dt,{...options,driver:localDriver});
    if(driver.attitude&&(driver.attitude.flying||driver.attitude.recovering)){
      offset.set(0,CAR_PIVOT_HEIGHT*(scale-1),0).applyQuaternion(vehicle.root.quaternion);
      vehicle.root.position.x-=offset.x;vehicle.root.position.y+=CAR_PIVOT_HEIGHT*(scale-1)-offset.y;vehicle.root.position.z-=offset.z;
    }
    vehicle.headLights.forEach(light=>light.intensity*=scale*scale);
  };
  return vehicle;
}

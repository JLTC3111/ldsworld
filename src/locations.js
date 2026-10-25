import { projects,localizeProject } from './data.js';
import { roadNodes } from './driving.js';
import { portals,houses,LANDMARKS } from './world-layout.js';

export function mapLocations(language='en'){
  const vi=language==='vi';
  return [
    {id:'town',name:vi?'Trung tâm thị trấn':'Town centre',x:0,z:13,spawn:[0,13],kind:'town'},
    ...projects.map(p=>({id:`project-${p.id}`,name:localizeProject(p,language).short,x:p.position[0],z:p.position[1],spawn:roadNodes[p.stop],kind:'project',projectId:p.id,color:p.color})),
    {id:'bowling',name:vi?'Bãi bowling':'Bowling',x:39,z:46,spawn:[39,32],kind:'play'},
    {id:'tnt',name:vi?'Bãi TNT':'TNT playground',x:-47,z:23,spawn:[-44,13],kind:'play'},
    ...portals.map((p,i)=>({id:p.id,name:vi?(i?'Cổng ven biển':'Cổng khu rừng'):(i?'Coastal portal':'Forest portal'),x:p.x,z:p.z,spawn:[p.x-Math.sin(p.heading)*4,p.z-Math.cos(p.heading)*4],heading:p.heading,kind:'portal'})),
    ...houses.map((h,i)=>({id:`cottage-${i+1}`,name:vi?`Nhà ven đường ${i+1}`:`Cottage ${i+1}`,x:h.x,z:h.z,spawn:[h.x,h.z+7],kind:'place'})),
    {id:'lighthouse',name:vi?'Hải đăng':'Lighthouse',...LANDMARKS.lighthouse,spawn:[LANDMARKS.lighthouse.x+5,LANDMARKS.lighthouse.z],kind:'place'},
    {id:'pond',name:vi?'Hồ hoa súng':'Lily pond',...LANDMARKS.pond,spawn:[LANDMARKS.pond.x+6,LANDMARKS.pond.z-4],kind:'place'}
  ];
}

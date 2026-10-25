import { projects,localizeProject } from './data.js';
import { roadNodes } from './driving.js';
import { portals,houses,bridges,LANDMARKS,MAP_BOUNDS } from './world-layout.js';
import { islandLifeLayout } from './island-life.js';

export function mapLocations(language='en'){
  const vi=language==='vi';
  const locations=[
    {id:'town',name:vi?'Trung tâm thị trấn':'Town centre',x:0,z:13,spawn:[0,13],kind:'town'},
    ...projects.map(p=>({id:`project-${p.id}`,name:localizeProject(p,language).short,x:p.position[0],z:p.position[1],spawn:roadNodes[p.stop],kind:'project',projectId:p.id,color:p.color})),
    {id:'bowling',name:vi?'Bãi bowling':'Bowling',x:39,z:46,spawn:[39,32],kind:'play'},
    {id:'tnt',name:vi?'Bãi TNT':'TNT playground',x:-47,z:23,spawn:[-44,13],kind:'play'},
    ...portals.map((p,i)=>({id:p.id,name:vi?(i?'Cổng ven biển':'Cổng khu rừng'):(i?'Coastal portal':'Forest portal'),x:p.x,z:p.z,spawn:[p.x-Math.sin(p.heading)*4,p.z-Math.cos(p.heading)*4],heading:p.heading,kind:'portal'})),
    ...houses.map((h,i)=>({id:`cottage-${i+1}`,name:vi?`Nhà ven đường ${i+1}`:`Cottage ${i+1}`,x:h.x,z:h.z,spawn:[h.x,h.z+7],kind:'place'})),
    {id:'lighthouse',name:vi?'Hải đăng':'Lighthouse',...LANDMARKS.lighthouse,spawn:[LANDMARKS.lighthouse.x+5,LANDMARKS.lighthouse.z],kind:'place'},
    {id:'pond',name:vi?'Hồ hoa súng':'Lily pond',...LANDMARKS.pond,spawn:[LANDMARKS.pond.x+6,LANDMARKS.pond.z-4],kind:'place'},
    ...islandLifeLayout.filter(p=>p.kind==='stall').map((p,i)=>({id:`market-${i+1}`,name:vi?(i?'Quầy nông sản':'Quầy cà phê đèn lồng'):(i?'Produce market':'Lantern coffee stall'),x:p.x,z:p.z,spawn:[p.x,p.z+5],kind:'market'})),
    {id:'snowmen',name:vi?'Những người tuyết':'Snowmen',x:-38,z:-14,spawn:[-43,-14],kind:'play'},
    {id:'woodland',name:vi?'Khu rừng tương tác':'Breakable woodland',x:-57,z:23,spawn:[-62,23],kind:'nature'},
    {id:'sculpture',name:vi?'Tượng điêu khắc':'Sculpture',...LANDMARKS.sculpture,spawn:[LANDMARKS.sculpture.x+5,LANDMARKS.sculpture.z],kind:'play'},
    {id:'cart',name:vi?'Xe kéo ven sông':'Riverside handcart',...LANDMARKS.cart,spawn:[LANDMARKS.cart.x+5,LANDMARKS.cart.z],kind:'play'},
    {id:'welcome',name:vi?'Biển chào mừng':'Welcome sign',...LANDMARKS.welcome,spawn:[LANDMARKS.welcome.x+5,LANDMARKS.welcome.z],kind:'place'},
    ...bridges.map((p,i)=>({id:`bridge-${p.id}`,name:vi?`Cầu ${['phía tây','thị trấn','phía đông','bờ tây','bờ đông'][i]}`:`${['West','Town','East','West coast','East coast'][i]} bridge`,x:p.x,z:p.z,spawn:[p.x-Math.sin(p.heading)*(p.length/2+4),p.z-Math.cos(p.heading)*(p.length/2+4)],heading:p.heading,kind:'bridge'}))
  ];
  return locations.map(location=>({...location,category:location.projectId?'buildings':'objects'}));
}

export function mapFrame({zoom=1,centre={x:0,z:0}}={}){
  zoom=Math.max(1,Math.min(6,Number(zoom)||1));
  const halfWidth=MAP_BOUNDS.x/zoom,halfHeight=MAP_BOUNDS.z/zoom;
  return {x:Math.max(-MAP_BOUNDS.x+halfWidth,Math.min(MAP_BOUNDS.x-halfWidth,centre.x)),z:Math.max(-MAP_BOUNDS.z+halfHeight,Math.min(MAP_BOUNDS.z-halfHeight,centre.z)),halfWidth,halfHeight};
}

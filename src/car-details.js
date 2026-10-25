// Road equipment added around the supplied bodies, keeping their distinct
// canopies, hats and character shapes intact.
export function createCarDetails({THREE:T,root,body,profile,id}){
  body.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(body),front=bounds.max.z+.055,rear=bounds.min.z-.055;
  const y=id==='monster-truck'?1.22:id==='toy-story'?1.04:.68;
  const geometries=new Set(),materials=new Set(),textures=new Set(),headLights=[],tailLights=[],indicators=[],reverseLights=[];
  const cube=new T.BoxGeometry(1,1,1);geometries.add(cube);
  const material=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.35,...options});materials.add(m);return m;};
  const black=material('#192329',{roughness:.7}),chrome=material('#b8c3c7',{metalness:.85,roughness:.2}),mirror=material('#93b0bc',{metalness:1,roughness:.08});
  const white=material('#fff5df',{emissive:'#ffe4b2',emissiveIntensity:1.5}),red=material('#b71920',{emissive:'#ff1923',emissiveIntensity:.8}),reverse=material('#e6f5ff',{emissive:'#d5f1ff',emissiveIntensity:.05});
  const box=(name,w,h,d,m,x,py,z,parent=body)=>{const mesh=new T.Mesh(cube,m);mesh.name=name;mesh.scale.set(w,h,d);mesh.position.set(x,py,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  for(const side of [-1,1]){
    const x=side*Math.min(profile.halfWidth*.58,.62);
    box('Headlamp housing',.34,.22,.11,black,x,y,front);box('Projector headlight lens',.27,.12,.027,white,x,y+.025,front+.067);box('LED daytime running light',.3,.025,.029,white,x,y-.07,front+.068);
    box('Rear lamp housing',.28,.22,.09,black,x,y,rear);tailLights.push(box('Tail and brake light',.22,.11,.028,red,x,y+.035,rear-.058));
    reverseLights.push(box('Reversing light',.09,.035,.03,reverse,x-side*.065,y-.055,rear-.06));
    for(const z of [front+.07,rear-.06]){const m=material('#e69a2f',{emissive:'#ff941b',emissiveIntensity:.12});indicators.push({side,mesh:box('Amber turn indicator',.065,.09,.033,m,x+side*.115,y+.015,z),material:m});}
    const lamp=new T.SpotLight('#ffe9bb',0,27,Math.PI/6,.7,1.2),target=new T.Object3D();lamp.name='Road headlight';lamp.position.set(x,y,front+.12);target.position.set(x,.04,front+13);root.add(lamp,target);lamp.target=target;headLights.push(lamp);
    const mirrorX=side*(id==='monster-truck'?.74:id==='toy-story'?.85:.82),mirrorY=id==='monster-truck'?1.52:id==='toy-story'?1.47:1;
    box('Mirror arm',.2,.035,.045,black,mirrorX-side*.07,mirrorY,.32);box('Wing mirror housing',.13,.18,.2,black,mirrorX,mirrorY,.32);box('Mirror glass',.012,.13,.15,mirror,mirrorX+side*.07,mirrorY,.32);
    const exhaustGeometry=new T.CylinderGeometry(.055,.065,.32,12);geometries.add(exhaustGeometry);const exhaust=new T.Mesh(exhaustGeometry,chrome);exhaust.name='Exhaust outlet';exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.4,Math.max(.35,y-.3),rear-.06);body.add(exhaust);
  }
  box('Front bumper',Math.min(profile.halfWidth*1.7,1.75),.1,.11,black,0,y-.2,front+.015);box('Rear bumper',Math.min(profile.halfWidth*1.7,1.75),.1,.11,black,0,y-.2,rear-.015);
  for(let i=0;i<7;i++)box('Grille slat',.018,.13,.025,chrome,(i-3)*.065,y-.12,front+.078);
  box('High mounted brake light',.28,.035,.03,red,0,y+(id==='8-ball'?.12:.27),rear-.06);
  const plateMaterial=material('#eeeeda',{roughness:.7});
  try{const canvas=globalThis.document?.createElement('canvas'),ctx=canvas?.getContext('2d');if(ctx?.fillText){canvas.width=256;canvas.height=96;ctx.fillStyle='#f1efdf';ctx.fillRect(0,0,256,96);ctx.fillStyle='#1b3037';ctx.font='bold 51px monospace';ctx.textAlign='center';ctx.fillText('LD 3111',128,66);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;plateMaterial.map=texture;textures.add(texture);}}
  catch{}
  for(const z of [front+.085,rear-.075])box('Registration plate LD 3111',.35,.13,.018,plateMaterial,0,y-.075,z);
  profile.halfLength=Math.max(profile.halfLength,front+.14,-rear+.14);
  let lastSpeed=0;
  return {headLights,tailLights,update({driver,night=0,headlights='auto',braking=false,time=0}){
    const active=headlights==='off'?0:headlights==='on'?1:Math.max(.25,night),lift=(driver.rideHeight??profile.raised)+(driver.hydraulicOffset||0);
    headLights.forEach(l=>{l.intensity=48*active;l.position.y=y+lift;});white.emissiveIntensity=1.1+active*4;
    red.emissiveIntensity=braking||driver.speed<lastSpeed-.4?5.5:.6+night*1.5;lastSpeed=driver.speed;
    reverse.emissiveIntensity=driver.speed<-.15?3.5:.05;
    for(const i of indicators)i.material.emissiveIntensity=Math.abs(driver.steering||0)>.18&&Math.sign(driver.steering)===-i.side&&Math.sin(time*9)>0?4:.12;
  },dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

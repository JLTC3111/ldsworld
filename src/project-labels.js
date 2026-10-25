import { Font } from './vendor/FontLoader.js';
import fontData from './vendor/project-glyphs.js';
import { localizeProject } from './data.js';

const polygon=points=>'m '+points[0].join(' ')+' '+points.slice(1).map(p=>'l '+p.join(' ')).join(' ')+' l '+points[0].join(' ');
function addGlyph(char){
  if(fontData.glyphs[char])return;const [letter,...marks]=char.normalize('NFD'),base=fontData.glyphs[letter==='Đ'?'D':letter];if(!base)return;
  const cx=base.ha/2;let outline=base.o||'',stack=0;
  if(letter==='Đ')outline+=' '+polygon([[-45,510],[base.ha*.66,510],[base.ha*.66,595],[-45,595]]);
  for(const mark of marks){
    const y=1125+stack*180;let points=[];
    if(mark==='\u0302')points=[[cx-150,y],[cx,y+170],[cx+150,y],[cx+65,y],[cx,y+85],[cx-65,y]];
    else if(mark==='\u0301')points=[[cx-40,y],[cx+90,y+165],[cx+195,y+165],[cx+40,y]];
    else if(mark==='\u0300')points=[[cx+40,y],[cx-90,y+165],[cx-195,y+165],[cx-40,y]];
    else if(mark==='\u0306')points=[[cx-155,y+140],[cx-80,y+140],[cx-50,y+65],[cx+50,y+65],[cx+80,y+140],[cx+155,y+140],[cx+105,y],[cx-105,y]];
    else if(mark==='\u0303')points=[[cx-165,y+40],[cx-100,y+130],[cx-30,y+130],[cx+70,y+70],[cx+115,y+130],[cx+175,y+100],[cx+110,y+10],[cx+40,y+10],[cx-70,y+70],[cx-110,y+10]];
    else if(mark==='\u0323')points=Array.from({length:10},(_,i)=>[cx+Math.cos(i/10*Math.PI*2)*49,-170+Math.sin(i/10*Math.PI*2)*49]);
    else if(mark==='\u0309')points=[[cx-55,y+30],[cx+20,y+95],[cx+20,y+155],[cx-70,y+170],[cx-100,y+105],[cx-165,y+125],[cx-135,y+225],[cx+80,y+225],[cx+105,y+75],[cx+10,y+10]];
    else if(mark==='\u031b')points=[[base.ha-120,830],[base.ha+35,900],[base.ha+75,1080],[base.ha-5,1080],[base.ha-35,955],[base.ha-120,920]];
    if(points.length)outline+=' '+polygon(points.map(p=>p.map(Math.round)));
    if(!['\u0323','\u031b'].includes(mark))stack++;
  }
  fontData.glyphs[char]={...base,o:outline};
}
export function projectLabelText(project,language='en'){
  const text=localizeProject(project,language).short.toLocaleUpperCase(language==='vi'?'vi':'en');
  for(const char of text)addGlyph(char);return text;
}
export function createProjectLabels({THREE:T,scene,projects,buildings,language='en'}){
  const root=new T.Group();root.name='Project rooftop typography';root.userData.physicsIgnore=true;scene.add(root);
  const font=new Font(fontData),face=new T.MeshStandardMaterial({color:'#fff1cd',roughness:.38,metalness:.18,emissive:'#ffdfa1',emissiveIntensity:.06}),side=new T.MeshStandardMaterial({color:'#685541',roughness:.45,metalness:.42}),outline=new T.MeshStandardMaterial({color:'#22363b',roughness:.65});
  const labels=[],geometries=new Set();let disposed=false;
  function rebuild(){
    root.clear();labels.length=0;geometries.forEach(g=>g.dispose());geometries.clear();
    for(const project of projects){
      const text=projectLabelText(project,language),building=buildings.find(b=>b.userData.projectId===project.id),bounds=new T.Box3().setFromObject(building),group=new T.Group();
      group.name=`3D project title: ${text}`;group.userData.projectId=project.id;group.position.set(project.position[0],bounds.max.y+.85,project.position[1]);root.add(group);
      const words=text.split(' '),lines=text.length>18?[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')]:[text];
      for(const [index,line] of lines.entries()){
        const geometry=new T.ExtrudeGeometry(font.generateShapes(line,1),{depth:.13,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:5});geometry.computeBoundingBox();
        const size=geometry.boundingBox.getSize(new T.Vector3()),scale=Math.min(.87,Math.max(7.5,project.footprint[0]*.95)/Math.max(.1,size.x));geometry.translate(-geometry.boundingBox.min.x-size.x/2,-geometry.boundingBox.min.y,0);geometries.add(geometry);
        const border=new T.Mesh(geometry,outline);border.scale.set(scale*1.045,scale*1.07,1.2);border.position.set(0,(lines.length-1-index)*1.05,-.085);group.add(border);
        const letters=new T.Mesh(geometry,[face,side]);letters.scale.set(scale,scale,1);letters.position.y=(lines.length-1-index)*1.05;letters.castShadow=true;group.add(letters);
      }
      const ruleGeometry=new T.BoxGeometry(2.4,.045,.07);geometries.add(ruleGeometry);const rule=new T.Mesh(ruleGeometry,side);rule.position.set(0,-.22,0);group.add(rule);labels.push(group);
    }
  }
  rebuild();
  return {root,labels,setLanguage(value){value=value==='vi'?'vi':'en';if(language!==value){language=value;rebuild();}},update({yaw=0,night=0}={}){labels.forEach(label=>label.rotation.y=yaw);face.emissiveIntensity=.06+night*.28;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());face.dispose();side.dispose();outline.dispose();}};
}

import{a as he,b as ie,c as se}from"./ui-shared-PSTZAG6Z.js";import{b as H}from"./ui-shared-K3LWH4NE.js";var ue=H(he(),1);var fe=H(ie(),1),A=24,me=Math.PI*2,be=`#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,xe=`#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}
float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}
void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`,ve=["uCenter","uHalf","uRadius","uPx","uSpot","uEntry","uLineColor","uBaseColor","uIntensity","uWindow","uThickness","uGlow"],ae=(e,s,l)=>Math.min(l,Math.max(s,e)),_=e=>e-Math.floor(e),le=(e,s,l,i,v)=>{let x=l-v,d=i-v,t=Math.PI/2*v,o=x+d+t,c=Math.abs(e),f=Math.abs(s),w=c-x,m=f-d,a;return w>0&&m>0?a=d+Math.atan2(m,w)*v:w>m?a=Math.min(f,d):a=d+t+x-Math.min(c,x),e<0?a=s>=0?2*o-a:2*o+a:s<0&&(a=4*o-a),_(a/Math.max(4*o,1e-4))},we=(e,s,l,i)=>{let v=s-i,x=l-i,d=Math.PI/2*i,t=v+x+d,o=_(e)*4*t,c=1,f=1;o>3*t?(o=4*t-o,f=-1):o>2*t?(o-=2*t,c=-1,f=-1):o>t&&(o=2*t-o,c=-1);let w=v-(o-x-d),m=l;if(o<=x)w=s,m=o;else if(o<=x+d){let a=(o-x)/Math.max(i,1e-4);w=v+Math.cos(a)*i,m=x+Math.sin(a)*i}return[w*c,m*f]},ce=(e,s,l)=>{let i=e.createShader(s);return i?(e.shaderSource(i,l),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:(e.deleteShader(i),null)):null},ge=e=>{let s=ce(e,e.VERTEX_SHADER,be),l=ce(e,e.FRAGMENT_SHADER,xe),i=e.createProgram();return!s||!l||!i?(s&&e.deleteShader(s),l&&e.deleteShader(l),i&&e.deleteProgram(i),null):(e.attachShader(i,s),e.attachShader(i,l),e.bindAttribLocation(i,0,"aPosition"),e.linkProgram(i),e.deleteShader(s),e.deleteShader(l),e.getProgramParameter(i,e.LINK_STATUS)?i:(e.deleteProgram(i),null))};function de(e,s,{settingsRef:l,isActive:i=()=>!0,maxFps:v=30,maxDpr:x=1.25,maxPixels:d=6e4}={}){let t=s?.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"low-power"});if(!e||!s||!t)return{supported:!1,refresh(){},dispose(){}};let o=ge(t);if(!o)return t.getExtension("WEBGL_lose_context")?.loseContext(),{supported:!1,refresh(){},dispose(){}};let c={};for(let n of ve)c[n]=t.getUniformLocation(o,n);let f=t.createBuffer(),w=t.createVertexArray();t.bindVertexArray(w),t.bindBuffer(t.ARRAY_BUFFER,f),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.bindVertexArray(null);let m=document.createElement("canvas").getContext("2d",{willReadFrequently:!0}),a=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,z=new Map,p={width:1,height:1,ratio:1},g={x:0,y:0,known:!1},u={spot:0,level:0,press:0,ready:!1},L=0,S=0,q=!0,N=!1,D=!1,R=()=>!N&&q&&!document.hidden&&i()&&!e.hidden&&!e.disabled,X=n=>{if(z.has(n))return z.get(n);let r=[1,1,1];if(m){m.clearRect(0,0,1,1),m.fillStyle="#000000",m.fillStyle=n,m.fillRect(0,0,1,1);let[h,b,y]=m.getImageData(0,0,1,1).data;r=[h/255,b/255,y/255]}return z.set(n,r),r},Y=n=>Math.min(n.radius,p.width/2,p.height/2),B=n=>{let r=Y(n),h=r*(1-Math.SQRT1_2);return le(h-p.width/2,p.height/2-h,p.width/2,p.height/2,r)},O=n=>{if(D&&!g.known)return{spot:_(B(n)+.08),near:1};if(!n.followMouse||n.disabled||!g.known)return null;let r=e.getBoundingClientRect(),h=r.width/p.width||1,b=p.width/2,y=p.height/2,E=(g.x-r.left-r.width/2)/h,M=(r.top+r.height/2-g.y)/h,k=Math.hypot(Math.max(Math.abs(E)-b,0),Math.max(Math.abs(M)-y,0)),C=ae(1-k/n.proximity,0,1),re=C*C*(3-2*C),I=le(E,M,b,y,Y(n));if(k>0)return{spot:I,near:re};let W=ae(Math.min(b-Math.abs(E),y-Math.abs(M))/(y*.8),0,1),oe=B(n)-E/b*.06-M/y*.02,pe=oe-I-Math.round(oe-I);return{spot:_(I+pe*W*W*(3-2*W)),near:re}},U=n=>{if(!R())return;let{width:r,height:h}=p,b=s.width/(r+A*2),y=s.height/(h+A*2);t.viewport(0,0,s.width,s.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(o),t.uniform2f(c.uCenter,(A+r/2)*b,(A+h/2)*y),t.uniform2f(c.uHalf,r/2*b,h/2*y),t.uniform1f(c.uRadius,Math.min(n.radius,r/2,h/2)*b),t.uniform1f(c.uPx,p.ratio);let E=Math.min(n.radius,r/2,h/2),[M,k]=we(u.spot,r/2,h/2,E),C=1-Math.min(.35*(h/2),Math.hypot(M,k))/Math.max(Math.hypot(M,k),1e-4);t.uniform1f(c.uSpot,u.spot),t.uniform2f(c.uEntry,M*C*b,k*C*y),t.uniform3fv(c.uLineColor,X(n.lineColor)),t.uniform3fv(c.uBaseColor,X(n.baseColor)),t.uniform1f(c.uIntensity,n.intensity*(u.level+u.press*.8)),t.uniform2f(c.uWindow,n.shineSize/360+u.press*.06,n.shineFade/360+1e-4),t.uniform1f(c.uThickness,n.thickness),t.uniform1f(c.uGlow,n.glow),t.bindVertexArray(w),t.drawArrays(t.TRIANGLES,0,3),t.bindVertexArray(null)},G=n=>{if(L=0,!R())return;if(S&&n-S<1e3/v-.5){L=requestAnimationFrame(G);return}let r=l.current,h=S?Math.min(.05,(n-S)/1e3):1/60;S=n;let b=O(r),y=r.autoAnimate&&!a,E=!!b&&b.near>0;u.ready||(u.spot=B(r),u.level=r.autoAnimate?1:r.idleIntensity,u.ready=!0);let M=0;y&&!E?u.spot=_(u.spot+r.speed/me*h):(M=(E?b.spot:B(r))-u.spot,M-=Math.round(M),u.spot=_(u.spot+M*(1-Math.exp(-h*8))));let k=r.autoAnimate?1:r.idleIntensity+(1-r.idleIntensity)*(b?b.near:0);u.level+=(k-u.level)*(1-Math.exp(-h*7)),u.press*=Math.exp(-h*5),U(r),Math.abs(M)>2e-4||Math.abs(k-u.level)>.001||u.press>.002||y&&!E?L=requestAnimationFrame(G):S=0},P=()=>{!L&&R()&&(L=requestAnimationFrame(G))},V=n=>{let r=n?.borderBoxSize?.[0];p.width=Math.max(1,r?r.inlineSize:e.offsetWidth),p.height=Math.max(1,r?r.blockSize:e.offsetHeight),p.ratio=Math.min(window.devicePixelRatio||1,x,Math.sqrt(d/((p.width+A*2)*(p.height+A*2)))),s.width=Math.max(1,Math.floor((p.width+A*2)*p.ratio)),s.height=Math.max(1,Math.floor((p.height+A*2)*p.ratio)),u.ready&&U(l.current),P()},$=n=>{!R()||n.pointerType==="touch"||(g.x=n.clientX,g.y=n.clientY,g.known=!0,(O(l.current)?.near>0||u.level>l.current.idleIntensity+.001)&&P())},K=n=>{R()&&(g.x=n.clientX,g.y=n.clientY,g.known=!0,l.current.disabled||(u.press=1),P())},T=n=>{n.pointerType!=="mouse"&&(g.known=!1,P())},Q=()=>{g.known=!1,P()},F=()=>{cancelAnimationFrame(L),L=0,S=0},j=()=>{if(!R()){F(),g.known=!1,u.press=0;return}V()},J=()=>{document.hidden?F():j()},Z=()=>{D=!0,g.known=!1,P()},ee=()=>{D=!1,P()},te=new ResizeObserver(n=>V(n[n.length-1]));te.observe(e);let ne=new IntersectionObserver(n=>{q=n.some(r=>r.isIntersecting),q||F(),q&&(S=0,P())});return ne.observe(e),window.addEventListener("pointermove",$,{passive:!0}),window.addEventListener("pointerup",T,{passive:!0}),window.addEventListener("pointercancel",T,{passive:!0}),document.documentElement.addEventListener("pointerleave",Q),e.addEventListener("pointerdown",K),e.addEventListener("focus",Z),e.addEventListener("blur",ee),document.addEventListener("visibilitychange",J),V(),{supported:!0,refresh:j,dispose(){N||(N=!0,F(),te.disconnect(),ne.disconnect(),window.removeEventListener("pointermove",$),window.removeEventListener("pointerup",T),window.removeEventListener("pointercancel",T),document.documentElement.removeEventListener("pointerleave",Q),e.removeEventListener("pointerdown",K),e.removeEventListener("focus",Z),e.removeEventListener("blur",ee),document.removeEventListener("visibilitychange",J),t.deleteBuffer(f),t.deleteVertexArray(w),t.deleteProgram(o),t.getExtension("WEBGL_lose_context")?.loseContext())}}}function Le(e,{isActive:s=()=>!0}={}){if(!e)return{refresh(){},dispose(){}};let l=globalThis.navigator,i=se({hardwareConcurrency:l?.hardwareConcurrency,deviceMemory:l?.deviceMemory,saveData:l?.connection?.saveData}),v=window.matchMedia("(prefers-reduced-motion: reduce)"),x=()=>{let a=document.createElement("canvas");return a.className="specular-button__light",a.setAttribute("aria-hidden","true"),a},d=x(),t={current:{radius:12,lineColor:"#fff2d9",baseColor:"#c5c3bd",intensity:1,idleIntensity:.35,shineSize:10,shineFade:34,thickness:1.2,glow:1,speed:.35,followMouse:!0,proximity:180,autoAnimate:!1,disabled:!1}},o=null,c=!1,f=null;e.classList.add("specular-button","explore-specular-button");function w(){d.parentNode!==e&&e.prepend(d),f?.parentNode!==e&&(f=document.createElement("span"),f.className="specular-button__label",e.append(f));for(let a of[...e.childNodes])a!==d&&a!==f&&f.append(a)}function m(){if(c)return;w();let a=i.lowPower||v.matches;a&&o&&(o.dispose(),o=null,d.remove(),d=x(),w()),!a&&!o&&(o=de(e,d,{settingsRef:t,isActive:s,maxFps:30,maxDpr:1.25,maxPixels:6e4})),e.dataset.specular=a||!o?.supported?"static":"gpu",d.hidden=e.dataset.specular==="static"||!s(),o?.refresh()}return v.addEventListener?.("change",m),m(),{refresh:m,dispose(){if(!c){if(c=!0,v.removeEventListener?.("change",m),o?.dispose(),d.remove(),f?.parentNode===e){for(let a of[...f.childNodes])e.insertBefore(a,f);f.remove()}e.classList.remove("specular-button","explore-specular-button"),delete e.dataset.specular}}}}export{Le as mountExploreSpecularButton};

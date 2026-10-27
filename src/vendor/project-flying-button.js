import{b as Ce,c as wt,d as kt,e as Mt,f as He}from"./ui-shared-DB6FN6RA.js";var xt=Ce(Mt(),1),yt=Ce(kt(),1);var ne=Ce(wt(),1);var oe=Ce(He(),1),Ge=Object.freeze({pressureIterations:12,shadowSteps:5,shadowStep:6,shadowGrowth:1.85}),G=1100,vt=380,Tt=10,se=G/(2*vt),Ct=5,O=4,ft=.55,et=G*.75,tt=.42,Oe={small:{h:36,px:16,fs:13,k:.82},medium:{h:44,px:22,fs:14,k:1},large:{h:52,px:26,fs:16,k:1.18},"extra-large":{h:60,px:30,fs:18,k:1.36}},C=(t,m,_)=>Math.min(_,Math.max(m,t)),te=(t,m)=>Number.isFinite(Number(t))&&t!==null&&t!==""?Number(t):m,Ee=t=>{let m=C(t,0,1);return m*m*(3-2*m)},dt=t=>{let m=C(t,0,1);return m*m*m*(10+m*(6*m-15))},ht=t=>{let m=C(t,0,1);return 30*m*m*(1-m)*(1-m)},Et=t=>{let m=C(t,0,1);return 60*m*(1-m)*(1-2*m)},Je=(t,m)=>Math.sin(t*1.31+m)*.5+Math.sin(t*2.73+m*1.7)*.3+Math.sin(t*5.19+m*2.3)*.2,Lt=(t,m)=>Math.cos(t*1.31+m)*.655+Math.cos(t*2.73+m*1.7)*.819+Math.cos(t*5.19+m*2.3)*1.038,pt=t=>{let m=String(t||"").replace("#",""),_=m.length===3?m.replace(/(.)/g,"$1$1"):m.padEnd(6,"0").slice(0,6),H=parseInt(_,16);return Number.isFinite(H)?[(H>>16&255)/255,(H>>8&255)/255,(H&255)/255]:[1,1,1]},St=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,fe=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`,ot=`
uniform vec4 uJetA[${O}];
uniform vec4 uJetB[${O}];
uniform float uJetBend[${O}];
float jetWeight(vec2 p, vec4 a, vec4 b, out float along) {
  vec2 rel = p - a.xy;
  along = dot(rel, a.zw);
  vec2 off = rel - a.zw * clamp(along, 0.0, b.z);
  return exp(-dot(off, off) / (b.y * b.y)) * smoothstep(-b.y, 0.0, along);
}
`,at=`
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`,Dt=`${fe}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uWorld;
uniform float uDt;
uniform float uKeep;
void main() {
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  vec4 c = textureLod(uSource, vUv - uDt * v / uWorld, 0.0) * uKeep;
  outColor = all(lessThan(abs(c), vec4(1e4))) ? c : vec4(0.0);
}`,Rt=`${fe}
uniform sampler2D uVelocity;
uniform sampler2D uDye;
uniform vec2 uWorld;
uniform float uDt;
uniform float uBuoyancy;
uniform float uLift;
uniform float uDamping;
uniform float uSpread;
uniform float uSplash;
uniform float uFriction;
uniform float uWind;
uniform vec3 uKick;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
uniform vec2 uTurb;
uniform float uTime;
uniform float uObstacle;
${ot}
${at}
vec2 curlNoise(vec2 p) {
  float e = 0.35;
  float a = noise(p + vec2(0.0, e));
  float b = noise(p - vec2(0.0, e));
  float c = noise(p + vec2(e, 0.0));
  float d = noise(p - vec2(e, 0.0));
  return vec2(a - b, d - c) / (2.0 * e);
}
void main() {
  vec2 p = vUv * uWorld;
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  vec2 d = textureLod(uDye, vUv, 1.0).xy;
  float smokeHere = smoothstep(0.02, 0.4, d.x + d.y);
  vec2 tq = p / uTurb.y;
  vec2 turb = curlNoise(tq + vec2(uTime * 0.21, -uTime * 0.37)) + 0.5 * curlNoise(tq * 2.3 + vec2(-uTime * 0.53, uTime * 0.29) + 7.0);
  v += turb * uTurb.x * smokeHere * uDt;
  v.y += (uBuoyancy * d.y + uLift * d.x) * uDt;
  v /= 1.0 + uDamping * uDt;
  v.x /= 1.0 + uFriction * exp(-p.y / 18.0) * uDt;
  v.x += (uWind - v.x) * (1.0 - exp(-0.35 * uDt)) * smoothstep(0.0, 60.0, p.y);
  for (int i = 0; i < ${O}; i++) {
    vec4 b = uJetB[i];
    if (b.w <= 0.0) continue;
    vec4 a = uJetA[i];
    vec2 rel = p - a.xy;
    float along = dot(rel, a.zw);
    float across = dot(rel, vec2(-a.w, a.z));
    float reach = a.w < -0.2 ? a.y / -a.w : max(b.z, 1.0);
    float bn = clamp(along / max(reach, 1.0), 0.0, 1.0);
    across -= uJetBend[i] * bn * bn;
    vec2 dir = normalize(a.zw + vec2(-a.w, a.z) * (2.0 * uJetBend[i] * bn / max(reach, 1.0)));
    float sN = clamp(along / max(b.z, 1.0), 0.0, 1.0);
    float R = b.y + uSpread * clamp(along, 0.0, b.z);
    float wr = exp(-across * across / (R * R));
    float wa = smoothstep(-b.y, 0.0, along) * (1.0 - smoothstep(0.55, 1.0, sN));
    float rate = mix(46.0, 7.0, sN);
    float w = (1.0 - exp(-uDt * rate)) * wr * wa * clamp(b.w * 3.0, 0.0, 1.0);
    float U = b.x * sqrt(b.y / R);
    v = mix(v, dir * U, w);
  }
  for (int i = 0; i < ${O}; i++) {
    vec4 b = uJetB[i];
    if (b.w <= 0.0) continue;
    vec4 a = uJetA[i];
    if (a.w > -0.2) continue;
    float reach = a.y / -a.w;
    float gx = a.x + a.z * reach - a.w * uJetBend[i];
    float near = exp(-reach / uKick.x);
    float sx = uKick.y + reach * 0.25;
    float kx = (p.x - gx) / (sx * 1.6);
    float ky = p.y / (uKick.z * 1.5);
    float k = exp(-kx * kx - ky * ky);
    float side = clamp((p.x - gx) / sx, -1.0, 1.0);
    v += uDt * uSplash * b.w * near * k * vec2(side * 0.7, 0.9);
  }
  vec2 q = p - uCraft.xy;
  float c = cos(uCraftMotion.z);
  float s = sin(uCraftMotion.z);
  vec2 lq = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
  vec2 e = abs(lq) - uCraft.zw + uCraft.w;
  float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - uCraft.w;
  float inside = smoothstep(2.0, -2.0, sd) * uObstacle;
  vec2 cv = uCraftMotion.xy + uCraftMotion.w * vec2(-q.y, q.x);
  v = mix(v, cv, inside);
  float speed = length(v);
  if (!(speed < 1e5)) v = vec2(0.0);
  else if (speed > 2600.0) v *= 2600.0 / speed;
  outColor = vec4(v, 0.0, 1.0);
}`,_t=`${fe}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = textureLod(uVelocity, vUv - vec2(uTexel.x, 0.0), 0.0).y;
  float R = textureLod(uVelocity, vUv + vec2(uTexel.x, 0.0), 0.0).y;
  float B = textureLod(uVelocity, vUv - vec2(0.0, uTexel.y), 0.0).x;
  float T = textureLod(uVelocity, vUv + vec2(0.0, uTexel.y), 0.0).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,Ut=`${fe}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uDt;
void main() {
  float L = textureLod(uCurl, vUv - vec2(uTexel.x, 0.0), 0.0).x;
  float R = textureLod(uCurl, vUv + vec2(uTexel.x, 0.0), 0.0).x;
  float B = textureLod(uCurl, vUv - vec2(0.0, uTexel.y), 0.0).x;
  float T = textureLod(uCurl, vUv + vec2(0.0, uTexel.y), 0.0).x;
  float C = textureLod(uCurl, vUv, 0.0).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uStrength * C;
  f.y *= -1.0;
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy + f * uDt;
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  outColor = vec4(v, 0.0, 1.0);
}`,jt=`${fe}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  vec2 C = textureLod(uVelocity, vUv, 0.0).xy;
  float L = textureLod(uVelocity, vUv - vec2(uTexel.x, 0.0), 0.0).x;
  float R = textureLod(uVelocity, vUv + vec2(uTexel.x, 0.0), 0.0).x;
  float B = textureLod(uVelocity, vUv - vec2(0.0, uTexel.y), 0.0).y;
  float T = textureLod(uVelocity, vUv + vec2(0.0, uTexel.y), 0.0).y;
  if (vUv.y - uTexel.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,mt=`
float pressureAt(sampler2D tex, vec2 uv, vec2 texel, float c, int side) {
  if (side == 0 && uv.x - texel.x < 0.0) return 0.0;
  if (side == 1 && uv.x + texel.x > 1.0) return 0.0;
  if (side == 2 && uv.y - texel.y < 0.0) return c;
  if (side == 3 && uv.y + texel.y > 1.0) return 0.0;
  vec2 o = side == 0 ? vec2(-texel.x, 0.0) : side == 1 ? vec2(texel.x, 0.0) : side == 2 ? vec2(0.0, -texel.y) : vec2(0.0, texel.y);
  return textureLod(tex, uv + o, 0.0).x;
}
`,At=`${fe}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
${mt}
void main() {
  float C = textureLod(uPressure, vUv, 0.0).x;
  float L = pressureAt(uPressure, vUv, uTexel, C, 0);
  float R = pressureAt(uPressure, vUv, uTexel, C, 1);
  float B = pressureAt(uPressure, vUv, uTexel, C, 2);
  float T = pressureAt(uPressure, vUv, uTexel, C, 3);
  float div = textureLod(uDivergence, vUv, 0.0).x;
  float pr = (L + R + B + T - div) * 0.25;
  outColor = vec4(abs(pr) < 1e6 ? pr : 0.0, 0.0, 0.0, 1.0);
}`,Ft=`${fe}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
${mt}
void main() {
  float C = textureLod(uPressure, vUv, 0.0).x;
  float L = pressureAt(uPressure, vUv, uTexel, C, 0);
  float R = pressureAt(uPressure, vUv, uTexel, C, 1);
  float B = pressureAt(uPressure, vUv, uTexel, C, 2);
  float T = pressureAt(uPressure, vUv, uTexel, C, 3);
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy - 0.5 * vec2(R - L, T - B);
  if (vUv.y - uTexel.y < 0.0) v.y = max(v.y, 0.0);
  if (!(abs(v.x) < 4000.0 && abs(v.y) < 4000.0)) v = vec2(0.0);
  outColor = vec4(v, 0.0, 1.0);
}`,Nt=`${fe}
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
  vec2 c = textureLod(uSource, vUv, 0.0).xy * 0.2270270;
  c += textureLod(uSource, vUv + uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv - uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv + uStep * 3.2307692, 0.0).xy * 0.0702703;
  c += textureLod(uSource, vUv - uStep * 3.2307692, 0.0).xy * 0.0702703;
  outColor = vec4(c, 0.0, 1.0);
}`,Pt=`${fe}
uniform sampler2D uSource;
uniform float uScale;
void main() {
  outColor = textureLod(uSource, vUv, 0.0) * uScale;
}`,$t=`${fe}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uWorld;
uniform float uDt;
uniform vec2 uKeep;
uniform vec4 uRate;
uniform vec4 uCol;
uniform vec3 uKick;
uniform float uDisperse;
uniform float uDispV;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
uniform vec2 uGap;
uniform float uJetX[${O}];
uniform float uJetN;
uniform float uFloor;
uniform float uTime;
${ot}
${at}
void main() {
  vec2 v = textureLod(uVelocity, vUv, 0.0).xy;
  vec2 val = textureLod(uSource, vUv - uDt * v / uWorld, 0.0).xy * uKeep;
  val.x *= exp(-uDisperse * max(length(v) - uDispV, 0.0) * 0.01 * uDt);
  {
    vec2 q = vUv * uWorld - uCraft.xy;
    float c = cos(uCraftMotion.z);
    float sn = sin(uCraftMotion.z);
    vec2 lq = vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y);
    float belly = uCraft.y - uCraft.w - 7.0;
    float depth = 0.68 * belly * smoothstep(40.0, 110.0, belly);
    float below = -lq.y - uCraft.w;
    float wy = smoothstep(-4.0, 6.0, below) * (1.0 - smoothstep(depth * 0.7, depth, below));
    float nearest = 1e4;
    float outer = 0.0;
    for (int k = 0; k < ${O}; k++) {
      if (float(k) >= uJetN) break;
      nearest = min(nearest, abs(lq.x - uJetX[k]));
      outer = max(outer, abs(uJetX[k]));
    }
    float wx = uGap.x > 1.0 ? smoothstep(uGap.x * 0.22, uGap.x * 0.4, nearest) * (1.0 - smoothstep(outer - uGap.x * 0.1, outer, abs(lq.x))) : 0.0;
    val.x *= exp(-uGap.y * wx * wy * uDt);
  }
  val.x = max(val.x - uFloor * uDt, 0.0);
  vec2 p = vUv * uWorld;
  for (int i = 0; i < ${O}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    vec2 rel = p - ja.xy;
    float along = dot(rel, ja.zw);
    float across = dot(rel, vec2(-ja.w, ja.z));
    vec2 off = rel - ja.zw * clamp(along, 0.0, 6.0);
    float wn = exp(-dot(off, off) / (jb.y * jb.y)) * smoothstep(-jb.y, 0.0, along);
    float pulse = 0.6 + 0.8 * noise(vec2(uTime * 6.0 + float(i) * 13.1, along * 0.06 + float(i)));
    val.x += uRate.x * jb.w * wn * pulse * uDt;
    val.y += uRate.y * jb.w * wn * uDt;
    float reach = ja.w < -0.2 ? ja.y / -ja.w : 1e4;
    float sN = clamp(along / max(reach, 1.0), 0.0, 1.0);
    across -= uJetBend[i] * sN * sN;
    float R = uCol.y + uCol.x * clamp(along, 0.0, reach);
    float wc = exp(-across * across / (R * R)) * smoothstep(0.45, 0.8, sN) * (1.0 - step(reach + 2.0, along));
    float grain = 0.45 + 1.1 * noise(vec2(across * 0.12 + float(i) * 3.0, along * 0.05 - uTime * 9.0));
    val.x += uRate.w * jb.w * wc * grain * uDt;
    val.y += uRate.y * 0.25 * jb.w * wc * uDt;
    if (reach < 1e3) {
      float gx = ja.x + ja.z * reach - ja.w * uJetBend[i];
      float near = exp(-reach / uKick.x);
      float spread = uKick.y + reach * 0.25;
      float kx = (p.x - gx) / spread;
      float ky = p.y / uKick.z;
      float k = exp(-kx * kx - ky * ky);
      float g2 = 0.5 + noise(vec2(p.x * 0.08, uTime * 4.0 + float(i) * 9.0));
      val.x += uRate.z * jb.w * near * k * g2 * uDt;
      val.y += uRate.y * 0.4 * jb.w * near * k * uDt;
    }
  }
  if (!(val.x < 1e3 && val.y < 1e3 && val.x >= 0.0 && val.y >= 0.0)) val = vec2(0.0);
  outColor = vec4(val, 0.0, 1.0);
}`,Bt=`${fe}
uniform sampler2D uDye;
uniform vec2 uWorld;
uniform vec2 uDyeSize;
uniform float uTime;
uniform float uLightTheme;
uniform vec3 uSmoke;
uniform vec3 uShade;
uniform vec3 uThrust;
uniform vec4 uLook;
uniform vec4 uLook2;
uniform vec4 uLook3;
uniform vec4 uCol;
uniform float uGamma;
uniform float uTone;
uniform vec3 uLight2;
uniform float uThreshold;
uniform float uScale;
uniform vec4 uCraft;
uniform vec4 uCraftMotion;
${ot}
${at}
float dens(vec2 p, float lod) {
  return textureLod(uDye, p / uWorld, lod).x;
}
float hash1(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}
float fbm2(vec2 p) {
  return noise(p) * 0.65 + noise(p * 2.13 + 17.0) * 0.35;
}
float flowNoise(float q, float xn, float t, float id, float rate) {
  float c = t / 0.7;
  float f1 = fract(c);
  float f2 = fract(c + 0.5);
  float k1 = floor(c);
  float k2 = floor(c + 0.5);
  float n1 = fbm2(vec2(q - f1 * 0.7 * rate + hash1(k1 + id * 7.0) * 41.0, xn * 1.15 + id * 3.7));
  float n2 = fbm2(vec2(q - f2 * 0.7 * rate + hash1(k2 + id * 7.0 + 0.5) * 41.0, xn * 1.15 + id * 3.7 + 11.0));
  float w1 = 1.0 - abs(2.0 * f1 - 1.0);
  float w2 = 1.0 - w1;
  return 0.5 + (n1 * w1 + n2 * w2 - 0.5) / sqrt(w1 * w1 + w2 * w2);
}
float column(vec2 p, vec4 a, float str, float id, float t, float bend, out float xn, out float s) {
  vec2 rel = p - a.xy;
  s = dot(rel, a.zw);
  float x = dot(rel, vec2(-a.w, a.z));
  float S = a.w < -0.2 ? a.y / -a.w : 1e4;
  float bn = clamp(s / max(S, 1.0), 0.0, 1.0);
  x -= bend * bn * bn;
  xn = 0.0;
  if (s < -4.0 || s > S + 6.0) return 0.0;
  float sc = clamp(s, 0.0, S);
  float R = uCol.y + uCol.x * sc;
  float flare = smoothstep(S - 32.0 * uScale, S + 2.0, sc);
  R *= 1.0 + 1.3 * flare * flare;
  xn = x / R;
  if (abs(xn) > 3.2) return 0.0;
  float q = log(1.0 + 0.22 * sc / (9.0 * uScale)) / 0.22;
  float lam = 9.0 * uScale + 0.22 * sc;
  float U = uCol.w * sqrt(str) * sqrt(uCol.y / R);
  float n = flowNoise(q, xn, t, id, U / lam);
  float amp = 0.12 + 0.5 * smoothstep(4.0, 70.0, sc);
  float u = abs(xn) * (1.0 - amp * (n - 0.5) * 1.8);
  float prof = exp(-u * u * 1.7);
  float dil = pow(uCol.y / R, 0.5);
  float onset = smoothstep(2.0 * uScale, 16.0 * uScale, s);
  float tail = 1.0 - smoothstep(S - 2.0, S + 6.0, s);
  return uCol.z * str * prof * dil * onset * tail * (0.7 + 0.6 * n);
}
float shape(vec2 p, float lod) {
  return log(1.0 + 3.0 * dens(p, lod));
}
void main() {
  vec2 p = vUv * uWorld;
  float texel = uWorld.x / uDyeSize.x;
  float D = textureLod(uDye, vUv, uLook.w).x;
  float heat = textureLod(uDye, vUv, 0.5).y;

  float e = uLook3.x;
  float lodN = max(log2(e / texel), 0.0) + uLook3.y;
  vec2 g = vec2(shape(p + vec2(e, 0.0), lodN) - shape(p - vec2(e, 0.0), lodN), shape(p + vec2(0.0, e), lodN) - shape(p - vec2(0.0, e), lodN)) / (2.0 * e);
  float e2 = e * 3.0;
  float lodB = lodN + 1.6;
  vec2 g2 = vec2(shape(p + vec2(e2, 0.0), lodB) - shape(p - vec2(e2, 0.0), lodB), shape(p + vec2(0.0, e2), lodB) - shape(p - vec2(0.0, e2), lodB)) / (2.0 * e2);
  vec3 nS = normalize(vec3(-(g * uLook3.z + g2 * uLook3.w) * uLook.y, 1.0));

  float colD = 0.0;
  vec2 colN = vec2(0.0);
  float colHot = 0.0;
  float colNear = 0.0;
  for (int i = 0; i < ${O}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    float xn;
    float sa;
    float cd = column(p, ja, min(jb.w, 1.6), float(i), uTime, uJetBend[i], xn, sa);
    colD += cd;
    colN += vec2(-ja.w, ja.z) * clamp(xn, -1.6, 1.6) * cd;
    colHot += cd * exp(-max(sa, 0.0) / 45.0);
    colNear += cd * exp(-max(sa, 0.0) / 16.0);
  }
  float Dt = D + colD;
  float alpha = 1.0 - exp(-uLook.x * pow(max(D - uThreshold, 0.0) + colD, uGamma));
  vec2 cn = colD > 1e-5 ? colN / colD : vec2(0.0);
  vec3 nC = normalize(vec3(cn * 0.85, sqrt(max(1.0 - dot(cn, cn) * 0.72, 0.08))));
  float wC = colD / max(Dt, 1e-5);
  vec3 n = normalize(mix(nS, nC, wC));
  vec3 L = normalize(vec3(-0.38, 0.6, 0.72));
  float diff = clamp((dot(n, L) + uLook2.z) / (1.0 + uLook2.z), 0.0, 1.0);

  vec2 ld = normalize(L.xy);
  float tau = 0.0;
  float dist = 2.0;
  float stepLen = ${Ge.shadowStep.toFixed(1)};
  for (int i = 0; i < ${Ge.shadowSteps}; i++) {
    float lod = max(log2(stepLen / texel), 0.0);
    tau += dens(p + ld * dist, lod) * stepLen;
    dist += stepLen;
    stepLen *= ${Ge.shadowGrowth};
  }
  float sun = mix(exp(-uLook.z * tau), 1.0, wC * 0.6);
  float ao = mix(exp(-uLook2.w * dens(p, 4.5)), 1.0, wC);

  vec3 amb = vec3(0.84, 0.88, 1.0) * uLook2.x;
  vec3 key = vec3(1.0, 0.985, 0.96) * uLook2.y;
  vec3 lit = amb * ao + key * sun * diff;

  vec3 jl = vec3(0.0);
  vec3 core = vec3(0.0);
  for (int i = 0; i < ${O}; i++) {
    vec4 jb = uJetB[i];
    if (jb.w <= 0.0) continue;
    vec4 ja = uJetA[i];
    vec2 rel = p - ja.xy;
    float along = dot(rel, ja.zw);
    float across = dot(rel, vec2(-ja.w, ja.z));
    float str = min(jb.w, 1.6);
    float flick = 0.9 + 0.2 * noise(vec2(uTime * 38.0, float(i) * 5.0));
    float len = (8.0 + 12.0 * str) * flick * uScale;
    float sN = along / len;
    float wid = 3.2 * uScale * (0.9 - 0.5 * clamp(sN, 0.0, 1.0)) + 0.3;
    float radial = exp(-across * across / (wid * wid));
    float axial = smoothstep(-0.12, 0.04, sN) * pow(clamp(1.0 - sN, 0.0, 1.0), 1.5);
    float c = radial * axial * str;
    core += mix(uThrust, vec3(1.0), smoothstep(0.25, 0.9, c)) * c * 1.3;
    float d = length(rel - ja.zw * clamp(along, 0.0, len));
    core += uThrust * str * (0.22 * exp(-d / (5.0 * uScale)) + 0.06 * exp(-d / (18.0 * uScale)));
    jl += uThrust * str * uLight2.x * (exp(-d / (30.0 * uScale)) + 0.45 * exp(-d / (100.0 * uScale)));
  }

  vec3 jlNear = jl * 0.35 + uThrust * colNear / max(Dt, 1e-4) * 0.9;
  jl += uThrust * colHot / max(Dt, 1e-4) * 0.9;
  if (uLightTheme > 0.5) {
    float shade = dot(lit + jl * 0.8, vec3(0.3333)) * uLight2.z;
    vec3 ink = mix(uShade, uSmoke, smoothstep(0.15, 1.2, shade));
    alpha = 1.0 - pow(1.0 - alpha, 1.25);
    ink = mix(ink, uThrust, clamp(dot(jlNear, vec3(0.3333)) * 0.5, 0.0, 0.3));
    float ca = clamp(max(core.r, max(core.g, core.b)) * 0.85, 0.0, 1.0);
    vec3 coreInk = mix(uThrust, vec3(1.0), 0.35 * smoothstep(0.7, 1.0, ca));
    vec3 lc = ink * alpha * (1.0 - ca) + coreInk * ca;
    float la = alpha + ca * (1.0 - alpha);
    outColor = vec4(lc, la);
    return;
  }
  vec3 smoke = uSmoke * (lit + jl) * uLight2.z;
  smoke = mix(smoke / (1.0 + 0.35 * max(smoke - 0.8, 0.0)), 1.0 - exp(-smoke * 1.35), uTone);
  vec3 emit = mix(uThrust, vec3(1.0), 0.5) * heat * heat * uLight2.y;
  vec3 col = (smoke + emit) * alpha + core;
  float a = clamp(max(alpha, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  col = min(col, vec3(a));
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0 * a;
  outColor = vec4(max(col, 0.0), a);
}`,Ke={colSpread:.1,colR:3.6,colD:1.25,colU:420,splash:400,friction:5,disperse:.6,dispV:60,gap:10,wind:8,turb:350,turbScale:34,jetLight:.3,threshold:.035,blur:3,emit:0,exposure:1.3,tone:1,gamma:.6,kickNear:45,kickW:18,kickH:14,vort:6,spread:.1,floor:.02,keepD:.3,keepIdle:.45,keepH:1.6,rateN:0,rateH:6,rateK:20,rateC:3,buoy:330,lift:22,damp:.55,radius:6,speed:380,reach:.9,forceMax:240,alphaK:4,relief:9,shadow:.026,alphaLod:0,ambient:.58,key:.82,wrap:.35,ao:.35,normalE:3,normalLod:-.8,fine:.35,broad:.9,iters:Ge.pressureIterations};function zt({root:t,canvas:m,button:_,cursor:H,ramp:W,props:b}){let L=m.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"high-performance"}),ce=typeof window<"u"&&window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null,e={W:0,H:0,anchorX:null,anchorFloor:0,drawElapsed:0,dpr:1,bw:0,bh:0,x:0,vx:0,y:-se,vy:0,th:0,w:0,fvx:0,fvy:0,thrust:[0,0,0,0],delay:[0,0,0,0],phase:"rest",pt:0,clock:0,seed:Math.random()*100,wind:1,alt:160,climbT:1.6,y0:0,vrPrev:0,hold:2.4,xRef:0,landX:0,boost:!1,contact:!0,placed:!1,track:null,back:null,flip:null,rampKey:"",rampGeo:null,strip:null,u:0,v:0,target:{x:0,y:0},pointer:{in:!1,x:0,y:0,type:"mouse"},off:{x:0,y:0},attached:!1,hover:!1,armed:!0,carry:!1,pressed:!1,press:null,drag:null,suppress:!1,lastC:null,lastTh:0,quiet:0,running:!1,last:0,raf:0,simTime:0,activity:0},U=null;if(L&&(L.getExtension("EXT_color_buffer_float")||L.getExtension("EXT_color_buffer_half_float")))try{U=It(L,C(te(b.current.quality,1),.25,1))}catch{U=null}let K=()=>!!(ce&&ce.matches),i=()=>(Oe[b.current.size]||Oe.medium).k,j=()=>Ct*i(),ve=()=>C(Math.round(te(b.current.jets,2)),1,O),ae=()=>{let o=ve();if(o===1)return[0];let a=e.bw*(o===2?.3:.34);return Array.from({length:o},(r,n)=>a*(2*n/(o-1)-1))},J=()=>{let o=ae();return o.length>1?[o[0],o[o.length-1]]:[-.3*e.bw,.3*e.bw]},I=()=>e.thrust[0]+e.thrust[1]+e.thrust[2]+e.thrust[3],$=()=>e.phase==="ignite"||e.phase==="climb"||e.phase==="hover"||e.phase==="descend"||e.phase==="drag",Z=()=>e.phase==="drive"||e.phase==="loop"||e.phase==="flip"||e.phase==="return",ee=()=>[e.bw/2+4,Math.max(e.bw/2+4,e.W-e.bw/2-4)],V=()=>!!b.current.ramp,ge=()=>{let o=j()+e.bh/2,a=`${e.W}|${e.H}|${e.bw}|${o}`;if(e.rampKey===a&&e.rampGeo)return e.rampGeo;let r=Math.max(e.H*.24,j()+e.bh+40),n=1/r,f=r*.4,u=r*Math.PI/2-f,p=(D,R)=>{let z=[[f,0,n],[u,n,n],[f,n,0],[D,0,0],[f,0,n],[u,n,n],[f,n,0],[R,0,0]],F={ss:[0],xs:[0],ys:[0],ps:[0],ks:[0]},X=0,Y=0,Q=0,xe=0;return z.forEach(([ye,De,je])=>{let Me=Math.max(1,Math.round(ye/1.5)),be=ye/Me;for(let Te=0;Te<Me;Te+=1){let Ae=De+(je-De)*((Te+.5)/Me),Fe=Q+Ae*be/2;X+=Math.cos(Fe)*be,Y+=Math.sin(Fe)*be,Q+=Ae*be,xe+=be,F.ss.push(xe),F.xs.push(X),F.ys.push(Y),F.ps.push(Q),F.ks.push(De+(je-De)*((Te+1)/Me))}}),F},k=p(0,0),x=Math.max(0,e.H*.66-Math.max(...k.ys)),E=p(x,Math.max(48,e.W*.16)),w=C(r*.12,8,16),S=e.W-Math.max(18,e.W*.05)-w-Math.max(...E.xs),A=E.xs.map(D=>D+S),B=E.ss.length-1,v=E.ys.findIndex(D=>D>3),l=v<0?A[B]:A[v],T={...E,xs:A,r,T:w,x0:S,foot:l,S:E.ss[B],clear:Math.min(l,A[B])-12,ok:Math.max(...E.ys)+w<e.H-8};return e.rampKey=a,e.rampGeo=T,T},y=()=>{let[o,a]=ee();if(!V())return C(e.anchorX??e.W/2,o,a);let r=ge();return C(Math.min(r.foot*.5,r.x0-90,r.clear-e.bw/2-40),o,a)},h=()=>({x:e.x,y:e.anchorFloor+j()+e.bh/2+e.y+se}),s=()=>{let o=h(),a=Math.cos(e.th),r=Math.sin(e.th),n=b.current.thrusters?-(e.bh/2+j())+1:-(e.bh/2)+2;return ae().map(f=>({x:o.x+f*a-n*r,y:o.y+f*r+n*a,dx:r,dy:-a}))},d=()=>{let o=h();return{x:o.x,y:e.H-o.y}},M=(o,a,r,n,f,u,p)=>{let k=f[0]-u[0],x=p[0]-u[0],E=n[0]-f[0]+u[0]-p[0],w=f[1]-u[1],S=p[1]-u[1],A=n[1]-f[1]+u[1]-p[1],B=k*S-x*w||1e-6,v=(E*S-x*A)/B,l=(k*A-E*w)/B,T=f[0]-n[0]+v*f[0],D=p[0]-n[0]+l*p[0],R=f[1]-n[1]+v*f[1],z=p[1]-n[1]+l*p[1],F=n[0]-T*o/a,X=n[1]-R*o/a;return Math.abs(v)<1e-7&&Math.abs(l)<1e-7?`matrix(${[T/a,R/a,D/r,z/r,F,X].map(Q=>Q.toFixed(6)).join(",")})`:`matrix3d(${[T/a,R/a,0,v/a,D/r,z/r,0,l/r,0,0,1,0,F,X,0,1-v*o/a].map(Q=>Q.toFixed(6)).join(",")})`},P=()=>{e.strip&&(e.strip.wrap.remove(),e.strip.ink.remove(),e.strip=null,_.style.visibility="")},q=()=>{P();let o=e.track;if(!o)return;let a=o.geo,r=j()+e.bh/2,n=[0];for(let v=1;v<a.ss.length;v+=1){let l=(a.ks[v]+a.ks[v-1])/2;n.push(n[v-1]+(a.ss[v]-a.ss[v-1])*Math.max(1-l*r,.2))}let f=C(Math.round(e.bw/8),8,32),u=document.createElement("div");u.setAttribute("aria-hidden","true"),u.style.cssText="position:absolute;inset:0;z-index:1;pointer-events:none";let p=document.createElement("div");p.setAttribute("aria-hidden","true"),p.style.cssText="position:absolute;inset:0;z-index:2;pointer-events:none;will-change:transform";let k=Array.from(_.children),x=k[1],E=k.slice(2).map(v=>{let l=v.cloneNode(!0);return l.style.left="0px",l.style.top="0px",l.style.transformOrigin="0 0",u.appendChild(l),{el:l,x:v.offsetLeft,y:v.offsetTop+v.offsetHeight/2,k:1}}),w=[];for(let v=0;v<f;v+=1){let l=_.cloneNode(!0);l.removeAttribute("data-hover"),l.removeAttribute("data-pressed"),l.setAttribute("tabindex","-1"),l.setAttribute("inert",""),Array.from(l.children).slice(1).forEach(R=>{R.style.visibility="hidden"});let T=e.bw*v/f-(v?.75:2),D=e.bw*(v+1)/f+(v<f-1?.75:2);l.style.visibility="visible",l.style.transformOrigin="0 0",l.style.clipPath=`polygon(${T}px -2px, ${D}px -2px, ${D}px ${e.bh+2}px, ${T}px ${e.bh+2}px)`,u.appendChild(l),w.push(l)}let S=[],A=x&&x.textContent||"",B=document.createElement("canvas").getContext("2d");if(x&&B&&A.trim()&&!x.children.length){let v=getComputedStyle(x),l=`${v.fontStyle} ${v.fontWeight} ${v.fontSize} ${v.fontFamily}`;B.font=l;let T=Array.from(A),D=F=>B.measureText(T.slice(0,F).join("")).width,R=D(T.length)||1,z=x.offsetTop+x.offsetHeight/2;T.forEach((F,X)=>{let Y=document.createElement("span");Y.textContent=F,Y.style.cssText=`position:absolute;left:0;top:0;white-space:pre;line-height:1;transform-origin:0 0;font:${l};color:${v.color}`,p.appendChild(Y),S.push({el:Y,x:x.offsetLeft+(D(X)+D(X+1))/2*(x.offsetWidth/R),y:z,k:.5})})}else if(x){let v=x.cloneNode(!0);v.style.position="absolute",v.style.left="0px",v.style.top="0px",v.style.transformOrigin="0 0",p.appendChild(v),S.push({el:v,x:x.offsetLeft+x.offsetWidth/2,y:x.offsetTop+x.offsetHeight/2,k:0})}t.appendChild(u),t.appendChild(p),_.style.visibility="hidden",e.strip={wrap:u,ink:p,parts:w,n:f,sn:n,pods:E,items:S}},de=()=>{let o=e.strip,a=e.track;if(!o||!a)return;let r=a.geo,n=r.ss[r.ss.length-1],f=o.sn[o.sn.length-1],u=(l,T,D)=>{let R=0,z=l.length-1;for(;z-R>1;){let F=R+z>>1;l[F]<=D?R=F:z=F}return T[R]+(T[z]-T[R])*((D-l[R])/(l[z]-l[R]))},p=l=>l<=0?l:l>=n?f+l-n:u(r.ss,o.sn,l),k=l=>l<=0?l:l>=f?n+l-f:u(o.sn,r.ss,l),x=p(e.u),E=j(),w=(l,T)=>{let[D,R,z]=_e(r,k(x+l-e.bw/2)),F=E+e.bh-T;return[D-Math.sin(z)*F,e.H-R-Math.cos(z)*F,z]},S=(l,T,D,R)=>{l.style.transform=`translate(${T.toFixed(2)}px, ${D.toFixed(2)}px) rotate(${(-R).toFixed(4)}rad) translate(-50%, -50%)`},A=e.bw/o.n,B=[],v=[];for(let l=0;l<=o.n;l+=1)B.push(w(l*A,0)),v.push(w(l*A,e.bh));o.parts.forEach((l,T)=>{l.style.transform=M(T*A,A,e.bh,B[T],B[T+1],v[T+1],v[T])}),o.pods.forEach(l=>{let[T,D,R]=w(l.x,l.y);S(l.el,T,D,R)}),o.items.forEach(l=>{let[T,D,R]=w(l.x,l.y),[z,F,X]=w(e.bw/2,l.y),Y=l.x-e.bw/2,Q=z+Math.cos(X)*Y,xe=F-Math.sin(X)*Y;S(l.el,Q+(T-Q)*l.k,xe+(D-xe)*l.k,X+(R-X)*l.k)})},Le=()=>{e.strip&&de();let o=h(),a=o.x-e.bw/2,r=e.H-o.y-e.bh/2;_.style.transform=`translate3d(${a.toFixed(2)}px, ${r.toFixed(2)}px, 0) rotate(${(-e.th).toFixed(5)}rad)`,t.style.setProperty("--fly-thrust",C(I()*.9,0,1.2).toFixed(3))},Pe=()=>{if(!W)return;let o=ge(),a=W.querySelectorAll("path"),r=a[0],n=a[1],f=p=>p.toFixed(1),u=p=>{let k=[];for(let E=0;E<o.ss.length;E+=2){let w=o.ps[E];k.push(`${f(o.xs[E]+Math.sin(w)*p)} ${f(e.H-o.ys[E]+Math.cos(w)*p)}`)}let x=o.ps[o.ss.length-1];return k.push(`${f(o.xs[o.ss.length-1]+Math.sin(x)*p)} ${f(e.H-o.ys[o.ss.length-1]+Math.cos(x)*p)}`),`M ${k.join(" L ")}`};W.setAttribute("viewBox",`0 0 ${f(e.W)} ${f(e.H)}`),W.style.visibility=o.ok?"":"hidden",r&&(r.setAttribute("d",u(o.T/2)),r.setAttribute("stroke-width",f(o.T))),n&&n.setAttribute("d",u(.75))},$e=o=>{let a=new Float32Array(O*4),r=new Float32Array(O*4),n=[0,0,0,0],f=o.length,u=Ke,p=i();return o.forEach((k,x)=>{let E=C(e.thrust[x]*f,0,2),w=k.dy<-.2?k.y/-k.dy:u.forceMax;a.set([k.x,k.y,k.dx,k.dy],x*4),r.set([u.speed*Math.sqrt(E),u.radius*p,Math.min(u.forceMax,w*u.reach),E>.004?E:0],x*4);let S=e.fvx*-k.dy+e.fvy*k.dx;n[x]=C(-S*.22,-.55*w,.55*w)}),{a,b:r,bend:n}},we=o=>{if(!U)return;let a=b.current,r=s(),n=$e(r),f=h(),u=ae(),p=i(),k=[f.x,f.y,e.bw/2,e.bh/2],x=[e.vx,e.vy,e.th,e.w],E=(1-Ee((Math.abs(e.fvx)-40)/100))*(1-Ee((Math.abs(e.th)-.1)/.2))*(Z()?0:1);o>0&&(e.simTime+=o,U.step(o,{jets:n,craft:k,motion:x,calm:E,scale:p,activity:e.activity,jetX:[0,1,2,3].map(S=>S<u.length?u[S]:0),jetN:u.length,spacing:u.length>1?u[1]-u[0]:0,wind:e.wind*Ke.wind,time:e.simTime,smoke:C(te(a.smoke,1),0,3),turbulence:C(te(a.turbulence,1),0,3)}));let w=pt(a.smokeColor);U.render(m.width,m.height,{jets:n,craft:k,motion:x,scale:p,activity:e.activity,time:e.simTime,light:a.theme==="light",smokeColor:w,shadeColor:w.map((S,A)=>S*.74+[0,.012,.045][A]),thrustColor:pt(a.thrustColor)})},ie=()=>{let o=t.getBoundingClientRect(),a=e.W;e.W=Math.max(1,o.width),e.H=Math.max(1,o.height),e.bw=_.offsetWidth,e.bh=_.offsetHeight;let r=b.current.anchorElement?.getBoundingClientRect();if(e.anchorX=r?.width?r.left-o.left+r.width/2:null,e.anchorFloor=r?.height?Math.max(0,o.bottom-r.bottom-j()):0,e.placed?a>0&&a!==e.W&&(e.x*=e.W/a):(e.x=y(),e.placed=!0),e.phase==="rest"&&e.anchorX!==null&&(e.x=y()),!Z()){let[u,p]=ee();e.x=C(e.x,u,p)}e.dpr=Math.min(window.devicePixelRatio||1,te(b.current.maxDpr,2),Math.sqrt(Math.max(1,te(b.current.maxCanvasPixels,1/0))/(e.W*e.H)));let n=Math.max(1,Math.floor(e.W*e.dpr)),f=Math.max(1,Math.floor(e.H*e.dpr));(m.width!==n||m.height!==f)&&(m.width=n,m.height=f),U&&U.resize(e.W,e.H),Pe(),t.dataset.ready="",Le(),e.running||we(0)},ke=(o,a,r=0)=>{let n=d(),f=e.th,u=o-n.x,p=a-n.y,k=u*Math.cos(f)-p*Math.sin(f),x=u*Math.sin(f)+p*Math.cos(f);return Math.abs(k)<=e.bw/2+2+r&&x>=-e.bh/2-2-r&&x<=e.bh/2+j()+r},me=()=>{e.pt=0,e.armed=!1,e.seed=Math.random()*100,e.wind=Math.random()<.5?-1-Math.random():1+Math.random(),e.vrPrev=0,e.quiet=0,e.boost=!1},he=()=>{if(e.phase!=="rest"||K())return!1;let o=b.current;me(),e.phase="ignite",e.delay=e.delay.map(()=>Math.random()*.07);let a=e.H-e.anchorFloor-e.bh-j()-30-se;return e.alt=C(e.y+te(o.altitude,170),e.y+24,Math.max(e.y+24,a)),e.climbT=1.15+(e.alt-e.y)/420,e.hold=Math.max(0,te(o.hoverTime,2.4)),e.xRef=e.x,Se(),!0},_e=(o,a)=>{if(a<=0)return[o.x0+a,0,0,0];let r=0,n=o.ss.length-1;if(a>=o.ss[n]){let u=o.ps[n];return[o.xs[n]+Math.cos(u)*(a-o.ss[n]),o.ys[n]+Math.sin(u)*(a-o.ss[n]),u,0]}for(;n-r>1;){let u=r+n>>1;o.ss[u]<=a?r=u:n=u}let f=(a-o.ss[r])/(o.ss[n]-o.ss[r]);return[o.xs,o.ys,o.ps,o.ks].map(u=>u[r]+(u[n]-u[r])*f)},Be=(o,a)=>{let[r,n,f,u]=_e(o.geo,a);return{x:r-Math.sin(f)*o.base,cy:n+Math.cos(f)*o.base,th:f,bend:u*o.base}},ze=()=>{if(e.phase!=="rest"||K()||!V())return!1;let o=ge(),a=o.x0-e.x;if(a<60||!o.ok)return he();me();let r=j()+e.bh/2,n=Math.max(...o.ys)-2*r,f=Math.sqrt(2*et*n+2.2*et*(o.r-r));return e.track={geo:o,base:r,v0:f,acc:f*f/(2*a)},e.phase="drive",e.u=-a,e.v=0,e.thrust=[0,0,0,0],q(),Se(),!0},Ie=o=>{let[a,r]=ee(),n=e.x+o;V()&&(n=Math.min(n,ge().clear-e.bw/2)),e.landX=C(n,a,r)},Ye=o=>{let a=b.current,r=C(te(a.wobble,1),0,3);if(e.pt+=o,e.clock+=o,e.phase==="return"){let c=e.back,g=Math.min(e.pt/c.time,1);e.x=c.from+(c.to-c.from)*dt(g),e.vx=(c.to-c.from)*ht(g)/c.time,e.y=-se,e.vy=0,e.th=0,e.w=0,g>=1&&(e.phase="rest",e.pt=0,e.vx=0);return}if(e.phase==="drive"||e.phase==="loop"){let c=e.track,g=Be(c,e.u);e.phase==="drive"?e.v=Math.min(c.v0,e.v+c.acc*o):e.v=Math.sqrt(Math.max(c.v0*c.v0-2*et*(g.cy-c.base),.2*c.v0*c.v0)),e.u+=e.v*o/Math.max(1-g.bend,.25),e.phase==="drive"&&e.u>=0&&(e.phase="loop");let N=Be(c,e.u);e.vx=(N.x-g.x)/o,e.vy=(N.cy-g.cy)/o,e.w=(N.th-g.th)/o,e.x=N.x,e.y=N.cy-j()-e.bh/2-se,e.th=N.th,e.thrust=e.thrust.map(ue=>ue*Math.exp(-o/.1)),e.phase==="loop"&&e.u>=c.geo.S&&(P(),e.phase="flip",e.pt=0,e.flip={th:e.th,w:e.w});return}let n=(e.bw*e.bw+e.bh*e.bh)/12,f=Math.max(Math.cos(e.th),.5),u=0,p=!1,k=e.xRef,x=3,E=3.6,w=null;if(e.phase==="flip"){let c=Math.min(e.pt/tt,1),g=e.flip,N=Math.PI*2;w={th:(2*c*c*c-3*c*c+1)*g.th+(c*c*c-2*c*c+c)*tt*g.w+(3*c*c-2*c*c*c)*N,w:(6*c*c-6*c)*(g.th-N)/tt+(3*c*c-4*c+1)*g.w},u=2.4*Ee((Math.cos(w.th)-.8)/.15);let ue=e.y+se<e.bh*.6;(c>=1||ue)&&(w=null,e.th-=Math.PI*2*Math.round(e.th/(Math.PI*2)),e.phase="descend",e.pt=0,e.boost=!0,e.vrPrev=e.vy,Ie(e.vx*Math.abs(e.vx)/700))}if(e.phase==="ignite"&&(u=.9*Ee(e.pt/.5),e.pt>=.5&&(e.phase="climb",e.pt=0,e.y0=e.y)),e.phase==="climb"){let c=e.pt/e.climbT,g=e.alt-e.y0,N=e.y0+g*dt(c),ue=g*ht(c)/e.climbT,Re=g*Et(c)/(e.climbT*e.climbT);u=(G+Re+30*(N-e.y)+8*(ue-e.vy))/(G*f),p=!0,c>=1&&(e.phase="hover",e.pt=0)}else if(e.phase==="hover"){let c=e.clock*.8,g=e.alt+3.5*r*Je(c,e.seed),N=3.5*r*.8*Lt(c,e.seed);u=(G+30*(g-e.y)+8*(N-e.vy))/(G*f),p=!0,e.pt>=e.hold&&(e.phase="descend",e.pt=0,e.vrPrev=0,Ie(0))}else if(e.phase==="drag"){let c=e.target.y-j()-e.bh/2-se;u=(G+34*(c-e.y)-10*e.vy)/(G*f),p=!0}else if(e.phase==="descend"){k=e.landX,x=e.boost?5:4,E=e.boost?4.6:4.2;let c=170,g=32,N=e.boost?Ee((Math.abs(e.landX-e.x)-20)/40):Ee((Math.abs(e.landX-e.x)-3)/23),ue=Math.max(e.y+se,0),Re=(g+(c-g)*(1-Math.exp(-ue/52)))*(1-(e.boost?.45:.88)*N),Ze=e.boost?c*3:c*Ee(e.pt/.9)+1,Ne=-Math.min(Re,Ze),Xe=C((Ne-e.vrPrev)/Math.max(o,1e-4),-600,600);e.vrPrev=Ne,u=(G+Xe+(e.boost?9:7)*(Ne-e.vy))/(G*f),p=!0,e.contact&&e.pt>.3&&(e.phase="landed",e.pt=0,e.boost=!1)}else if(e.phase==="landed"&&(u=0,e.pt>.6&&I()<.03)){let c=V()&&e.track?y():e.x;e.phase=Math.abs(c-e.x)>6?"return":"rest",e.pt=0,e.thrust=[0,0,0,0],e.vy=0,e.w=0,e.vx=0,e.track=null,e.back={from:e.x,to:c,time:C(Math.abs(c-e.x)/200,.7,1.8)}}u=Number.isFinite(u)?C(u,0,e.boost||e.phase==="flip"?2.6:1.9):1;let S=ae(),A=S.length,B=S.reduce((c,g)=>c+g*g,0),v=e.phase==="drag"?C(100*(e.target.x-e.x)-17*e.vx,-2400,2400):0,l=0;if(p){let c=.8*r*Je(e.clock*1.7,e.seed+3),g=e.phase==="drag"?v*.75:x*(k-e.x)-E*e.vx,N=e.boost?.45:.32,ue=C(-Math.atan2(g,G),-N,N);l=-81*(e.th-ue)-14*e.w-c}let T=(e.boost||e.phase==="flip"?2.6:2.4)/A,D=(c,g)=>c+(g-c)*(1-Math.exp(-o/(g>c?.08:.17))),R=B>1?l*n/(G*B):0,z=Math.abs(R)*Math.max(0,...S.map(Math.abs)),F=Math.min(u/A,Math.max(T-z,T*.5)),X=0;for(let c=0;c<O;c+=1){let g=0;c<A&&(g=C(F+R*S[c],0,T),e.phase==="ignite"&&e.pt<e.delay[c]&&(g=0)),e.thrust[c]=D(e.thrust[c],g),c<A&&(X+=e.thrust[c]*S[c])}let Y=I()*G,Q=e.phase==="drag"?v:-Y*Math.sin(e.th)-.8*e.vx,xe=Y*Math.cos(e.th)-G-.3*e.vy,ye=e.phase==="flip"?0:X*G/n-1.2*e.w;p&&(e.phase!=="drag"&&(Q+=12*r*Je(e.clock*.7,e.seed+7)),ye+=.9*r*Je(e.clock*2.3,e.seed+11),B<1&&(ye+=l),Math.abs(e.th)>.35&&(ye-=(e.th-Math.sign(e.th)*.35)*160));let De=h(),je=Math.cos(e.th),Me=Math.sin(e.th),be=-(e.bh/2+j()),Te=!1;e.phase!=="flip"&&J().forEach(c=>{let g=c*je-be*Me,N=c*Me+be*je,ue=De.y+N,Re=se-ue;if(Re>0){Te=!0;let Ze=e.vy+e.w*g,Ne=e.vx-e.w*N,Xe=Math.max(0,vt*Re-Tt*Ze),ut=-10*Ne;xe+=Xe,Q+=ut,ye+=(g*Xe-N*ut)/n}}),e.contact=Te,e.vx=C(e.vx+Q*o,-1500,1500),e.vy=C(e.vy+xe*o,-1500,1500),e.w=C(e.w+ye*o,-14,14),e.x+=e.vx*o,e.y+=e.vy*o,e.th+=e.w*o,w&&(e.th=w.th,e.w=w.w),e.phase!=="flip"&&Math.abs(e.th)>ft&&(e.th=Math.sign(e.th)*ft,e.w*e.th>0&&(e.w=0));let[Ae,Fe]=ee();(e.x<Ae||e.x>Fe)&&(e.x=C(e.x,Ae,Fe),e.vx=0),e.y+se<-40&&(e.y=-se,e.vy=0),Number.isFinite(e.y+e.x+e.th+e.vy+e.vx+e.w+I())||(Object.assign(e,{x:e.W/2,vx:0,y:-se,vy:0,th:0,w:0,thrust:[0,0,0,0],phase:"rest"}),e.drag=null)},le=o=>{let a=b.current,r=e.pointer,n=d();if(e.attached&&!e.drag&&e.lastC){let x=r.x+e.off.x,E=r.y+e.off.y,w=-(e.th-e.lastTh),S=x-e.lastC.x,A=E-e.lastC.y,B=n.x+S*Math.cos(w)-A*Math.sin(w),v=n.y+S*Math.sin(w)+A*Math.cos(w);e.off.x+=B-x,e.off.y+=v-E}e.lastC=n,e.lastTh=e.th;let f=r.x+e.off.x,u=r.y+e.off.y,p=r.in&&ke(f,u,e.attached||e.drag?10:0);if(p!==e.hover&&(e.hover=p,p?_.dataset.hover="":delete _.dataset.hover),!p&&!e.drag&&(e.attached=!1,e.phase==="rest"&&(e.armed=!0)),p&&e.armed&&e.phase==="rest"&&r.type==="mouse"&&a.trigger!=="click"&&!V()&&he()&&(e.attached=!!a.carryCursor),e.phase==="rest"&&Math.abs(e.off.x)+Math.abs(e.off.y)<12){let x=Math.exp(-o*6);e.off.x*=x,e.off.y*=x}Math.abs(e.off.x)+Math.abs(e.off.y)<.3&&(!e.attached||e.phase==="rest")&&(e.off.x=0,e.off.y=0,e.phase==="rest"&&(e.attached=!1));let k=!!a.carryCursor&&r.in&&r.type==="mouse"&&(e.attached||!!e.drag||e.off.x!==0||e.off.y!==0);k!==e.carry&&(e.carry=k,k?t.dataset.carry="":delete t.dataset.carry),k&&H&&(H.style.transform=`translate3d(${(f-1.8).toFixed(2)}px, ${(u-1.75).toFixed(2)}px, 0)`)},Ve=o=>{if(e.raf=0,document.hidden){e.last=0;return}let a=e.last?C((o-e.last)/1e3,0,1/30):1/60;if(e.last=o,a>0){if(e.phase!=="rest")for(let p=0;p<6;p+=1)Ye(a/6);let r=1-Math.exp(-a/.12);e.fvx+=(e.vx-e.fvx)*r,e.fvy+=(e.vy-e.fvy)*r,le(a),Le(),e.drawElapsed+=a,e.drawElapsed>=1/Math.max(1,te(b.current.maxFps,60))&&(we(Math.min(1/30,e.drawElapsed)),e.drawElapsed=0);let n=I();e.quiet=n>.01||e.phase!=="rest"?0:e.quiet+a;let f=n>.05?1:0;e.activity+=(f-e.activity)*(1-Math.exp(-a/(f?.25:1.6)))}e.phase!=="rest"||e.quiet<7||e.carry?e.raf=requestAnimationFrame(Ve):(e.running=!1,e.last=0,U&&U.clear(),we(0))},Se=()=>{e.raf||document.hidden||(e.running=!0,e.raf=requestAnimationFrame(Ve))},re=o=>{let a=t.getBoundingClientRect();return{x:o.clientX-a.left,y:o.clientY-a.top}},Ue=()=>{let o=e.pointer,a=o.type==="mouse";return{x:o.x+(a?e.off.x:0),y:o.y+(a?e.off.y:0)}},st=()=>{if(!e.drag)return;let o=Ue(),[a,r]=ee(),n=j()+e.bh/2;e.target.x=C(o.x-e.drag.gx,a,r),e.target.y=C(e.H-(o.y-e.drag.gy),n,Math.max(n,e.H-e.bh/2-6))},bt=o=>{let a=Ue(),r=d();e.drag={gx:a.x-r.x,gy:a.y-r.y},e.phase="drag",e.pt=0,e.attached=!1,e.pressed=!1,e.suppress=!0,e.boost=!1,delete _.dataset.pressed,t.dataset.dragging="";try{t.setPointerCapture(o.pointerId)}catch{}st()},gt=o=>{e.drag=null,e.press=null,delete t.dataset.dragging;try{t.releasePointerCapture(o.pointerId)}catch{}e.phase="hover",e.pt=0,e.alt=e.y;let[a,r]=ee();e.xRef=C(e.x+e.vx*.3,a,r),e.hold=Math.min(Math.max(0,te(b.current.hoverTime,2.4)),.9)},We=o=>{let a=re(o),r=e.pointer;if(r.in&&!e.attached&&!e.drag&&(e.off.x||e.off.y)){let n=Math.exp(-Math.hypot(a.x-r.x,a.y-r.y)/110);e.off.x*=n,e.off.y*=n}r.x=a.x,r.y=a.y,r.in=!0,r.type=o.pointerType||"mouse",e.press&&!e.drag&&$()&&Math.hypot(a.x-e.press.x,a.y-e.press.y)>4&&bt(o),e.drag&&st(),le(0),(e.carry||e.phase!=="rest")&&Se()},nt=()=>{e.drag||(e.pointer.in=!1,e.attached=!1,e.off.x=0,e.off.y=0,le(0))},ct=o=>{let a=re(o),r=e.pointer;r.x=a.x,r.y=a.y,r.in=!0,r.type=o.pointerType||"mouse",e.suppress=!1;let n=Ue();ke(n.x,n.y,e.attached?10:0)&&(r.type!=="mouse"&&e.phase==="rest"&&b.current.trigger!=="click"&&!V()&&he(),e.press={x:a.x,y:a.y},e.carry&&r.type==="mouse"&&(e.pressed=!0,_.dataset.pressed=""))},qe=o=>{if(e.drag){gt(o);return}e.press=null,e.pressed&&(e.pressed=!1,delete _.dataset.pressed,e.carry&&e.hover&&(e.phase==="rest"&&V()?ze():b.current.trigger==="click"&&he()&&(e.attached=!!b.current.carryCursor),b.current.onClick&&b.current.onClick(o)))},it=o=>{if(e.suppress){e.suppress=!1,o.stopPropagation(),o.preventDefault();return}if(e.phase==="rest"){if(V()){ze();return}he()&&e.pointer.type==="mouse"&&e.pointer.in&&e.hover&&(e.attached=!!b.current.carryCursor)}},lt=()=>{document.hidden?(e.raf&&cancelAnimationFrame(e.raf),e.raf=0,e.last=0):e.phase!=="rest"&&Se()};document.addEventListener("visibilitychange",lt),t.addEventListener("pointermove",We),t.addEventListener("pointerenter",We),t.addEventListener("pointerleave",nt),t.addEventListener("pointerdown",ct),t.addEventListener("pointerup",qe),t.addEventListener("pointercancel",qe),_.addEventListener("click",it);let Qe=new ResizeObserver(ie);return Qe.observe(t),Qe.observe(_),ie(),{refresh:ie,rehome(){ie(),e.phase==="rest"&&(e.x=y(),Le(),e.running||we(0))},destroy(){Qe.disconnect(),document.removeEventListener("visibilitychange",lt),P(),e.raf&&cancelAnimationFrame(e.raf),t.removeEventListener("pointermove",We),t.removeEventListener("pointerenter",We),t.removeEventListener("pointerleave",nt),t.removeEventListener("pointerdown",ct),t.removeEventListener("pointerup",qe),t.removeEventListener("pointercancel",qe),_.removeEventListener("click",it),U&&U.dispose(),L?.getExtension("WEBGL_lose_context")?.loseContext()}}}function It(t,m=1){let _=(y,h)=>{let s=t.createShader(y);if(t.shaderSource(s,h),t.compileShader(s),!t.getShaderParameter(s,t.COMPILE_STATUS)){let d=t.getShaderInfoLog(s);throw t.deleteShader(s),new Error(d)}return s},H=_(t.VERTEX_SHADER,St),W=[],b=y=>{let h=_(t.FRAGMENT_SHADER,y),s=t.createProgram();if(t.attachShader(s,H),t.attachShader(s,h),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s));t.deleteShader(h);let d={},M=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let q=0;q<M;q+=1){let de=t.getActiveUniform(s,q);d[de.name.replace(/\[0\]$/,"")]=t.getUniformLocation(s,de.name)}let P={p:s,u:d};return W.push(P),P},L={advect:b(Dt),force:b(Rt),curl:b(_t),vorticity:b(Ut),divergence:b(jt),pressure:b(At),gradient:b(Ft),scale:b(Pt),blur:b(Nt),dye:b($t),render:b(Bt)},ce=t.createVertexArray(),e=[],U=(y,h,s,d)=>{let M=t.createTexture();t.bindTexture(t.TEXTURE_2D,M);let P=d?Math.floor(Math.log2(Math.max(y,h)))+1:1;t.texStorage2D(t.TEXTURE_2D,P,s,y,h),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,d?t.LINEAR_MIPMAP_LINEAR:t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let q=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,q),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,M,0),t.viewport(0,0,y,h),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT);let de={tex:M,fbo:q,w:y,h,mips:d};return e.push(de),de},K=(y,h,s,d)=>{let M={read:U(y,h,s,d),write:U(y,h,s,d)};return M.swap=()=>{let P=M.read;M.read=M.write,M.write=P},M},i=null,j=[1,1],ve=()=>{e.forEach(y=>{t.deleteTexture(y.tex),t.deleteFramebuffer(y.fbo)}),e.length=0},ae=(y,h)=>{let s=Math.max(2,y/(520*m),h/(300*m)),d=Math.max(16,Math.round(y/s)),M=Math.max(16,Math.round(h/s)),P=Math.max(16,Math.round(y/(s/2))),q=Math.max(16,Math.round(h/(s/2)));j=[y,h],!(i&&i.vw===d&&i.vh===M&&i.dw===P&&i.dh===q)&&(ve(),i={vw:d,vh:M,dw:P,dh:q,velocity:K(d,M,t.RG16F,!1),pressure:K(d,M,t.R16F,!1),divergence:U(d,M,t.R16F,!1),curl:U(d,M,t.R16F,!1),dye:K(P,q,t.RG16F,!1),soft:U(P,q,t.RG16F,!0),temp:U(P,q,t.RG16F,!1)})},J=0,I=(y,h)=>{t.useProgram(y.p),J=0,Object.entries(h).forEach(([s,d])=>{let M=y.u[s];M!=null&&(typeof d=="number"?t.uniform1f(M,d):d.f1?t.uniform1fv(M,d.f1):d.tex?(t.activeTexture(t.TEXTURE0+J),t.bindTexture(t.TEXTURE_2D,d.tex),t.uniform1i(M,J),J+=1):d.length===2?t.uniform2fv(M,d):d.length===3?t.uniform3fv(M,d):t.uniform4fv(M,d))})},$=(y,h,s)=>{I(y,h),s&&(t.bindFramebuffer(t.FRAMEBUFFER,s.fbo),t.viewport(0,0,s.w,s.h)),t.bindVertexArray(ce),t.drawArrays(t.TRIANGLES,0,3)};return{step:(y,h)=>{if(!i)return;let s=Ke;t.disable(t.BLEND);let d=[1/i.vw,1/i.vh];$(L.advect,{uVelocity:i.velocity.read,uSource:i.velocity.read,uWorld:j,uDt:y,uKeep:1},i.velocity.write),i.velocity.swap(),$(L.force,{uVelocity:i.velocity.read,uDye:i.soft,uWorld:j,uDt:y,uBuoyancy:s.buoy,uLift:s.lift,uDamping:s.damp,uSpread:s.spread,uSplash:s.splash,uFriction:s.friction,uWind:h.wind,uTurb:[s.turb*(.35+.65*h.activity),s.turbScale],uTime:h.time,uObstacle:h.calm,uKick:[s.kickNear*h.scale,s.kickW*h.scale,s.kickH*h.scale],uCraft:h.craft,uCraftMotion:h.motion,uJetA:h.jets.a,uJetB:h.jets.b,uJetBend:{f1:h.jets.bend}},i.velocity.write),i.velocity.swap(),$(L.curl,{uVelocity:i.velocity.read,uTexel:d},i.curl),$(L.vorticity,{uVelocity:i.velocity.read,uCurl:i.curl,uTexel:d,uStrength:s.vort*h.turbulence*(.4+.6*h.activity),uDt:y},i.velocity.write),i.velocity.swap(),$(L.divergence,{uVelocity:i.velocity.read,uTexel:d},i.divergence),$(L.scale,{uSource:i.pressure.read,uScale:.8},i.pressure.write),i.pressure.swap();for(let P=0;P<s.iters;P+=1)$(L.pressure,{uPressure:i.pressure.read,uDivergence:i.divergence,uTexel:d},i.pressure.write),i.pressure.swap();$(L.gradient,{uPressure:i.pressure.read,uVelocity:i.velocity.read,uTexel:d},i.velocity.write),i.velocity.swap(),$(L.dye,{uVelocity:i.velocity.read,uSource:i.dye.read,uWorld:j,uDt:y,uKeep:[Math.exp(-(s.keepD+s.keepIdle*(1-h.activity))*y),Math.exp(-s.keepH*y)],uRate:[s.rateN*h.smoke,s.rateH,s.rateK*h.smoke,s.rateC*h.smoke],uSpread:s.spread,uCol:[s.colSpread,s.colR*h.scale,s.colD,s.colU],uKick:[s.kickNear*h.scale,s.kickW*h.scale,s.kickH*h.scale],uDisperse:s.disperse,uDispV:s.dispV,uCraft:h.craft,uCraftMotion:h.motion,uGap:[h.spacing,s.gap*h.calm],uJetX:{f1:h.jetX},uJetN:h.jetN,uFloor:s.floor,uTime:h.time,uJetA:h.jets.a,uJetB:h.jets.b,uJetBend:{f1:h.jets.bend}},i.dye.write),i.dye.swap();let M=s.blur/2;$(L.blur,{uSource:i.dye.read,uStep:[M/i.dw,0]},i.temp),$(L.blur,{uSource:i.temp,uStep:[0,M/i.dh]},i.soft),t.bindTexture(t.TEXTURE_2D,i.soft.tex),t.generateMipmap(t.TEXTURE_2D)},render:(y,h,s)=>{if(!i)return;let d=Ke;t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,y,h),t.disable(t.BLEND),$(L.render,{uDye:i.soft,uWorld:j,uDyeSize:[i.dw,i.dh],uTime:s.time,uLightTheme:s.light?1:0,uSmoke:s.smokeColor,uShade:s.shadeColor,uThrust:s.thrustColor,uLook:[d.alphaK*(.6+.4*s.activity),d.relief,d.shadow,d.alphaLod],uLook2:[d.ambient,d.key,d.wrap,d.ao],uLook3:[d.normalE,d.normalLod,d.fine,d.broad],uCol:[d.colSpread,d.colR*s.scale,d.colD,d.colU],uScale:s.scale,uGamma:d.gamma,uTone:d.tone,uLight2:[d.jetLight,d.emit,d.exposure],uThreshold:d.threshold*(.3+.7*s.activity),uCraft:s.craft,uCraftMotion:s.motion,uJetA:s.jets.a,uJetB:s.jets.b,uJetBend:{f1:s.jets.bend}})},resize:ae,clear:()=>{i&&([i.velocity.read,i.velocity.write,i.pressure.read,i.pressure.write,i.dye.read,i.dye.write,i.soft,i.temp].forEach(y=>{t.bindFramebuffer(t.FRAMEBUFFER,y.fbo),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT)}),t.bindTexture(t.TEXTURE_2D,i.soft.tex),t.generateMipmap(t.TEXTURE_2D))},dispose:()=>{ve(),W.forEach(y=>t.deleteProgram(y.p)),t.deleteShader(H),t.deleteVertexArray(ce)}}}function rt({children:t="Take off",onClick:m,buttonProps:_={},anchorElement:H,controllerRef:W,quality:b=1,maxDpr:L=2,maxFps:ce=60,maxCanvasPixels:e=1/0,theme:U="dark",size:K="medium",radius:i,altitude:j=170,hoverTime:ve=2.4,jets:ae=2,thrusters:J=!0,trigger:I="hover",carryCursor:$=!0,ramp:Z=!1,rampColor:ee,smoke:V=1,turbulence:ge=1,wobble:y=1,thrustColor:h,smokeColor:s,buttonColor:d,textColor:M,className:P="",style:q}){let de=(0,ne.useRef)(null),Le=(0,ne.useRef)(null),Pe=(0,ne.useRef)(null),$e=(0,ne.useRef)(null),we=(0,ne.useRef)(null),ie=(0,ne.useRef)(null),ke=(0,ne.useRef)({}),me=U==="light",he=Oe[K]||Oe.medium,_e=h||(me?"#4f8cff":"#8ec5ff"),Be=s||(me?"#e9ebf0":"#eef1f6"),ze=d||(me?"#18181b":"#27272a"),Ie=M||(me?"#fafafa":"#f5f5f5"),Ye=ee||(me?"#ececf0":"#25222b"),le=C(Math.round(te(ae,2)),1,O),Ve=le===1?0:le===2?.3:.34,Se=J?Array.from({length:le},(re,Ue)=>le===1?50:50+Ve*100*(2*Ue/(le-1)-1)):[];return ke.current={size:K,anchorElement:H,quality:b,maxDpr:L,maxFps:ce,maxCanvasPixels:e,altitude:j,hoverTime:ve,jets:le,thrusters:!!J,trigger:I,carryCursor:$,ramp:!!Z,smoke:V,turbulence:ge,wobble:y,thrustColor:_e,smokeColor:Be,theme:U,onClick:m},(0,ne.useEffect)(()=>{let re=zt({root:de.current,canvas:Le.current,button:Pe.current,cursor:$e.current,ramp:we.current,props:ke});return ie.current=re,W&&(W.current={refresh:()=>re.refresh()}),()=>{W&&(W.current=null),ie.current=null,re.destroy()}},[]),(0,ne.useEffect)(()=>{ie.current&&ie.current.refresh()},[K,le,J,i]),(0,ne.useEffect)(()=>{ie.current&&ie.current.rehome()},[Z]),(0,oe.jsxs)("div",{ref:de,className:`flying-button ${P}`.trim(),"data-theme":U,"data-trigger":Z?"click":I,style:{"--fly-bg":ze,"--fly-ink":Ie,"--fly-glow":_e,"--fly-ramp":Ye,"--fly-h":`${he.h}px`,"--fly-px":`${he.px}px`,"--fly-fs":`${he.fs}px`,"--fly-scale":he.k,...i!=null?{"--fly-radius":`${te(i,0)}px`}:{},...q},children:[(0,oe.jsxs)("svg",{ref:we,className:"flying-button__ramp",style:Z?void 0:{display:"none"},"aria-hidden":"true",children:[(0,oe.jsx)("path",{className:"flying-button__ramp-body"}),(0,oe.jsx)("path",{className:"flying-button__ramp-edge"})]}),(0,oe.jsx)("canvas",{ref:Le,className:"flying-button__smoke","aria-hidden":"true"}),(0,oe.jsxs)("button",{..._,ref:Pe,type:"button",className:"flying-button__craft",onClick:re=>ke.current.onClick&&ke.current.onClick(re),children:[(0,oe.jsx)("span",{className:"flying-button__face","aria-hidden":"true"}),(0,oe.jsx)("span",{className:"flying-button__label",children:t}),Se.map(re=>(0,oe.jsx)("span",{className:"flying-button__pod",style:{left:`${re}%`},"aria-hidden":"true"},re))]}),(0,oe.jsx)("svg",{ref:$e,className:"flying-button__cursor",viewBox:"0 0 24 34","aria-hidden":"true",children:(0,oe.jsx)("path",{d:"M2.2 2.1v24.6l6.1-5.9 4.1 9.6 4.4-1.9-4.1-9.4h8.6z",fill:"#0a0a0c",stroke:"#fff",strokeWidth:"1.9",strokeLinejoin:"round"})})]})}var pe=Ce(He(),1);function Jt({host:t,model:m,onOpen:_}){let H=(0,xt.createRoot)(t),W=matchMedia("(hover: hover) and (pointer: fine)"),b=matchMedia("(prefers-reduced-motion: reduce)"),L=m,ce=!1,e=t.closest(".panel-stage"),U={current:null};function K(){if(!e||t.dataset.flightMode!=="on")return;let I=e.getBoundingClientRect(),$=t.getBoundingClientRect(),Z=parseFloat(getComputedStyle(e).paddingBottom)||0,V=Math.ceil(Math.max(e.clientHeight||I.height||96,$.bottom-I.top+e.scrollTop+Z))+"px";t.style.getPropertyValue("--project-flight-height")!==V&&t.style.setProperty("--project-flight-height",V),U.current?.refresh()}let i=typeof ResizeObserver=="function"?new ResizeObserver(K):null;if(e){i?.observe(e);for(let I of e.children)i?.observe(I)}i?.observe(t);let j=()=>K();window.addEventListener("resize",j);let ve=I=>{I.stopPropagation(),_(L.projectId)};function ae(I=L){if(ce)return;L=I;let $=t.contains(document.activeElement),Z=W.matches&&!b.matches;t.dataset.flightMode=Z?"on":"off",K();let ee={"data-stage-open":"","data-open-project":L.projectId,"aria-label":L.ariaLabel},V=(0,pe.jsxs)(pe.Fragment,{children:[(0,pe.jsx)("span",{children:L.label}),(0,pe.jsx)("svg",{className:"icon small","aria-hidden":"true",children:(0,pe.jsx)("use",{href:"#i-up-right"})})]});(0,yt.flushSync)(()=>H.render(Z?(0,pe.jsx)(rt,{anchorElement:t,controllerRef:U,quality:.5,maxDpr:1.25,maxFps:30,maxCanvasPixels:48e4,buttonProps:ee,onClick:ve,theme:L.night?"dark":"light",size:"medium",style:{"--fly-radius":"999px"},altitude:140,hoverTime:1.4,jets:2,carryCursor:!1,ramp:!1,smoke:.6,smokeColor:L.night?"#d6e0ef":"#9faebb",turbulence:.5,wobble:.25,buttonColor:L.night?"#c9c3b8":"#59636b",textColor:L.night?"#353d44":"#f4f0e8",className:"project-flying-button",children:V}):(0,pe.jsx)("button",{type:"button",...ee,className:"primary-button project-action-fallback",onClick:ve,children:V}))),$&&!t.contains(document.activeElement)&&t.querySelector("button")?.focus({preventScroll:!0})}let J=()=>ae();return W.addEventListener?.("change",J),b.addEventListener?.("change",J),ae(),{update:ae,dispose(){ce||(ce=!0,W.removeEventListener?.("change",J),b.removeEventListener?.("change",J),i?.disconnect(),window.removeEventListener("resize",j),H.unmount())}}}export{Jt as mountFlyingProjectAction};

import{b as ye,c as gt,d as wt,e as kt,f as Ve}from"./ui-shared-DB6FN6RA.js";var vt=ye(kt(),1),mt=ye(wt(),1);var oe=ye(gt(),1);var Z=ye(Ve(),1),H=1100,pt=380,Tt=10,te=H/(2*pt),Mt=5,X=4,lt=.55,Oe=H*.75,Ye=.42,qe={small:{h:36,px:16,fs:13,k:.82},medium:{h:44,px:22,fs:14,k:1},large:{h:52,px:26,fs:16,k:1.18},"extra-large":{h:60,px:30,fs:18,k:1.36}},C=(t,m,R)=>Math.min(R,Math.max(m,t)),ue=(t,m)=>Number.isFinite(Number(t))&&t!==null&&t!==""?Number(t):m,be=t=>{let m=C(t,0,1);return m*m*(3-2*m)},ut=t=>{let m=C(t,0,1);return m*m*m*(10+m*(6*m-15))},ft=t=>{let m=C(t,0,1);return 30*m*m*(1-m)*(1-m)},Ct=t=>{let m=C(t,0,1);return 60*m*(1-m)*(1-2*m)},We=(t,m)=>Math.sin(t*1.31+m)*.5+Math.sin(t*2.73+m*1.7)*.3+Math.sin(t*5.19+m*2.3)*.2,Lt=(t,m)=>Math.cos(t*1.31+m)*.655+Math.cos(t*2.73+m*1.7)*.819+Math.cos(t*5.19+m*2.3)*1.038,dt=t=>{let m=String(t||"").replace("#",""),R=m.length===3?m.replace(/(.)/g,"$1$1"):m.padEnd(6,"0").slice(0,6),W=parseInt(R,16);return Number.isFinite(W)?[(W>>16&255)/255,(W>>8&255)/255,(W&255)/255]:[1,1,1]},Et=`#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,ne=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`,Qe=`
uniform vec4 uJetA[${X}];
uniform vec4 uJetB[${X}];
uniform float uJetBend[${X}];
float jetWeight(vec2 p, vec4 a, vec4 b, out float along) {
  vec2 rel = p - a.xy;
  along = dot(rel, a.zw);
  vec2 off = rel - a.zw * clamp(along, 0.0, b.z);
  return exp(-dot(off, off) / (b.y * b.y)) * smoothstep(-b.y, 0.0, along);
}
`,Ze=`
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
`,Dt=`${ne}
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
}`,St=`${ne}
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
${Qe}
${Ze}
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
  for (int i = 0; i < ${X}; i++) {
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
  for (int i = 0; i < ${X}; i++) {
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
}`,Rt=`${ne}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = textureLod(uVelocity, vUv - vec2(uTexel.x, 0.0), 0.0).y;
  float R = textureLod(uVelocity, vUv + vec2(uTexel.x, 0.0), 0.0).y;
  float B = textureLod(uVelocity, vUv - vec2(0.0, uTexel.y), 0.0).x;
  float T = textureLod(uVelocity, vUv + vec2(0.0, uTexel.y), 0.0).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,_t=`${ne}
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
}`,Ut=`${ne}
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
}`,ht=`
float pressureAt(sampler2D tex, vec2 uv, vec2 texel, float c, int side) {
  if (side == 0 && uv.x - texel.x < 0.0) return 0.0;
  if (side == 1 && uv.x + texel.x > 1.0) return 0.0;
  if (side == 2 && uv.y - texel.y < 0.0) return c;
  if (side == 3 && uv.y + texel.y > 1.0) return 0.0;
  vec2 o = side == 0 ? vec2(-texel.x, 0.0) : side == 1 ? vec2(texel.x, 0.0) : side == 2 ? vec2(0.0, -texel.y) : vec2(0.0, texel.y);
  return textureLod(tex, uv + o, 0.0).x;
}
`,jt=`${ne}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
${ht}
void main() {
  float C = textureLod(uPressure, vUv, 0.0).x;
  float L = pressureAt(uPressure, vUv, uTexel, C, 0);
  float R = pressureAt(uPressure, vUv, uTexel, C, 1);
  float B = pressureAt(uPressure, vUv, uTexel, C, 2);
  float T = pressureAt(uPressure, vUv, uTexel, C, 3);
  float div = textureLod(uDivergence, vUv, 0.0).x;
  float pr = (L + R + B + T - div) * 0.25;
  outColor = vec4(abs(pr) < 1e6 ? pr : 0.0, 0.0, 0.0, 1.0);
}`,At=`${ne}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
${ht}
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
}`,Nt=`${ne}
uniform sampler2D uSource;
uniform vec2 uStep;
void main() {
  vec2 c = textureLod(uSource, vUv, 0.0).xy * 0.2270270;
  c += textureLod(uSource, vUv + uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv - uStep * 1.3846154, 0.0).xy * 0.3162162;
  c += textureLod(uSource, vUv + uStep * 3.2307692, 0.0).xy * 0.0702703;
  c += textureLod(uSource, vUv - uStep * 3.2307692, 0.0).xy * 0.0702703;
  outColor = vec4(c, 0.0, 1.0);
}`,Ft=`${ne}
uniform sampler2D uSource;
uniform float uScale;
void main() {
  outColor = textureLod(uSource, vUv, 0.0) * uScale;
}`,$t=`${ne}
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
uniform float uJetX[${X}];
uniform float uJetN;
uniform float uFloor;
uniform float uTime;
${Qe}
${Ze}
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
    for (int k = 0; k < ${X}; k++) {
      if (float(k) >= uJetN) break;
      nearest = min(nearest, abs(lq.x - uJetX[k]));
      outer = max(outer, abs(uJetX[k]));
    }
    float wx = uGap.x > 1.0 ? smoothstep(uGap.x * 0.22, uGap.x * 0.4, nearest) * (1.0 - smoothstep(outer - uGap.x * 0.1, outer, abs(lq.x))) : 0.0;
    val.x *= exp(-uGap.y * wx * wy * uDt);
  }
  val.x = max(val.x - uFloor * uDt, 0.0);
  vec2 p = vUv * uWorld;
  for (int i = 0; i < ${X}; i++) {
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
}`,Pt=`${ne}
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
${Qe}
${Ze}
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
  for (int i = 0; i < ${X}; i++) {
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
  float stepLen = 3.0;
  for (int i = 0; i < 9; i++) {
    float lod = max(log2(stepLen / texel), 0.0);
    tau += dens(p + ld * dist, lod) * stepLen;
    dist += stepLen;
    stepLen *= 1.4;
  }
  float sun = mix(exp(-uLook.z * tau), 1.0, wC * 0.6);
  float ao = mix(exp(-uLook2.w * dens(p, 4.5)), 1.0, wC);

  vec3 amb = vec3(0.84, 0.88, 1.0) * uLook2.x;
  vec3 key = vec3(1.0, 0.985, 0.96) * uLook2.y;
  vec3 lit = amb * ao + key * sun * diff;

  vec3 jl = vec3(0.0);
  vec3 core = vec3(0.0);
  for (int i = 0; i < ${X}; i++) {
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
}`,Je={colSpread:.1,colR:3.6,colD:1.25,colU:420,splash:400,friction:5,disperse:.6,dispV:60,gap:10,wind:8,turb:350,turbScale:34,jetLight:.3,threshold:.035,blur:3,emit:0,exposure:1.3,tone:1,gamma:.6,kickNear:45,kickW:18,kickH:14,vort:6,spread:.1,floor:.02,keepD:.3,keepIdle:.45,keepH:1.6,rateN:0,rateH:6,rateK:20,rateC:3,buoy:330,lift:22,damp:.55,radius:6,speed:380,reach:.9,forceMax:240,alphaK:4,relief:9,shadow:.026,alphaLod:0,ambient:.58,key:.82,wrap:.35,ao:.35,normalE:3,normalLod:-.8,fine:.35,broad:.9,iters:28};function Bt({root:t,canvas:m,button:R,cursor:W,ramp:U,props:w}){let $=m.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"high-performance"}),ee=typeof window<"u"&&window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null,e={W:0,H:0,dpr:1,bw:0,bh:0,x:0,vx:0,y:-te,vy:0,th:0,w:0,fvx:0,fvy:0,thrust:[0,0,0,0],delay:[0,0,0,0],phase:"rest",pt:0,clock:0,seed:Math.random()*100,wind:1,alt:160,climbT:1.6,y0:0,vrPrev:0,hold:2.4,xRef:0,landX:0,boost:!1,contact:!0,placed:!1,track:null,back:null,flip:null,rampKey:"",rampGeo:null,strip:null,u:0,v:0,target:{x:0,y:0},pointer:{in:!1,x:0,y:0,type:"mouse"},off:{x:0,y:0},attached:!1,hover:!1,armed:!0,carry:!1,pressed:!1,press:null,drag:null,suppress:!1,lastC:null,lastTh:0,quiet:0,running:!1,last:0,raf:0,simTime:0,activity:0},A=null;if($&&($.getExtension("EXT_color_buffer_float")||$.getExtension("EXT_color_buffer_half_float")))try{A=zt($)}catch{A=null}let l=()=>!!(ee&&ee.matches),J=()=>(qe[w.current.size]||qe.medium).k,N=()=>Mt*J(),fe=()=>C(Math.round(ue(w.current.jets,2)),1,X),G=()=>{let o=fe();if(o===1)return[0];let a=e.bw*(o===2?.3:.34);return Array.from({length:o},(r,n)=>a*(2*n/(o-1)-1))},de=()=>{let o=G();return o.length>1?[o[0],o[o.length-1]]:[-.3*e.bw,.3*e.bw]},P=()=>e.thrust[0]+e.thrust[1]+e.thrust[2]+e.thrust[3],_e=()=>e.phase==="ignite"||e.phase==="climb"||e.phase==="hover"||e.phase==="descend"||e.phase==="drag",Le=()=>e.phase==="drive"||e.phase==="loop"||e.phase==="flip"||e.phase==="return",ie=()=>[e.bw/2+4,Math.max(e.bw/2+4,e.W-e.bw/2-4)],ae=()=>!!w.current.ramp,y=()=>{let o=N()+e.bh/2,a=`${e.W}|${e.H}|${e.bw}|${o}`;if(e.rampKey===a&&e.rampGeo)return e.rampGeo;let r=Math.max(e.H*.24,N()+e.bh+40),n=1/r,f=r*.4,u=r*Math.PI/2-f,h=(D,S)=>{let I=[[f,0,n],[u,n,n],[f,n,0],[D,0,0],[f,0,n],[u,n,n],[f,n,0],[S,0,0]],j={ss:[0],xs:[0],ys:[0],ps:[0],ks:[0]},q=0,O=0,Y=0,pe=0;return I.forEach(([he,Me,Ee])=>{let me=Math.max(1,Math.round(he/1.5)),ve=he/me;for(let xe=0;xe<me;xe+=1){let De=Me+(Ee-Me)*((xe+.5)/me),Se=Y+De*ve/2;q+=Math.cos(Se)*ve,O+=Math.sin(Se)*ve,Y+=De*ve,pe+=ve,j.ss.push(pe),j.xs.push(q),j.ys.push(O),j.ps.push(Y),j.ks.push(Me+(Ee-Me)*((xe+1)/me))}}),j},T=h(0,0),x=Math.max(0,e.H*.66-Math.max(...T.ys)),L=h(x,Math.max(48,e.W*.16)),k=C(r*.12,8,16),E=e.W-Math.max(18,e.W*.05)-k-Math.max(...L.xs),_=L.xs.map(D=>D+E),z=L.ss.length-1,v=L.ys.findIndex(D=>D>3),i=v<0?_[z]:_[v],M={...L,xs:_,r,T:k,x0:E,foot:i,S:L.ss[z],clear:Math.min(i,_[z])-12,ok:Math.max(...L.ys)+k<e.H-8};return e.rampKey=a,e.rampGeo=M,M},p=()=>{let[o,a]=ie();if(!ae())return C(e.W/2,o,a);let r=y();return C(Math.min(r.foot*.5,r.x0-90,r.clear-e.bw/2-40),o,a)},s=()=>({x:e.x,y:N()+e.bh/2+e.y+te}),d=()=>{let o=s(),a=Math.cos(e.th),r=Math.sin(e.th),n=w.current.thrusters?-(e.bh/2+N())+1:-(e.bh/2)+2;return G().map(f=>({x:o.x+f*a-n*r,y:o.y+f*r+n*a,dx:r,dy:-a}))},b=()=>{let o=s();return{x:o.x,y:e.H-o.y}},B=(o,a,r,n,f,u,h)=>{let T=f[0]-u[0],x=h[0]-u[0],L=n[0]-f[0]+u[0]-h[0],k=f[1]-u[1],E=h[1]-u[1],_=n[1]-f[1]+u[1]-h[1],z=T*E-x*k||1e-6,v=(L*E-x*_)/z,i=(T*_-L*k)/z,M=f[0]-n[0]+v*f[0],D=h[0]-n[0]+i*h[0],S=f[1]-n[1]+v*f[1],I=h[1]-n[1]+i*h[1],j=n[0]-M*o/a,q=n[1]-S*o/a;return Math.abs(v)<1e-7&&Math.abs(i)<1e-7?`matrix(${[M/a,S/a,D/r,I/r,j,q].map(Y=>Y.toFixed(6)).join(",")})`:`matrix3d(${[M/a,S/a,0,v/a,D/r,I/r,0,i/r,0,0,1,0,j,q,0,1-v*o/a].map(Y=>Y.toFixed(6)).join(",")})`},V=()=>{e.strip&&(e.strip.wrap.remove(),e.strip.ink.remove(),e.strip=null,R.style.visibility="")},K=()=>{V();let o=e.track;if(!o)return;let a=o.geo,r=N()+e.bh/2,n=[0];for(let v=1;v<a.ss.length;v+=1){let i=(a.ks[v]+a.ks[v-1])/2;n.push(n[v-1]+(a.ss[v]-a.ss[v-1])*Math.max(1-i*r,.2))}let f=C(Math.round(e.bw/8),8,32),u=document.createElement("div");u.setAttribute("aria-hidden","true"),u.style.cssText="position:absolute;inset:0;z-index:1;pointer-events:none";let h=document.createElement("div");h.setAttribute("aria-hidden","true"),h.style.cssText="position:absolute;inset:0;z-index:2;pointer-events:none;will-change:transform";let T=Array.from(R.children),x=T[1],L=T.slice(2).map(v=>{let i=v.cloneNode(!0);return i.style.left="0px",i.style.top="0px",i.style.transformOrigin="0 0",u.appendChild(i),{el:i,x:v.offsetLeft,y:v.offsetTop+v.offsetHeight/2,k:1}}),k=[];for(let v=0;v<f;v+=1){let i=R.cloneNode(!0);i.removeAttribute("data-hover"),i.removeAttribute("data-pressed"),i.setAttribute("tabindex","-1"),i.setAttribute("inert",""),Array.from(i.children).slice(1).forEach(S=>{S.style.visibility="hidden"});let M=e.bw*v/f-(v?.75:2),D=e.bw*(v+1)/f+(v<f-1?.75:2);i.style.visibility="visible",i.style.transformOrigin="0 0",i.style.clipPath=`polygon(${M}px -2px, ${D}px -2px, ${D}px ${e.bh+2}px, ${M}px ${e.bh+2}px)`,u.appendChild(i),k.push(i)}let E=[],_=x&&x.textContent||"",z=document.createElement("canvas").getContext("2d");if(x&&z&&_.trim()&&!x.children.length){let v=getComputedStyle(x),i=`${v.fontStyle} ${v.fontWeight} ${v.fontSize} ${v.fontFamily}`;z.font=i;let M=Array.from(_),D=j=>z.measureText(M.slice(0,j).join("")).width,S=D(M.length)||1,I=x.offsetTop+x.offsetHeight/2;M.forEach((j,q)=>{let O=document.createElement("span");O.textContent=j,O.style.cssText=`position:absolute;left:0;top:0;white-space:pre;line-height:1;transform-origin:0 0;font:${i};color:${v.color}`,h.appendChild(O),E.push({el:O,x:x.offsetLeft+(D(q)+D(q+1))/2*(x.offsetWidth/S),y:I,k:.5})})}else if(x){let v=x.cloneNode(!0);v.style.position="absolute",v.style.left="0px",v.style.top="0px",v.style.transformOrigin="0 0",h.appendChild(v),E.push({el:v,x:x.offsetLeft+x.offsetWidth/2,y:x.offsetTop+x.offsetHeight/2,k:0})}t.appendChild(u),t.appendChild(h),R.style.visibility="hidden",e.strip={wrap:u,ink:h,parts:k,n:f,sn:n,pods:L,items:E}},ge=()=>{let o=e.strip,a=e.track;if(!o||!a)return;let r=a.geo,n=r.ss[r.ss.length-1],f=o.sn[o.sn.length-1],u=(i,M,D)=>{let S=0,I=i.length-1;for(;I-S>1;){let j=S+I>>1;i[j]<=D?S=j:I=j}return M[S]+(M[I]-M[S])*((D-i[S])/(i[I]-i[S]))},h=i=>i<=0?i:i>=n?f+i-n:u(r.ss,o.sn,i),T=i=>i<=0?i:i>=f?n+i-f:u(o.sn,r.ss,i),x=h(e.u),L=N(),k=(i,M)=>{let[D,S,I]=Ne(r,T(x+i-e.bw/2)),j=L+e.bh-M;return[D-Math.sin(I)*j,e.H-S-Math.cos(I)*j,I]},E=(i,M,D,S)=>{i.style.transform=`translate(${M.toFixed(2)}px, ${D.toFixed(2)}px) rotate(${(-S).toFixed(4)}rad) translate(-50%, -50%)`},_=e.bw/o.n,z=[],v=[];for(let i=0;i<=o.n;i+=1)z.push(k(i*_,0)),v.push(k(i*_,e.bh));o.parts.forEach((i,M)=>{i.style.transform=B(M*_,_,e.bh,z[M],z[M+1],v[M+1],v[M])}),o.pods.forEach(i=>{let[M,D,S]=k(i.x,i.y);E(i.el,M,D,S)}),o.items.forEach(i=>{let[M,D,S]=k(i.x,i.y),[I,j,q]=k(e.bw/2,i.y),O=i.x-e.bw/2,Y=I+Math.cos(q)*O,pe=j-Math.sin(q)*O;E(i.el,Y+(M-Y)*i.k,pe+(D-pe)*i.k,q+(S-q)*i.k)})},le=()=>{e.strip&&ge();let o=s(),a=o.x-e.bw/2,r=e.H-o.y-e.bh/2;R.style.transform=`translate3d(${a.toFixed(2)}px, ${r.toFixed(2)}px, 0) rotate(${(-e.th).toFixed(5)}rad)`,t.style.setProperty("--fly-thrust",C(P()*.9,0,1.2).toFixed(3))},we=()=>{if(!U)return;let o=y(),a=U.querySelectorAll("path"),r=a[0],n=a[1],f=h=>h.toFixed(1),u=h=>{let T=[];for(let L=0;L<o.ss.length;L+=2){let k=o.ps[L];T.push(`${f(o.xs[L]+Math.sin(k)*h)} ${f(e.H-o.ys[L]+Math.cos(k)*h)}`)}let x=o.ps[o.ss.length-1];return T.push(`${f(o.xs[o.ss.length-1]+Math.sin(x)*h)} ${f(e.H-o.ys[o.ss.length-1]+Math.cos(x)*h)}`),`M ${T.join(" L ")}`};U.setAttribute("viewBox",`0 0 ${f(e.W)} ${f(e.H)}`),U.style.visibility=o.ok?"":"hidden",r&&(r.setAttribute("d",u(o.T/2)),r.setAttribute("stroke-width",f(o.T))),n&&n.setAttribute("d",u(.75))},Ue=o=>{let a=new Float32Array(X*4),r=new Float32Array(X*4),n=[0,0,0,0],f=o.length,u=Je,h=J();return o.forEach((T,x)=>{let L=C(e.thrust[x]*f,0,2),k=T.dy<-.2?T.y/-T.dy:u.forceMax;a.set([T.x,T.y,T.dx,T.dy],x*4),r.set([u.speed*Math.sqrt(L),u.radius*h,Math.min(u.forceMax,k*u.reach),L>.004?L:0],x*4);let E=e.fvx*-T.dy+e.fvy*T.dx;n[x]=C(-E*.22,-.55*k,.55*k)}),{a,b:r,bend:n}},ke=o=>{if(!A)return;let a=w.current,r=d(),n=Ue(r),f=s(),u=G(),h=J(),T=[f.x,f.y,e.bw/2,e.bh/2],x=[e.vx,e.vy,e.th,e.w],L=(1-be((Math.abs(e.fvx)-40)/100))*(1-be((Math.abs(e.th)-.1)/.2))*(Le()?0:1);o>0&&(e.simTime+=o,A.step(o,{jets:n,craft:T,motion:x,calm:L,scale:h,activity:e.activity,jetX:[0,1,2,3].map(E=>E<u.length?u[E]:0),jetN:u.length,spacing:u.length>1?u[1]-u[0]:0,wind:e.wind*Je.wind,time:e.simTime,smoke:C(ue(a.smoke,1),0,3),turbulence:C(ue(a.turbulence,1),0,3)}));let k=dt(a.smokeColor);A.render(m.width,m.height,{jets:n,craft:T,motion:x,scale:h,activity:e.activity,time:e.simTime,light:a.theme==="light",smokeColor:k,shadeColor:k.map((E,_)=>E*.74+[0,.012,.045][_]),thrustColor:dt(a.thrustColor)})},Te=()=>{let o=t.getBoundingClientRect(),a=e.W;if(e.W=Math.max(1,o.width),e.H=Math.max(1,o.height),e.bw=R.offsetWidth,e.bh=R.offsetHeight,e.placed?a>0&&a!==e.W&&(e.x*=e.W/a):(e.x=p(),e.placed=!0),!Le()){let[f,u]=ie();e.x=C(e.x,f,u)}e.dpr=Math.min(window.devicePixelRatio||1,2);let r=Math.round(e.W*e.dpr),n=Math.round(e.H*e.dpr);(m.width!==r||m.height!==n)&&(m.width=r,m.height=n),A&&A.resize(e.W,e.H),we(),t.dataset.ready="",le(),e.running||ke(0)},je=(o,a,r=0)=>{let n=b(),f=e.th,u=o-n.x,h=a-n.y,T=u*Math.cos(f)-h*Math.sin(f),x=u*Math.sin(f)+h*Math.cos(f);return Math.abs(T)<=e.bw/2+2+r&&x>=-e.bh/2-2-r&&x<=e.bh/2+N()+r},Ae=()=>{e.pt=0,e.armed=!1,e.seed=Math.random()*100,e.wind=Math.random()<.5?-1-Math.random():1+Math.random(),e.vrPrev=0,e.quiet=0,e.boost=!1},Q=()=>{if(e.phase!=="rest"||l())return!1;let o=w.current;Ae(),e.phase="ignite",e.delay=e.delay.map(()=>Math.random()*.07);let a=e.H-e.bh-N()-30-te;return e.alt=C(e.y+ue(o.altitude,170),e.y+24,Math.max(e.y+24,a)),e.climbT=1.15+(e.alt-e.y)/420,e.hold=Math.max(0,ue(o.hoverTime,2.4)),e.xRef=e.x,Pe(),!0},Ne=(o,a)=>{if(a<=0)return[o.x0+a,0,0,0];let r=0,n=o.ss.length-1;if(a>=o.ss[n]){let u=o.ps[n];return[o.xs[n]+Math.cos(u)*(a-o.ss[n]),o.ys[n]+Math.sin(u)*(a-o.ss[n]),u,0]}for(;n-r>1;){let u=r+n>>1;o.ss[u]<=a?r=u:n=u}let f=(a-o.ss[r])/(o.ss[n]-o.ss[r]);return[o.xs,o.ys,o.ps,o.ks].map(u=>u[r]+(u[n]-u[r])*f)},Fe=(o,a)=>{let[r,n,f,u]=Ne(o.geo,a);return{x:r-Math.sin(f)*o.base,cy:n+Math.cos(f)*o.base,th:f,bend:u*o.base}},re=()=>{if(e.phase!=="rest"||l()||!ae())return!1;let o=y(),a=o.x0-e.x;if(a<60||!o.ok)return Q();Ae();let r=N()+e.bh/2,n=Math.max(...o.ys)-2*r,f=Math.sqrt(2*Oe*n+2.2*Oe*(o.r-r));return e.track={geo:o,base:r,v0:f,acc:f*f/(2*a)},e.phase="drive",e.u=-a,e.v=0,e.thrust=[0,0,0,0],K(),Pe(),!0},$e=o=>{let[a,r]=ie(),n=e.x+o;ae()&&(n=Math.min(n,y().clear-e.bw/2)),e.landX=C(n,a,r)},xt=o=>{let a=w.current,r=C(ue(a.wobble,1),0,3);if(e.pt+=o,e.clock+=o,e.phase==="return"){let c=e.back,g=Math.min(e.pt/c.time,1);e.x=c.from+(c.to-c.from)*ut(g),e.vx=(c.to-c.from)*ft(g)/c.time,e.y=-te,e.vy=0,e.th=0,e.w=0,g>=1&&(e.phase="rest",e.pt=0,e.vx=0);return}if(e.phase==="drive"||e.phase==="loop"){let c=e.track,g=Fe(c,e.u);e.phase==="drive"?e.v=Math.min(c.v0,e.v+c.acc*o):e.v=Math.sqrt(Math.max(c.v0*c.v0-2*Oe*(g.cy-c.base),.2*c.v0*c.v0)),e.u+=e.v*o/Math.max(1-g.bend,.25),e.phase==="drive"&&e.u>=0&&(e.phase="loop");let F=Fe(c,e.u);e.vx=(F.x-g.x)/o,e.vy=(F.cy-g.cy)/o,e.w=(F.th-g.th)/o,e.x=F.x,e.y=F.cy-N()-e.bh/2-te,e.th=F.th,e.thrust=e.thrust.map(se=>se*Math.exp(-o/.1)),e.phase==="loop"&&e.u>=c.geo.S&&(V(),e.phase="flip",e.pt=0,e.flip={th:e.th,w:e.w});return}let n=(e.bw*e.bw+e.bh*e.bh)/12,f=Math.max(Math.cos(e.th),.5),u=0,h=!1,T=e.xRef,x=3,L=3.6,k=null;if(e.phase==="flip"){let c=Math.min(e.pt/Ye,1),g=e.flip,F=Math.PI*2;k={th:(2*c*c*c-3*c*c+1)*g.th+(c*c*c-2*c*c+c)*Ye*g.w+(3*c*c-2*c*c*c)*F,w:(6*c*c-6*c)*(g.th-F)/Ye+(3*c*c-4*c+1)*g.w},u=2.4*be((Math.cos(k.th)-.8)/.15);let se=e.y+te<e.bh*.6;(c>=1||se)&&(k=null,e.th-=Math.PI*2*Math.round(e.th/(Math.PI*2)),e.phase="descend",e.pt=0,e.boost=!0,e.vrPrev=e.vy,$e(e.vx*Math.abs(e.vx)/700))}if(e.phase==="ignite"&&(u=.9*be(e.pt/.5),e.pt>=.5&&(e.phase="climb",e.pt=0,e.y0=e.y)),e.phase==="climb"){let c=e.pt/e.climbT,g=e.alt-e.y0,F=e.y0+g*ut(c),se=g*ft(c)/e.climbT,Ce=g*Ct(c)/(e.climbT*e.climbT);u=(H+Ce+30*(F-e.y)+8*(se-e.vy))/(H*f),h=!0,c>=1&&(e.phase="hover",e.pt=0)}else if(e.phase==="hover"){let c=e.clock*.8,g=e.alt+3.5*r*We(c,e.seed),F=3.5*r*.8*Lt(c,e.seed);u=(H+30*(g-e.y)+8*(F-e.vy))/(H*f),h=!0,e.pt>=e.hold&&(e.phase="descend",e.pt=0,e.vrPrev=0,$e(0))}else if(e.phase==="drag"){let c=e.target.y-N()-e.bh/2-te;u=(H+34*(c-e.y)-10*e.vy)/(H*f),h=!0}else if(e.phase==="descend"){T=e.landX,x=e.boost?5:4,L=e.boost?4.6:4.2;let c=170,g=32,F=e.boost?be((Math.abs(e.landX-e.x)-20)/40):be((Math.abs(e.landX-e.x)-3)/23),se=Math.max(e.y+te,0),Ce=(g+(c-g)*(1-Math.exp(-se/52)))*(1-(e.boost?.45:.88)*F),Ke=e.boost?c*3:c*be(e.pt/.9)+1,Re=-Math.min(Ce,Ke),Ie=C((Re-e.vrPrev)/Math.max(o,1e-4),-600,600);e.vrPrev=Re,u=(H+Ie+(e.boost?9:7)*(Re-e.vy))/(H*f),h=!0,e.contact&&e.pt>.3&&(e.phase="landed",e.pt=0,e.boost=!1)}else if(e.phase==="landed"&&(u=0,e.pt>.6&&P()<.03)){let c=ae()&&e.track?p():e.x;e.phase=Math.abs(c-e.x)>6?"return":"rest",e.pt=0,e.thrust=[0,0,0,0],e.vy=0,e.w=0,e.vx=0,e.track=null,e.back={from:e.x,to:c,time:C(Math.abs(c-e.x)/200,.7,1.8)}}u=Number.isFinite(u)?C(u,0,e.boost||e.phase==="flip"?2.6:1.9):1;let E=G(),_=E.length,z=E.reduce((c,g)=>c+g*g,0),v=e.phase==="drag"?C(100*(e.target.x-e.x)-17*e.vx,-2400,2400):0,i=0;if(h){let c=.8*r*We(e.clock*1.7,e.seed+3),g=e.phase==="drag"?v*.75:x*(T-e.x)-L*e.vx,F=e.boost?.45:.32,se=C(-Math.atan2(g,H),-F,F);i=-81*(e.th-se)-14*e.w-c}let M=(e.boost||e.phase==="flip"?2.6:2.4)/_,D=(c,g)=>c+(g-c)*(1-Math.exp(-o/(g>c?.08:.17))),S=z>1?i*n/(H*z):0,I=Math.abs(S)*Math.max(0,...E.map(Math.abs)),j=Math.min(u/_,Math.max(M-I,M*.5)),q=0;for(let c=0;c<X;c+=1){let g=0;c<_&&(g=C(j+S*E[c],0,M),e.phase==="ignite"&&e.pt<e.delay[c]&&(g=0)),e.thrust[c]=D(e.thrust[c],g),c<_&&(q+=e.thrust[c]*E[c])}let O=P()*H,Y=e.phase==="drag"?v:-O*Math.sin(e.th)-.8*e.vx,pe=O*Math.cos(e.th)-H-.3*e.vy,he=e.phase==="flip"?0:q*H/n-1.2*e.w;h&&(e.phase!=="drag"&&(Y+=12*r*We(e.clock*.7,e.seed+7)),he+=.9*r*We(e.clock*2.3,e.seed+11),z<1&&(he+=i),Math.abs(e.th)>.35&&(he-=(e.th-Math.sign(e.th)*.35)*160));let Me=s(),Ee=Math.cos(e.th),me=Math.sin(e.th),ve=-(e.bh/2+N()),xe=!1;e.phase!=="flip"&&de().forEach(c=>{let g=c*Ee-ve*me,F=c*me+ve*Ee,se=Me.y+F,Ce=te-se;if(Ce>0){xe=!0;let Ke=e.vy+e.w*g,Re=e.vx-e.w*F,Ie=Math.max(0,pt*Ce-Tt*Ke),it=-10*Re;pe+=Ie,Y+=it,he+=(g*Ie-F*it)/n}}),e.contact=xe,e.vx=C(e.vx+Y*o,-1500,1500),e.vy=C(e.vy+pe*o,-1500,1500),e.w=C(e.w+he*o,-14,14),e.x+=e.vx*o,e.y+=e.vy*o,e.th+=e.w*o,k&&(e.th=k.th,e.w=k.w),e.phase!=="flip"&&Math.abs(e.th)>lt&&(e.th=Math.sign(e.th)*lt,e.w*e.th>0&&(e.w=0));let[De,Se]=ie();(e.x<De||e.x>Se)&&(e.x=C(e.x,De,Se),e.vx=0),e.y+te<-40&&(e.y=-te,e.vy=0),Number.isFinite(e.y+e.x+e.th+e.vy+e.vx+e.w+P())||(Object.assign(e,{x:e.W/2,vx:0,y:-te,vy:0,th:0,w:0,thrust:[0,0,0,0],phase:"rest"}),e.drag=null)},He=o=>{let a=w.current,r=e.pointer,n=b();if(e.attached&&!e.drag&&e.lastC){let x=r.x+e.off.x,L=r.y+e.off.y,k=-(e.th-e.lastTh),E=x-e.lastC.x,_=L-e.lastC.y,z=n.x+E*Math.cos(k)-_*Math.sin(k),v=n.y+E*Math.sin(k)+_*Math.cos(k);e.off.x+=z-x,e.off.y+=v-L}e.lastC=n,e.lastTh=e.th;let f=r.x+e.off.x,u=r.y+e.off.y,h=r.in&&je(f,u,e.attached||e.drag?10:0);if(h!==e.hover&&(e.hover=h,h?R.dataset.hover="":delete R.dataset.hover),!h&&!e.drag&&(e.attached=!1,e.phase==="rest"&&(e.armed=!0)),h&&e.armed&&e.phase==="rest"&&r.type==="mouse"&&a.trigger!=="click"&&!ae()&&Q()&&(e.attached=!!a.carryCursor),e.phase==="rest"&&Math.abs(e.off.x)+Math.abs(e.off.y)<12){let x=Math.exp(-o*6);e.off.x*=x,e.off.y*=x}Math.abs(e.off.x)+Math.abs(e.off.y)<.3&&(!e.attached||e.phase==="rest")&&(e.off.x=0,e.off.y=0,e.phase==="rest"&&(e.attached=!1));let T=!!a.carryCursor&&r.in&&r.type==="mouse"&&(e.attached||!!e.drag||e.off.x!==0||e.off.y!==0);T!==e.carry&&(e.carry=T,T?t.dataset.carry="":delete t.dataset.carry),T&&W&&(W.style.transform=`translate3d(${(f-1.8).toFixed(2)}px, ${(u-1.75).toFixed(2)}px, 0)`)},tt=o=>{if(e.raf=0,document.hidden){e.last=0;return}let a=e.last?C((o-e.last)/1e3,0,1/30):1/60;if(e.last=o,a>0){if(e.phase!=="rest")for(let h=0;h<6;h+=1)xt(a/6);let r=1-Math.exp(-a/.12);e.fvx+=(e.vx-e.fvx)*r,e.fvy+=(e.vy-e.fvy)*r,He(a),le(),ke(a);let n=P();e.quiet=n>.01||e.phase!=="rest"?0:e.quiet+a;let f=n>.05?1:0;e.activity+=(f-e.activity)*(1-Math.exp(-a/(f?.25:1.6)))}e.phase!=="rest"||e.quiet<7||e.carry?e.raf=requestAnimationFrame(tt):(e.running=!1,e.last=0,A&&A.clear(),ke(0))},Pe=()=>{e.raf||document.hidden||(e.running=!0,e.raf=requestAnimationFrame(tt))},ot=o=>{let a=t.getBoundingClientRect();return{x:o.clientX-a.left,y:o.clientY-a.top}},Xe=()=>{let o=e.pointer,a=o.type==="mouse";return{x:o.x+(a?e.off.x:0),y:o.y+(a?e.off.y:0)}},at=()=>{if(!e.drag)return;let o=Xe(),[a,r]=ie(),n=N()+e.bh/2;e.target.x=C(o.x-e.drag.gx,a,r),e.target.y=C(e.H-(o.y-e.drag.gy),n,Math.max(n,e.H-e.bh/2-6))},yt=o=>{let a=Xe(),r=b();e.drag={gx:a.x-r.x,gy:a.y-r.y},e.phase="drag",e.pt=0,e.attached=!1,e.pressed=!1,e.suppress=!0,e.boost=!1,delete R.dataset.pressed,t.dataset.dragging="";try{t.setPointerCapture(o.pointerId)}catch{}at()},bt=o=>{e.drag=null,e.press=null,delete t.dataset.dragging;try{t.releasePointerCapture(o.pointerId)}catch{}e.phase="hover",e.pt=0,e.alt=e.y;let[a,r]=ie();e.xRef=C(e.x+e.vx*.3,a,r),e.hold=Math.min(Math.max(0,ue(w.current.hoverTime,2.4)),.9)},Be=o=>{let a=ot(o),r=e.pointer;if(r.in&&!e.attached&&!e.drag&&(e.off.x||e.off.y)){let n=Math.exp(-Math.hypot(a.x-r.x,a.y-r.y)/110);e.off.x*=n,e.off.y*=n}r.x=a.x,r.y=a.y,r.in=!0,r.type=o.pointerType||"mouse",e.press&&!e.drag&&_e()&&Math.hypot(a.x-e.press.x,a.y-e.press.y)>4&&yt(o),e.drag&&at(),He(0),(e.carry||e.phase!=="rest")&&Pe()},rt=()=>{e.drag||(e.pointer.in=!1,e.attached=!1,e.off.x=0,e.off.y=0,He(0))},st=o=>{let a=ot(o),r=e.pointer;r.x=a.x,r.y=a.y,r.in=!0,r.type=o.pointerType||"mouse",e.suppress=!1;let n=Xe();je(n.x,n.y,e.attached?10:0)&&(r.type!=="mouse"&&e.phase==="rest"&&w.current.trigger!=="click"&&!ae()&&Q(),e.press={x:a.x,y:a.y},e.carry&&r.type==="mouse"&&(e.pressed=!0,R.dataset.pressed=""))},ze=o=>{if(e.drag){bt(o);return}e.press=null,e.pressed&&(e.pressed=!1,delete R.dataset.pressed,e.carry&&e.hover&&(e.phase==="rest"&&ae()?re():w.current.trigger==="click"&&Q()&&(e.attached=!!w.current.carryCursor),w.current.onClick&&w.current.onClick(o)))},nt=o=>{if(e.suppress){e.suppress=!1,o.stopPropagation(),o.preventDefault();return}if(e.phase==="rest"){if(ae()){re();return}Q()&&e.pointer.type==="mouse"&&e.pointer.in&&e.hover&&(e.attached=!!w.current.carryCursor)}},ct=()=>{document.hidden?(e.raf&&cancelAnimationFrame(e.raf),e.raf=0,e.last=0):e.phase!=="rest"&&Pe()};document.addEventListener("visibilitychange",ct),t.addEventListener("pointermove",Be),t.addEventListener("pointerenter",Be),t.addEventListener("pointerleave",rt),t.addEventListener("pointerdown",st),t.addEventListener("pointerup",ze),t.addEventListener("pointercancel",ze),R.addEventListener("click",nt);let Ge=new ResizeObserver(Te);return Ge.observe(t),Ge.observe(R),Te(),{refresh:Te,rehome(){Te(),e.phase==="rest"&&(e.x=p(),le(),e.running||ke(0))},destroy(){Ge.disconnect(),document.removeEventListener("visibilitychange",ct),V(),e.raf&&cancelAnimationFrame(e.raf),t.removeEventListener("pointermove",Be),t.removeEventListener("pointerenter",Be),t.removeEventListener("pointerleave",rt),t.removeEventListener("pointerdown",st),t.removeEventListener("pointerup",ze),t.removeEventListener("pointercancel",ze),R.removeEventListener("click",nt),A&&A.dispose(),$?.getExtension("WEBGL_lose_context")?.loseContext()}}}function zt(t){let m=(y,p)=>{let s=t.createShader(y);if(t.shaderSource(s,p),t.compileShader(s),!t.getShaderParameter(s,t.COMPILE_STATUS)){let d=t.getShaderInfoLog(s);throw t.deleteShader(s),new Error(d)}return s},R=m(t.VERTEX_SHADER,Et),W=[],U=y=>{let p=m(t.FRAGMENT_SHADER,y),s=t.createProgram();if(t.attachShader(s,R),t.attachShader(s,p),t.linkProgram(s),!t.getProgramParameter(s,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(s));t.deleteShader(p);let d={},b=t.getProgramParameter(s,t.ACTIVE_UNIFORMS);for(let V=0;V<b;V+=1){let K=t.getActiveUniform(s,V);d[K.name.replace(/\[0\]$/,"")]=t.getUniformLocation(s,K.name)}let B={p:s,u:d};return W.push(B),B},w={advect:U(Dt),force:U(St),curl:U(Rt),vorticity:U(_t),divergence:U(Ut),pressure:U(jt),gradient:U(At),scale:U(Ft),blur:U(Nt),dye:U($t),render:U(Pt)},$=t.createVertexArray(),ee=[],e=(y,p,s,d)=>{let b=t.createTexture();t.bindTexture(t.TEXTURE_2D,b);let B=d?Math.floor(Math.log2(Math.max(y,p)))+1:1;t.texStorage2D(t.TEXTURE_2D,B,s,y,p),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,d?t.LINEAR_MIPMAP_LINEAR:t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE);let V=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,V),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,b,0),t.viewport(0,0,y,p),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT);let K={tex:b,fbo:V,w:y,h:p,mips:d};return ee.push(K),K},A=(y,p,s,d)=>{let b={read:e(y,p,s,d),write:e(y,p,s,d)};return b.swap=()=>{let B=b.read;b.read=b.write,b.write=B},b},l=null,J=[1,1],N=()=>{ee.forEach(y=>{t.deleteTexture(y.tex),t.deleteFramebuffer(y.fbo)}),ee.length=0},fe=(y,p)=>{let s=Math.max(2,y/520,p/300),d=Math.max(16,Math.round(y/s)),b=Math.max(16,Math.round(p/s)),B=Math.max(16,Math.round(y/(s/2))),V=Math.max(16,Math.round(p/(s/2)));J=[y,p],!(l&&l.vw===d&&l.vh===b&&l.dw===B&&l.dh===V)&&(N(),l={vw:d,vh:b,dw:B,dh:V,velocity:A(d,b,t.RG16F,!1),pressure:A(d,b,t.R16F,!1),divergence:e(d,b,t.R16F,!1),curl:e(d,b,t.R16F,!1),dye:A(B,V,t.RG16F,!1),soft:e(B,V,t.RG16F,!0),temp:e(B,V,t.RG16F,!1)})},G=0,de=(y,p)=>{t.useProgram(y.p),G=0,Object.entries(p).forEach(([s,d])=>{let b=y.u[s];b!=null&&(typeof d=="number"?t.uniform1f(b,d):d.f1?t.uniform1fv(b,d.f1):d.tex?(t.activeTexture(t.TEXTURE0+G),t.bindTexture(t.TEXTURE_2D,d.tex),t.uniform1i(b,G),G+=1):d.length===2?t.uniform2fv(b,d):d.length===3?t.uniform3fv(b,d):t.uniform4fv(b,d))})},P=(y,p,s)=>{de(y,p),s&&(t.bindFramebuffer(t.FRAMEBUFFER,s.fbo),t.viewport(0,0,s.w,s.h)),t.bindVertexArray($),t.drawArrays(t.TRIANGLES,0,3)};return{step:(y,p)=>{if(!l)return;let s=Je;t.disable(t.BLEND);let d=[1/l.vw,1/l.vh];P(w.advect,{uVelocity:l.velocity.read,uSource:l.velocity.read,uWorld:J,uDt:y,uKeep:1},l.velocity.write),l.velocity.swap(),P(w.force,{uVelocity:l.velocity.read,uDye:l.soft,uWorld:J,uDt:y,uBuoyancy:s.buoy,uLift:s.lift,uDamping:s.damp,uSpread:s.spread,uSplash:s.splash,uFriction:s.friction,uWind:p.wind,uTurb:[s.turb*(.35+.65*p.activity),s.turbScale],uTime:p.time,uObstacle:p.calm,uKick:[s.kickNear*p.scale,s.kickW*p.scale,s.kickH*p.scale],uCraft:p.craft,uCraftMotion:p.motion,uJetA:p.jets.a,uJetB:p.jets.b,uJetBend:{f1:p.jets.bend}},l.velocity.write),l.velocity.swap(),P(w.curl,{uVelocity:l.velocity.read,uTexel:d},l.curl),P(w.vorticity,{uVelocity:l.velocity.read,uCurl:l.curl,uTexel:d,uStrength:s.vort*p.turbulence*(.4+.6*p.activity),uDt:y},l.velocity.write),l.velocity.swap(),P(w.divergence,{uVelocity:l.velocity.read,uTexel:d},l.divergence),P(w.scale,{uSource:l.pressure.read,uScale:.8},l.pressure.write),l.pressure.swap();for(let B=0;B<s.iters;B+=1)P(w.pressure,{uPressure:l.pressure.read,uDivergence:l.divergence,uTexel:d},l.pressure.write),l.pressure.swap();P(w.gradient,{uPressure:l.pressure.read,uVelocity:l.velocity.read,uTexel:d},l.velocity.write),l.velocity.swap(),P(w.dye,{uVelocity:l.velocity.read,uSource:l.dye.read,uWorld:J,uDt:y,uKeep:[Math.exp(-(s.keepD+s.keepIdle*(1-p.activity))*y),Math.exp(-s.keepH*y)],uRate:[s.rateN*p.smoke,s.rateH,s.rateK*p.smoke,s.rateC*p.smoke],uSpread:s.spread,uCol:[s.colSpread,s.colR*p.scale,s.colD,s.colU],uKick:[s.kickNear*p.scale,s.kickW*p.scale,s.kickH*p.scale],uDisperse:s.disperse,uDispV:s.dispV,uCraft:p.craft,uCraftMotion:p.motion,uGap:[p.spacing,s.gap*p.calm],uJetX:{f1:p.jetX},uJetN:p.jetN,uFloor:s.floor,uTime:p.time,uJetA:p.jets.a,uJetB:p.jets.b,uJetBend:{f1:p.jets.bend}},l.dye.write),l.dye.swap();let b=s.blur/2;P(w.blur,{uSource:l.dye.read,uStep:[b/l.dw,0]},l.temp),P(w.blur,{uSource:l.temp,uStep:[0,b/l.dh]},l.soft),t.bindTexture(t.TEXTURE_2D,l.soft.tex),t.generateMipmap(t.TEXTURE_2D)},render:(y,p,s)=>{if(!l)return;let d=Je;t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,y,p),t.disable(t.BLEND),P(w.render,{uDye:l.soft,uWorld:J,uDyeSize:[l.dw,l.dh],uTime:s.time,uLightTheme:s.light?1:0,uSmoke:s.smokeColor,uShade:s.shadeColor,uThrust:s.thrustColor,uLook:[d.alphaK*(.6+.4*s.activity),d.relief,d.shadow,d.alphaLod],uLook2:[d.ambient,d.key,d.wrap,d.ao],uLook3:[d.normalE,d.normalLod,d.fine,d.broad],uCol:[d.colSpread,d.colR*s.scale,d.colD,d.colU],uScale:s.scale,uGamma:d.gamma,uTone:d.tone,uLight2:[d.jetLight,d.emit,d.exposure],uThreshold:d.threshold*(.3+.7*s.activity),uCraft:s.craft,uCraftMotion:s.motion,uJetA:s.jets.a,uJetB:s.jets.b,uJetBend:{f1:s.jets.bend}})},resize:fe,clear:()=>{l&&([l.velocity.read,l.velocity.write,l.pressure.read,l.pressure.write,l.dye.read,l.dye.write,l.soft,l.temp].forEach(y=>{t.bindFramebuffer(t.FRAMEBUFFER,y.fbo),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT)}),t.bindTexture(t.TEXTURE_2D,l.soft.tex),t.generateMipmap(t.TEXTURE_2D))},dispose:()=>{N(),W.forEach(y=>t.deleteProgram(y.p)),t.deleteShader(R),t.deleteVertexArray($)}}}function et({children:t="Take off",onClick:m,buttonProps:R={},theme:W="dark",size:U="medium",radius:w,altitude:$=170,hoverTime:ee=2.4,jets:e=2,thrusters:A=!0,trigger:l="hover",carryCursor:J=!0,ramp:N=!1,rampColor:fe,smoke:G=1,turbulence:de=1,wobble:P=1,thrustColor:_e,smokeColor:Le,buttonColor:ie,textColor:ae,className:y="",style:p}){let s=(0,oe.useRef)(null),d=(0,oe.useRef)(null),b=(0,oe.useRef)(null),B=(0,oe.useRef)(null),V=(0,oe.useRef)(null),K=(0,oe.useRef)(null),ge=(0,oe.useRef)({}),le=W==="light",we=qe[U]||qe.medium,Ue=_e||(le?"#4f8cff":"#8ec5ff"),ke=Le||(le?"#e9ebf0":"#eef1f6"),Te=ie||(le?"#18181b":"#27272a"),je=ae||(le?"#fafafa":"#f5f5f5"),Ae=fe||(le?"#ececf0":"#25222b"),Q=C(Math.round(ue(e,2)),1,X),Ne=Q===1?0:Q===2?.3:.34,Fe=A?Array.from({length:Q},(re,$e)=>Q===1?50:50+Ne*100*(2*$e/(Q-1)-1)):[];return ge.current={size:U,altitude:$,hoverTime:ee,jets:Q,thrusters:!!A,trigger:l,carryCursor:J,ramp:!!N,smoke:G,turbulence:de,wobble:P,thrustColor:Ue,smokeColor:ke,theme:W,onClick:m},(0,oe.useEffect)(()=>{let re=Bt({root:s.current,canvas:d.current,button:b.current,cursor:B.current,ramp:V.current,props:ge});return K.current=re,()=>{K.current=null,re.destroy()}},[]),(0,oe.useEffect)(()=>{K.current&&K.current.refresh()},[U,Q,A,w]),(0,oe.useEffect)(()=>{K.current&&K.current.rehome()},[N]),(0,Z.jsxs)("div",{ref:s,className:`flying-button ${y}`.trim(),"data-theme":W,"data-trigger":N?"click":l,style:{"--fly-bg":Te,"--fly-ink":je,"--fly-glow":Ue,"--fly-ramp":Ae,"--fly-h":`${we.h}px`,"--fly-px":`${we.px}px`,"--fly-fs":`${we.fs}px`,"--fly-scale":we.k,...w!=null?{"--fly-radius":`${ue(w,0)}px`}:{},...p},children:[(0,Z.jsxs)("svg",{ref:V,className:"flying-button__ramp",style:N?void 0:{display:"none"},"aria-hidden":"true",children:[(0,Z.jsx)("path",{className:"flying-button__ramp-body"}),(0,Z.jsx)("path",{className:"flying-button__ramp-edge"})]}),(0,Z.jsx)("canvas",{ref:d,className:"flying-button__smoke","aria-hidden":"true"}),(0,Z.jsxs)("button",{...R,ref:b,type:"button",className:"flying-button__craft",onClick:re=>ge.current.onClick&&ge.current.onClick(re),children:[(0,Z.jsx)("span",{className:"flying-button__face","aria-hidden":"true"}),(0,Z.jsx)("span",{className:"flying-button__label",children:t}),Fe.map(re=>(0,Z.jsx)("span",{className:"flying-button__pod",style:{left:`${re}%`},"aria-hidden":"true"},re))]}),(0,Z.jsx)("svg",{ref:B,className:"flying-button__cursor",viewBox:"0 0 24 34","aria-hidden":"true",children:(0,Z.jsx)("path",{d:"M2.2 2.1v24.6l6.1-5.9 4.1 9.6 4.4-1.9-4.1-9.4h8.6z",fill:"#0a0a0c",stroke:"#fff",strokeWidth:"1.9",strokeLinejoin:"round"})})]})}var ce=ye(Ve(),1);function Ht({host:t,model:m,onOpen:R}){let W=(0,vt.createRoot)(t),U=matchMedia("(hover: hover) and (pointer: fine)"),w=matchMedia("(prefers-reduced-motion: reduce)"),$=m,ee=!1,e=J=>{J.stopPropagation(),R($.projectId)};function A(J=$){if(ee)return;$=J;let N=t.contains(document.activeElement),fe=U.matches&&!w.matches;t.dataset.flightMode=fe?"on":"off";let G={"data-stage-open":"","data-open-project":$.projectId,"aria-label":$.ariaLabel},de=(0,ce.jsxs)(ce.Fragment,{children:[(0,ce.jsx)("span",{children:$.label}),(0,ce.jsx)("svg",{className:"icon small","aria-hidden":"true",children:(0,ce.jsx)("use",{href:"#i-up-right"})})]});(0,mt.flushSync)(()=>W.render(fe?(0,ce.jsx)(et,{buttonProps:G,onClick:e,theme:$.night?"dark":"light",size:"medium",radius:0,altitude:28,hoverTime:1.4,jets:2,carryCursor:!0,ramp:!1,smoke:.45,turbulence:.5,wobble:.25,buttonColor:$.night?"#c9c3b8":"#59636b",textColor:$.night?"#353d44":"#f4f0e8",className:"project-flying-button",children:de}):(0,ce.jsx)("button",{type:"button",...G,className:"primary-button",onClick:e,children:de}))),N&&!t.contains(document.activeElement)&&t.querySelector("button")?.focus({preventScroll:!0})}let l=()=>A();return U.addEventListener?.("change",l),w.addEventListener?.("change",l),A(),{update:A,dispose(){ee||(ee=!0,U.removeEventListener?.("change",l),w.removeEventListener?.("change",l),W.unmount())}}}export{Ht as mountFlyingProjectAction};

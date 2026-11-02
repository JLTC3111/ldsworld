import{a as wt}from"./ui-shared-NOAXHO7I.js";import{a as ro,b as io,c as no,d as Be}from"./ui-shared-OLIMQZCX.js";import{b as te}from"./ui-shared-K3LWH4NE.js";var Ct=te(no(),1),Lt=te(io(),1);var j=te(ro(),1);var Je=te(Be(),1),ao=.32,Ft=9,de=.05,Ie=160,Fe=1.7,Te=.45,uo=2.8,ke=4,Tt=4,be=256,Oe=48,Ye=2e5,co=[-.81,.58,-.02],Mt={forward:[0,1],backward:[0,-1],left:[-1,0],right:[1,0]},lo=["lift","trace","light"],fo={plus:0,dots:1},so=1.25,ze=`
precision highp float;
precision highp int;

uniform float uFrequency;
uniform vec2 uMorph;
uniform sampler2D uSculpt;
uniform float uSculptOn;
uniform vec4 uPulses[${ke}];
uniform vec3 uEye;
uniform vec3 uForward;
uniform vec3 uNear;

uint lattice(ivec2 p) {
  uvec2 q = uvec2(p + 1073741824);
  uint h = q.x * 2654435761u + q.y * 2246822519u;
  h = (h ^ (h >> 15u)) * 739982445u;
  h = (h ^ (h >> 12u)) * 695872825u;
  return h ^ (h >> 15u);
}

float corner(ivec2 c, vec2 f) {
  uint h = lattice(c);
  vec2 g = vec2(float(h & 65535u), float(h >> 16u)) / 32767.5 - 1.0;
  return dot(g, f);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  ivec2 c = ivec2(i);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = corner(c, f);
  float b = corner(c + ivec2(1, 0), f - vec2(1.0, 0.0));
  float d = corner(c + ivec2(0, 1), f - vec2(0.0, 1.0));
  float e = corner(c + ivec2(1, 1), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}

vec2 octave(vec2 p, vec2 shift) {
  return vec2(1.6 * p.x - 1.2 * p.y, 1.2 * p.x + 1.6 * p.y) + shift;
}

float relief(vec2 t) {
  vec2 p = t * uFrequency;
  vec2 w = vec2(noise(p * 0.42 + uMorph), noise(p * 0.42 - uMorph.yx + vec2(5.2, 1.3)));
  p += w * 0.8;
  float n = noise(p) * 0.55;
  p = octave(p, vec2(7.1, 3.7));
  n += noise(p) * 0.15;
  p = octave(p, vec2(1.9, 8.3));
  n += noise(p) * 0.04;
  float s = log(1.0 + exp(7.0 * (3.0 * n + 0.05))) / 7.0;
  return s * s * 1.4 + 0.1 * n;
}

float swell(vec2 t) {
  float lift = 0.0;
  for (int i = 0; i < ${ke}; i++) {
    vec4 p = uPulses[i];
    if (p.w <= 0.0) continue;
    float x = (length(t - p.xy) - p.z) / (0.28 + p.z * 0.05);
    lift += exp(-x * x) * p.w;
  }
  return lift;
}

vec4 sculpted(vec2 t) {
  return uSculptOn > 0.5 ? textureLod(uSculpt, t / ${Oe}.0, 0.0) : vec4(0.0);
}

float settle(vec2 world) {
  float depth = dot(vec3(world.x, 0.0, world.y) - uEye, uForward);
  float x = clamp((depth - uNear.x) / max(uNear.y - uNear.x, 1e-3), 0.0, 1.0);
  return mix(uNear.z, 1.0, x * x * x * (x * (x * 6.0 - 15.0) + 10.0));
}
`,ho=`#version 300 es
${ze}
uniform ivec2 uBase;
uniform float uCell;
uniform float uDetail;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outHeight;

void main() {
  vec2 t = vec2(uBase + ivec2(gl_FragCoord.xy)) * uCell;
  vec4 carved = sculpted(t);
  float ring = swell(t);
  float ground = relief(t) + carved.r + ring * 0.14;
  vec2 dp = t * uFrequency * 5.0 + vec2(13.1, 4.7);
  float fine = noise(dp) * 0.6 + noise(octave(dp, vec2(2.3, 6.1))) * 0.3;
  outField = vec4(carved.g, ring, ground, carved.r);
  outHeight = vec4(ground + uDetail * 0.1 * fine, 0.0, 0.0, 1.0);
}`,mo=i=>`#version 300 es
#define BAKED ${i?1:0}
${ze}
uniform sampler2D uField;
uniform ivec2 uOrigin;
uniform ivec2 uCamCell;
uniform vec2 uCamFrac;
uniform float uCell;
uniform int uStride;
uniform float uHeight;
uniform mat4 uViewProj;
out vec2 vTexel;
out vec2 vTerrain;
out float vDepth;
out float vLift;
out vec3 vNormal;

float ground(vec2 t) {
  return relief(t) + swell(t) * 0.14;
}

void main() {
  ivec2 step = ivec2(gl_VertexID >> 1, gl_InstanceID + (gl_VertexID & 1)) * uStride;
  ivec2 local = uOrigin + step;
  vec2 terrain = vec2(local + uCamCell) * uCell;
  vec2 world = vec2(local) * uCell - uCamFrac;
  float k = settle(world);
#if BAKED
  ivec2 texel = step + 2;
  vec4 c = texelFetch(uField, texel, 0);
  vec4 l = texelFetch(uField, texel - ivec2(1, 0), 0);
  vec4 r = texelFetch(uField, texel + ivec2(1, 0), 0);
  vec4 d = texelFetch(uField, texel - ivec2(0, 1), 0);
  vec4 u = texelFetch(uField, texel + ivec2(0, 1), 0);
  float h = (c.b - c.a) * k + c.a;
  float dx = (l.b - l.a - r.b + r.a) * k + l.a - r.a;
  float dz = (d.b - d.a - u.b + u.a) * k + d.a - u.a;
  vNormal = vec3(dx * uHeight / (2.0 * uCell), 1.0, dz * uHeight / (2.0 * uCell));
  vTexel = vec2(texel) + 0.5;
#else
  float h = ground(terrain) * k;
  float hx = ground(terrain + vec2(0.04, 0.0)) * k;
  float hz = ground(terrain + vec2(0.0, 0.04)) * k;
  vNormal = vec3((h - hx) * uHeight / 0.04, 1.0, (h - hz) * uHeight / 0.04);
  vTexel = vec2(0.0);
#endif
  vec4 clip = uViewProj * vec4(world.x, h * uHeight, world.y, 1.0);
  gl_Position = clip;
  vTerrain = terrain;
  vDepth = clip.w;
  vLift = h * uHeight;
}`,vo=i=>`#version 300 es
#define BAKED ${i?1:0}
${ze}
uniform sampler2D uField;
uniform highp sampler2D uHeightField;
uniform float uDetail;
uniform float uLines;
uniform float uLineWidth;
uniform float uMajor;
uniform vec3 uColor;
uniform float uBrightness;
uniform vec2 uFade;
uniform vec3 uFocus;
uniform vec4 uHeat;
uniform vec4 uLamp;
uniform vec4 uTrace;
uniform vec3 uSun;
uniform float uRefDepth;
uniform float uReveal;
uniform float uLightMode;
uniform float uOpacity;
uniform vec4 uGlitch[3];
uniform float uGlitchSeed;
uniform float uPixel;
in vec2 vTexel;
in vec2 vTerrain;
in float vDepth;
in float vLift;
in vec3 vNormal;
out vec4 outColor;

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float stroke(float dist, float width, float soft, float density, float crowd) {
  float cover = max(0.0, min(min(width, soft), 0.5 * (width + soft) - dist)) / soft;
  return mix(cover, min(width * density, 1.0) * 0.6, crowd);
}

float sampleHeight(vec2 coord, out vec2 slope) {
  vec2 u = coord - 0.5;
  vec2 i = floor(u + 0.5);
  vec2 f = u - i;
  vec3 wx = vec3(0.5 * (0.5 - f.x) * (0.5 - f.x), 0.75 - f.x * f.x, 0.5 * (0.5 + f.x) * (0.5 + f.x));
  vec3 wy = vec3(0.5 * (0.5 - f.y) * (0.5 - f.y), 0.75 - f.y * f.y, 0.5 * (0.5 + f.y) * (0.5 + f.y));
  vec3 dx = vec3(f.x - 0.5, -2.0 * f.x, 0.5 + f.x);
  vec3 dy = vec3(f.y - 0.5, -2.0 * f.y, 0.5 + f.y);
  ivec2 base = ivec2(i) - 1;
  float total = 0.0;
  slope = vec2(0.0);
  for (int y = 0; y < 3; y++) {
    float a = texelFetch(uHeightField, base + ivec2(0, y), 0).r;
    float b = texelFetch(uHeightField, base + ivec2(1, y), 0).r;
    float c = texelFetch(uHeightField, base + ivec2(2, y), 0).r;
    float row = a * wx.x + b * wx.y + c * wx.z;
    total += row * wy[y];
    slope += vec2((a * dx.x + b * dx.y + c * dx.z) * wy[y], row * dy[y]);
  }
  return total;
}

void main() {
  float py = gl_FragCoord.y / uPixel;
  float shift = 0.0;
  float split = 0.0;
  for (int i = 0; i < 3; i++) {
    if (py >= uGlitch[i].x && py < uGlitch[i].y) {
      shift = uGlitch[i].z * uPixel;
      split = uGlitch[i].w * uPixel;
    }
  }
  vec2 spot = vTerrain - dFdx(vTerrain) * shift;
#if BAKED
  vec2 ex = dFdx(vTexel);
  vec2 ey = dFdy(vTexel);
  vec2 coord = vTexel - ex * shift;
  vec2 slope;
  float h = sampleHeight(coord, slope);
  vec4 field = texture(uField, coord / vec2(textureSize(uField, 0)));
  float trail = field.r;
  float ring = field.g;
  float gx = dot(slope, ex) * uLines;
  float gy = dot(slope, ey) * uLines;
#else
  vec2 dp = spot * uFrequency * 5.0 + vec2(13.1, 4.7);
  float ring = swell(spot);
  float h = relief(spot) + ring * 0.14 + uDetail * 0.1 * (noise(dp) * 0.6 + noise(octave(dp, vec2(2.3, 6.1))) * 0.3);
  float trail = 0.0;
  float gx = dFdx(h) * uLines;
  float gy = dFdy(h) * uLines;
#endif

  float lc = h * uLines + 0.5;
  float density = max(sqrt(gx * gx + gy * gy), 1e-5);
  float dist = abs(fract(lc + 0.5) - 0.5) / density;
  float major = uMajor * (1.0 - step(0.5, mod(floor(lc + 0.5), 5.0)));

  vec2 hd = spot - uHeat.xy;
  float heat = exp(-dot(hd, hd) / (uHeat.z * uHeat.z)) * uHeat.w + trail * 0.6;
  float energy = heat + ring;

  float depth = max(vDepth, 0.01);
  float persp = clamp(sqrt(uRefDepth / depth), 0.6, 1.6);
  float width = uLineWidth * persp * (1.0 + 0.6 * major) * (1.0 + 0.45 * min(energy, 1.5));
  float soft = 1.0 + min(uFocus.y * abs(1.0 - uFocus.x / depth), uFocus.z);
  float crowd = smoothstep(0.3, 0.75, density * max(width, soft));
  float cover = stroke(dist, width, soft, density, crowd);
  vec3 cover3 = vec3(cover);
  if (split > 0.0) {
    float offset = split * density;
    cover3.r = stroke(abs(fract(lc + offset + 0.5) - 0.5) / density, width, soft, density, crowd);
    cover3.b = stroke(abs(fract(lc - offset + 0.5) - 0.5) / density, width, soft, density, crowd);
    vec2 block = floor(vec2(gl_FragCoord.x / (uPixel * 26.0), py / 5.0)) + uGlitchSeed * 71.0;
    float drop = fract(sin(dot(block, vec2(12.9898, 78.233))) * 43758.5453);
    cover3 *= drop > 0.82 ? 0.1 : 1.2;
  }

  vec3 normal = normalize(vNormal);
  float sun = clamp(dot(normal, uSun), 0.0, 1.0);
  vec3 toLamp = uLamp.xyz - vec3(vTerrain.x, vLift, vTerrain.y);
  float lampDistance = length(toLamp);
  float lamp = clamp(dot(normal, toLamp / max(lampDistance, 1e-3)), 0.0, 1.0) * uLamp.w / (1.0 + lampDistance * lampDistance * 0.9);
  float level = mix(0.45, 1.05, smoothstep(0.0, 1.1, h)) * mix(0.35, 1.25, sun * sun) * (1.0 + 0.6 * major);
  level += heat * 1.4 + ring * 3.0 + lamp * 1.2;

  float fade = 1.0 - smoother((depth - uFade.x) / max(uFade.y - uFade.x, 1e-3));
  vec3 light = cover3 * level;

  if (uTrace.y > 0.0) {
    float traceWidth = uLineWidth * persp * 1.8;
    float trace = stroke(abs(h - uTrace.x) * uLines / density, traceWidth, soft, density, crowd);
    vec2 td = spot - uTrace.zw;
    light += trace * uTrace.y * mix(0.35, 1.0, exp(-dot(td, td) / 20.0)) * 2.6;
  }
  light *= fade * uBrightness * uReveal;

  if (uLightMode > 0.5) {
    float ink = (1.0 - exp(-max(max(light.r, light.g), light.b) * 1.8)) * 0.92 * uOpacity;
    outColor = vec4(uColor * ink, ink);
    return;
  }

  vec3 color = 1.0 - exp(-uColor * light * 1.8);
  float top = max(max(color.r, color.g), color.b);
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  color = max(color + dither / 255.0 * step(0.002, top), 0.0);
  outColor = vec4(color, max(max(color.r, color.g), color.b)) * uOpacity;
}`,po=`#version 300 es
${ze}
uniform ivec2 uOrigin;
uniform ivec2 uCamCell;
uniform vec2 uCamFrac;
uniform float uSpacing;
uniform int uColumns;
uniform float uHeight;
uniform mat4 uViewProj;
uniform vec2 uView;
uniform float uSize;
uniform float uRefDepth;
uniform vec4 uHeat;
uniform float uTime;
uniform vec4 uGlitch[3];
uniform float uPixel;
out vec2 vCorner;
out float vSize;
out float vGlow;
out float vFrame;
out float vDepth;

void main() {
  ivec2 local = uOrigin + ivec2(gl_InstanceID % uColumns, gl_InstanceID / uColumns);
  ivec2 id = local + uCamCell;
  vec2 terrain = vec2(id) * uSpacing;
  vec2 world = vec2(local) * uSpacing - uCamFrac;
  float ring = swell(terrain);
  float h = (relief(terrain) + ring * 0.14) * settle(world) + sculpted(terrain).r;
  vec4 clip = uViewProj * vec4(world.x, h * uHeight + 0.05, world.y, 1.0);
  uint seed = lattice(id + ivec2(911, 377));
  float a = float(seed & 1023u) / 1023.0;
  float b = float((seed >> 10u) & 1023u) / 1023.0;
  vec2 hd = terrain - uHeat.xy;
  float heat = exp(-dot(hd, hd) / (uHeat.z * uHeat.z)) * uHeat.w;
  float blink = step(0.92, a) * (0.5 + 0.5 * sin(uTime * (1.4 + b * 2.2) + b * 40.0));
  float size = uSize * clamp(sqrt(uRefDepth / max(clip.w, 0.01)), 0.6, 1.3) * (1.0 + 0.4 * heat + 0.35 * blink);
  float frame = max(smoothstep(0.55, 0.95, blink), smoothstep(0.3, 0.8, heat));
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 offset = corner * (size * (frame > 0.001 ? 2.6 : 1.0) + 1.5);
  float py = (clip.y / clip.w * 0.5 + 0.5) * uView.y / uPixel;
  float shift = 0.0;
  for (int i = 0; i < 3; i++) {
    if (py >= uGlitch[i].x && py < uGlitch[i].y) shift = uGlitch[i].z;
  }
  clip.xy += (offset + vec2(shift * uPixel, 0.0)) / uView * 2.0 * clip.w;
  gl_Position = clip;
  vCorner = offset;
  vSize = size;
  vFrame = frame;
  vGlow = 0.5 + 0.4 * b + blink * 0.9 + heat * 1.8 + ring * 3.0;
  vDepth = clip.w;
}`,xo=`#version 300 es
precision highp float;
uniform vec3 uColor;
uniform vec2 uFade;
uniform float uReveal;
uniform float uBrightness;
uniform float uLightMode;
uniform float uOpacity;
uniform float uStyle;
uniform float uPixel;
in vec2 vCorner;
in float vSize;
in float vGlow;
in float vFrame;
in float vDepth;
out vec4 outColor;

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 a = abs(vCorner);
  float cover;
  if (uStyle < 0.5) {
    float thick = max(0.6 * uPixel, 0.5);
    float across = clamp(vSize - a.x + 0.5, 0.0, 1.0) * clamp(thick - a.y + 0.5, 0.0, 1.0);
    float down = clamp(vSize - a.y + 0.5, 0.0, 1.0) * clamp(thick - a.x + 0.5, 0.0, 1.0);
    cover = max(across, down);
  } else {
    cover = clamp(vSize * 0.42 - length(vCorner) + 0.5, 0.0, 1.0);
  }
  if (vFrame > 0.001) {
    float edge = vSize * 2.3;
    float reach = edge * 0.45;
    float line = max(0.5 * uPixel, 0.5);
    float sides = clamp(line - abs(a.x - edge) + 0.5, 0.0, 1.0) * clamp(a.y - edge + reach + 0.5, 0.0, 1.0) * clamp(edge + line - a.y + 0.5, 0.0, 1.0);
    float caps = clamp(line - abs(a.y - edge) + 0.5, 0.0, 1.0) * clamp(a.x - edge + reach + 0.5, 0.0, 1.0) * clamp(edge + line - a.x + 0.5, 0.0, 1.0);
    cover = max(cover, max(sides, caps) * vFrame * 0.8);
  }
  float fade = 1.0 - smoother((vDepth - uFade.x) / max(uFade.y - uFade.x, 1e-3));
  float light = cover * vGlow * fade * fade * uReveal * uBrightness;
  if (uLightMode > 0.5) {
    float ink = (1.0 - exp(-light * 1.8)) * 0.92 * uOpacity;
    outColor = vec4(uColor * ink, ink);
    return;
  }
  vec3 color = 1.0 - exp(-uColor * light * 1.8);
  outColor = vec4(color, max(max(color.r, color.g), color.b)) * uOpacity;
}`,Me=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,go=`#version 300 es
precision highp float;
uniform sampler2D uPrevious;
uniform vec4 uSegment;
uniform vec4 uBrush;
uniform vec4 uBurst;
uniform vec2 uDecay;
out vec4 outColor;

vec2 wrapped(vec2 d) {
  return d - ${Oe}.0 * floor(d / ${Oe}.0 + 0.5);
}

void main() {
  vec4 previous = texelFetch(uPrevious, ivec2(gl_FragCoord.xy), 0);
  vec2 t = gl_FragCoord.xy / ${be}.0 * ${Oe}.0;
  vec2 a = wrapped(t - uSegment.xy);
  vec2 ab = uSegment.zw - uSegment.xy;
  float k = clamp(dot(a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec2 d = a - ab * k;
  float g = exp(-dot(d, d) / (uBrush.x * uBrush.x)) * uBrush.w;
  float height = previous.r * uDecay.x;
  height += (uBrush.y - height) * g * uBrush.z;
  float heat = previous.g * uDecay.y;
  heat += (1.0 - heat) * g * uBrush.z;
  vec2 b = wrapped(t - uBurst.xy);
  height += uBurst.w * exp(-dot(b, b) / (uBurst.z * uBurst.z));
  outColor = vec4(height, heat, 0.0, 1.0);
}`,Eo=`#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTarget;
uniform vec2 uTexel;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec4 color = texture(uSource, uv - uTexel);
  color += texture(uSource, uv + uTexel);
  color += texture(uSource, uv + vec2(uTexel.x, -uTexel.y));
  color += texture(uSource, uv + vec2(-uTexel.x, uTexel.y));
  outColor = min(color * 0.25, vec4(1.0));
}`,yo=`#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTarget;
uniform vec2 uStep;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec4 color = texture(uSource, uv) * 0.181862;
  color += (texture(uSource, uv + uStep * 1.423135) + texture(uSource, uv - uStep * 1.423135)) * 0.284316;
  color += (texture(uSource, uv + uStep * 3.326702) + texture(uSource, uv - uStep * 3.326702)) * 0.106598;
  color += (texture(uSource, uv + uStep * 5.242989) + texture(uSource, uv - uStep * 5.242989)) * 0.018156;
  outColor = color;
}`,wo=`#version 300 es
precision highp float;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform vec2 uView;
uniform float uGlow;
uniform float uLightMode;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  vec4 halo = texture(uBloom0, uv) * 0.4;
  halo += texture(uBloom1, uv) * 0.3;
  halo += texture(uBloom2, uv) * 0.2;
  halo += texture(uBloom3, uv) * 0.1;
  if (uLightMode > 0.5) {
    outColor = halo * uGlow * 0.35;
    return;
  }
  vec3 color = halo.rgb * uGlow * 1.6;
  color = color / (1.0 + color);
  outColor = vec4(color, max(max(color.r, color.g), color.b));
}`,S=(i,s,u)=>Math.min(u,Math.max(s,i)),oe=i=>{let s=S(i,0,1);return s*s*s*(s*(s*6-15)+10)},Fo=(i,s)=>{let u=Math.imul(i+1073741824,2654435761)+Math.imul(s+1073741824,2246822519)>>>0;return u=Math.imul(u^u>>>15,739982445)>>>0,u=Math.imul(u^u>>>12,695872825)>>>0,(u^u>>>15)>>>0},Ne=(i,s,u,c)=>{let d=Fo(i,s);return((d&65535)/32767.5-1)*u+((d>>>16)/32767.5-1)*c},ie=(i,s)=>{let u=Math.floor(i),c=Math.floor(s),d=i-u,v=s-c,C=d*d*d*(d*(d*6-15)+10),G=v*v*v*(v*(v*6-15)+10),N=Ne(u,c,d,v),A=Ne(u+1,c,d-1,v),_=Ne(u,c+1,d,v-1),I=Ne(u+1,c+1,d-1,v-1),V=N+(A-N)*C;return V+(_+(I-_)*C-V)*G},bt=(i,s,u,c,d)=>{let v=i*u,C=s*u,G=ie(v*.42+c,C*.42+d),N=ie(v*.42-d+5.2,C*.42-c+1.3);v+=G*.8,C+=N*.8;let A=ie(v,C)*.55,_=1.6*v-1.2*C+7.1,I=1.2*v+1.6*C+3.7;A+=ie(_,I)*.15,A+=ie(1.6*_-1.2*I+1.9,1.2*_+1.6*I+8.3)*.04;let V=Math.log(1+Math.exp(7*(3*A+.05)))/7;return V*V*1.4+.1*A},To=(i,s,u)=>{let c=i*u*5+13.1,d=s*u*5+4.7;return ie(c,d)*.6+ie(1.6*c-1.2*d+2.3,1.2*c+1.6*d+6.1)*.3},Rt=(i,s,u)=>{let c=i.createShader(s);return c?(i.shaderSource(c,u),i.compileShader(c),i.getShaderParameter(c,i.COMPILE_STATUS)?c:(i.deleteShader(c),null)):null},re=(i,s,u)=>{let c=Rt(i,i.VERTEX_SHADER,s),d=Rt(i,i.FRAGMENT_SHADER,u),v=i.createProgram();if(!c||!d||!v)return null;if(i.attachShader(v,c),i.attachShader(v,d),i.linkProgram(v),i.deleteShader(c),i.deleteShader(d),!i.getProgramParameter(v,i.LINK_STATUS))return i.deleteProgram(v),null;let C={},G=i.getProgramParameter(v,i.ACTIVE_UNIFORMS);for(let N=0;N<G;N++){let A=i.getActiveUniform(v,N);A&&(C[A.name.replace(/\[0\]$/,"")]=i.getUniformLocation(v,A.name))}return{program:v,uniforms:C}},Mo=i=>{let s=String(i||"#ffffff").replace("#","").trim();(s.length===3||s.length===4)&&(s=s.slice(0,3).split("").map(c=>c+c).join(""));let u=parseInt(s.slice(0,6),16);return Number.isNaN(u)?[1,1,1]:[(u>>16&255)/255,(u>>8&255)/255,(u&255)/255]},bo=(i,s)=>{let u=Math.cos(s),c=[Math.sin(i)*u,-Math.sin(s),Math.cos(i)*u],d=[Math.cos(i),0,-Math.sin(i)],v=[c[1]*d[2]-c[2]*d[1],c[2]*d[0]-c[0]*d[2],c[0]*d[1]-c[1]*d[0]];return{f:c,r:d,u:v}},Qe=i=>S(.4877/i,ao,.6),Ro=({eye:i,f:s,r:u,u:c},d,v)=>{let C=1/Qe(d),G=1/(de-Ie),N=[u[0],c[0],-s[0],0,u[1],c[1],-s[1],0,u[2],c[2],-s[2],0,-(u[0]*i[0]+u[1]*i[1]+u[2]*i[2]),-(c[0]*i[0]+c[1]*i[1]+c[2]*i[2]),s[0]*i[0]+s[1]*i[1]+s[2]*i[2],1],A=[C/d,0,0,0,0,C,0,0,0,0,(Ie+de)*G,-1,0,0,2*Ie*de*G,0];for(let _=0;_<4;_++)for(let I=0;I<4;I++){let V=0;for(let ne=0;ne<4;ne++)V+=A[ne*4+I]*N[_*4+ne];v[_*4+I]=V}return v},So=({color:i="#4f7cff",lineCount:s=22,lineWidth:u=1.2,majorLines:c=!0,elevation:d=1,foreground:v=.2,scale:C=1,detail:G=.35,tilt:N=32,speed:A=.25,direction:_="forward",morph:I=.2,glow:V=.6,depthOfField:ne=.4,fog:At=.35,brightness:Pt=1,opacity:_t=1,mouseInteraction:Bt=!0,hoverEffect:et="lift",mouseRadius:Nt=1,mouseStrength:It=.6,trail:Ot=.3,parallax:kt=.5,clickEffect:zt="pulse",markers:Ut="none",glitch:Ht=0,intro:Xt=!0,lightMode:Gt=!1,dpr:Vt,maxCanvasPixels:Zt=1/0,maxFps:qt=60,className:$t="",style:jt})=>{let tt=(0,j.useRef)(null),ot=(0,j.useRef)(null),Ue=(0,j.useRef)(null),[Wt,Kt]=(0,j.useState)(0),rt={color:i,lineCount:S(s,2,80),lineWidth:Math.max(.2,u),majorLines:c,elevation:S(d,0,3),foreground:S(v,0,1),scale:S(C,.2,5),detail:S(G,0,1),tilt:S(N,12,90),speed:A,direction:Mt[_]??Mt.forward,morph:Math.max(0,I),glow:Math.max(0,V),depthOfField:S(ne,0,1),fog:S(At,0,1),brightness:Math.max(0,Pt),opacity:S(_t,0,1),mouseInteraction:Bt,hoverEffect:lo.includes(et)?et:"lift",mouseRadius:Math.max(.1,Nt),mouseStrength:Math.max(0,It),trail:S(Ot,0,1),parallax:S(kt,0,1),clickEffect:zt,markers:fo[Ut]??-1,glitch:S(Ht,0,1),intro:Xt,lightMode:Gt,dpr:Vt,maxCanvasPixels:Zt,maxFps:qt},U=(0,j.useRef)(rt);return U.current=rt,(0,j.useEffect)(()=>{let ae=tt.current,P=ot.current,Yt=Math.min(U.current.dpr||window.devicePixelRatio||1,2),e=P?.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:Yt<1.5,depth:!0,stencil:!1,powerPreference:"low-power"});if(!ae||!P||!e)return;let ve=!!e.getExtension("EXT_color_buffer_float"),Re=re(e,mo(ve),vo(ve)),ue=ve?re(e,Me,ho):null,pe=ve?re(e,Me,go):null,ce=re(e,Me,Eo),J=re(e,Me,yo),Se=re(e,Me,wo),Ce=re(e,po,xo);if(!Re||!ce||!J||!Se||!Ce)return;let it=t=>t.preventDefault(),nt=()=>Kt(t=>t+1);P.addEventListener("webglcontextlost",it),P.addEventListener("webglcontextrestored",nt);let at=e.createVertexArray(),Qt=ve?e.RGBA16F:e.RGBA8,xe=(t,r,n,f)=>{let a=e.createTexture();return e.bindTexture(e.TEXTURE_2D,a),e.texStorage2D(e.TEXTURE_2D,1,n,t,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,f),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,f),a},He=()=>({texture:null,framebuffer:e.createFramebuffer(),depth:null,width:0,height:0}),Xe=(t,r,n,f)=>{t.texture&&t.width===r&&t.height===n||(t.texture&&e.deleteTexture(t.texture),t.texture=xe(r,n,Qt,e.CLAMP_TO_EDGE),t.width=r,t.height=n,e.bindFramebuffer(e.FRAMEBUFFER,t.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t.texture,0),f&&(t.depth||(t.depth=e.createRenderbuffer()),e.bindRenderbuffer(e.RENDERBUFFER,t.depth),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT24,r,n),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,t.depth)))},Le=He(),De=Array.from({length:Tt},()=>[He(),He()]),H=pe?[0,1].map(()=>{let t=xe(be,be,e.RG16F,e.REPEAT),r=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,r),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),{texture:t,framebuffer:r}}):null,ge=xe(1,1,e.RGBA8,e.REPEAT),y={texture:null,heights:null,framebuffer:e.createFramebuffer(),width:0,height:0},le=0,Jt=(t,r)=>{y.texture&&t<=y.width&&r<=y.height||(y.texture&&e.deleteTexture(y.texture),y.heights&&e.deleteTexture(y.heights),y.width=Math.max(t,Math.ceil(y.width*1.25),64),y.height=Math.max(r,Math.ceil(y.height*1.25),64),y.texture=xe(y.width,y.height,e.RGBA16F,e.CLAMP_TO_EDGE),y.heights=xe(y.width,y.height,e.R32F,e.CLAMP_TO_EDGE),e.bindTexture(e.TEXTURE_2D,y.heights),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.bindFramebuffer(e.FRAMEBUFFER,y.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,y.texture,0),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT1,e.TEXTURE_2D,y.heights,0),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]))},Z=(t,r)=>{e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,r)},K=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,Ge=new Float32Array(16),Ee=new Float32Array(ke*4),fe=new Float32Array(12),B={until:0,next:1.5,roll:0,seed:0},Ve=7919,q=()=>(Ve=Ve*16807%2147483647,(Ve-1)/2147483646),W=[],O={x:0,y:0,inside:!1},h={width:1,height:1,ratio:1,cell:.05,cellKey:""},o={intro:U.current.intro&&!K?0:1,rise:1,travelX:0,travelZ:0,morph:0,yaw:0,pitch:0,yawVelocity:0,pitchVelocity:0,presence:0,focus:Ft,hit:null,brushFrom:null,sculptLife:0,burst:null,level:0,trace:0,clock:0,tilt:U.current.tilt,elevation:U.current.elevation,scale:U.current.scale};o.rise=oe(o.intro);let $=0,se=0,he=!0,Ae=0,Ze=()=>{let t=Math.min(o.tilt*Math.PI/180+o.pitch,Math.PI/2-1e-4),r=bo(o.yaw,t),n=o.elevation*Fe*o.rise*.18,f=o.elevation*Fe*o.rise*1.3+.9,a=Math.max(Ft,(f-n)/Math.sin(t));return{...r,distance:a,eye:[-r.f[0]*a,n-r.f[1]*a,-r.f[2]*a]}},qe=(t,r,n)=>{let f=h.width/h.height,a=Qe(f),x=[0,1,2].map(p=>t.f[p]+t.r[p]*r*a*f+t.u[p]*n*a),b=Math.hypot(x[0],x[1],x[2]);return x.map(p=>p/b)},$e=(t,r)=>r[0]*t.f[0]+r[1]*t.f[1]+r[2]*t.f[2],je=(t,r)=>{let n=qe(t,0,r);return n[1]>-.001?1/0:t.eye[1]/-n[1]*$e(t,n)},ut=(t,r)=>[je(t,-1)*.9,t.distance,r.foreground],eo=(t,r,n,f)=>{let a=(n-t.eye[0])*t.f[0]-t.eye[1]*t.f[1]+(f-t.eye[2])*t.f[2];return r[2]+(1-r[2])*oe((a-r[0])/Math.max(r[1]-r[0],.001))},ct=(t,r,n,f)=>{let a=qe(t,n,f),x=o.elevation*Fe*o.rise,b=Te/o.scale,p=ut(t,r),w=E=>{let k=t.eye[0]+a[0]*E,M=t.eye[2]+a[2]*E,ee=bt(o.travelX+k,o.travelZ+M,b,o.morph*.37,o.morph*.23);return t.eye[1]+a[1]*E-ee*x*eo(t,p,k,M)},F=de,D=w(F);for(let E=0;E<200&&F<Ie*.5;E++){let k=F+Math.max(.02,D*.4),M=w(k);if(M<0){let ee=F,z=k;for(let ye=0;ye<10;ye++){let R=(ee+z)*.5;w(R)<0?z=R:ee=R}return{x:o.travelX+t.eye[0]+a[0]*z,y:t.eye[1]+a[1]*z,z:o.travelZ+t.eye[2]+a[2]*z,depth:z*$e(t,a)}}F=k,D=M}return null},to=(t,r,n)=>{let f=o.elevation*Fe*o.rise*1.7+.2+r.mouseStrength,a={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,near:1/0},x=(b,p)=>{let w=t.eye[0]+b[0]*p,F=t.eye[2]+b[2]*p;a.minX=Math.min(a.minX,w),a.maxX=Math.max(a.maxX,w),a.minZ=Math.min(a.minZ,F),a.maxZ=Math.max(a.maxZ,F)};for(let b of[-1.08,0,1.08])for(let p of[-1.08,1.08]){let w=qe(t,b,p),F=Math.max($e(t,w),.001),D=de,E=n*1.05/F;w[1]<-1e-4&&(D=Math.max(de,(t.eye[1]-f)/-w[1]),E=Math.min(E,t.eye[1]/-w[1])),D=Math.min(D,E),x(w,D),x(w,E),a.near=Math.min(a.near,D*F)}return a},lt=(t,r)=>{let n=Math.floor(o.travelX/r),f=Math.floor(o.travelZ/r),a=o.travelX-n*r,x=o.travelZ-f*r,b=Math.floor((t.minX+a)/r)-2,p=Math.floor((t.minZ+x)/r)-2,w=S(Math.ceil((t.maxX+a)/r)+2-b,1,4e3),F=S(Math.ceil((t.maxZ+x)/r)+2-p,1,Math.floor(Ye*1.5/w));return{cell:r,camX:n,camZ:f,fracX:a,fracZ:x,k0:b,m0:p,columns:w,rows:F}},ft=()=>{if(!he||document.hidden)return;let t=U.current,r=Ze();Ro(r,h.width/h.height,Ge);let n=je(r,-1),f=Math.min(je(r,1),r.distance*3.2),a=Math.max(f,n*1.6,r.distance*1.4),x=a+(n*1.8-a)*t.fog,b=x*.7+(n*.7-x*.7)*t.fog,p=to(r,t,x),w=`${h.width}x${h.height}@${h.ratio}|${Math.round(o.tilt/4)}|${Math.round(o.elevation*5)}|${t.fog}`;if(w!==h.cellKey){h.cellKey=w;let g=h.height*h.ratio*.5/Qe(h.width/h.height),L=S(14*Math.max(p.near,.5)/g,.02,.4),T=(p.maxX-p.minX)*(p.maxZ-p.minZ)/(L*L);T>Ye&&(L*=Math.sqrt(T/Ye)),h.cell=L}let F=Mo(t.color),D=o.elevation*Fe*o.rise,E=lt(p,h.cell),k=ut(r,t),M=t.markers>=0?lt(p,so):null,z=(o.hit&&t.mouseInteraction?o.presence:0)*(.35+.5*t.mouseStrength),ye=t.depthOfField*h.height*.016,R=oe(o.intro/.35),X=o.hit?o.hit.x:0,me=o.hit?o.hit.z:0;if(Ee.fill(0),W.forEach((g,L)=>{Ee.set([g.x,g.z,g.age*4.2,Math.exp(-g.age*1.1)*oe(g.age/.08)],L*4)}),e.bindVertexArray(at),ue){let g=E.columns+7,L=E.rows+7;Jt(g,L),e.bindFramebuffer(e.FRAMEBUFFER,y.framebuffer),e.viewport(0,0,g,L),e.useProgram(ue.program);let T=ue.uniforms;Z(0,H?H[le].texture:ge),e.uniform1i(T.uSculpt,0),e.uniform1f(T.uSculptOn,H?1:0),e.uniform1f(T.uFrequency,Te/o.scale),e.uniform2f(T.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(T.uPulses,Ee),e.uniform2i(T.uBase,E.k0-2+E.camX,E.m0-2+E.camZ),e.uniform1f(T.uCell,E.cell),e.uniform1f(T.uDetail,t.detail),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),e.drawArrays(e.TRIANGLES,0,3)}let we=(g,L,T,Q)=>{e.viewport(0,0,L,T),e.useProgram(Re.program);let l=Re.uniforms;if(Z(0,ue?y.texture:ge),e.uniform1i(l.uField,0),Z(1,ue?y.heights:ge),e.uniform1i(l.uHeightField,1),e.uniform1f(l.uFrequency,Te/o.scale),e.uniform2f(l.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(l.uPulses,Ee),e.uniform2i(l.uOrigin,E.k0,E.m0),e.uniform2i(l.uCamCell,E.camX,E.camZ),e.uniform2f(l.uCamFrac,E.fracX,E.fracZ),e.uniform1f(l.uCell,E.cell),e.uniform1i(l.uStride,Q),e.uniform1f(l.uHeight,D),e.uniform3fv(l.uEye,r.eye),e.uniform3fv(l.uForward,r.f),e.uniform3fv(l.uNear,k),e.uniform1f(l.uRefDepth,r.distance),e.uniformMatrix4fv(l.uViewProj,!1,Ge),e.uniform1f(l.uDetail,t.detail),e.uniform1f(l.uLines,t.lineCount),e.uniform1f(l.uLineWidth,t.lineWidth*g),e.uniform1f(l.uMajor,t.majorLines?1:0),e.uniform3fv(l.uColor,F),e.uniform1f(l.uBrightness,t.brightness),e.uniform2f(l.uFade,b,x),e.uniform3f(l.uFocus,o.focus,ye*g,h.height*.03*g),e.uniform4f(l.uHeat,X,me,.9*t.mouseRadius,z),e.uniform4f(l.uLamp,X,o.hit?o.hit.y+1.4:0,me,z),e.uniform4f(l.uTrace,o.level,o.trace,X,me),e.uniform3fv(l.uSun,co),e.uniform1f(l.uReveal,R),e.uniform1f(l.uLightMode,t.lightMode?1:0),e.uniform1f(l.uOpacity,t.opacity),e.uniform4fv(l.uGlitch,fe),e.uniform1f(l.uGlitchSeed,B.seed),e.uniform1f(l.uPixel,g),e.enable(e.DEPTH_TEST),e.depthFunc(e.LESS),e.disable(e.BLEND),e.clearColor(0,0,0,0),e.clearDepth(1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,2*(Math.ceil(E.columns/Q)+1),Math.ceil(E.rows/Q)),M){e.useProgram(Ce.program);let m=Ce.uniforms;Z(2,H?H[le].texture:ge),e.uniform1i(m.uSculpt,2),e.uniform1f(m.uSculptOn,H?1:0),e.uniform1f(m.uFrequency,Te/o.scale),e.uniform2f(m.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(m.uPulses,Ee),e.uniform3fv(m.uEye,r.eye),e.uniform3fv(m.uForward,r.f),e.uniform3fv(m.uNear,k),e.uniform2i(m.uOrigin,M.k0,M.m0),e.uniform2i(m.uCamCell,M.camX,M.camZ),e.uniform2f(m.uCamFrac,M.fracX,M.fracZ),e.uniform1f(m.uSpacing,M.cell),e.uniform1i(m.uColumns,M.columns+1),e.uniform1f(m.uHeight,D),e.uniformMatrix4fv(m.uViewProj,!1,Ge),e.uniform2f(m.uView,L,T),e.uniform1f(m.uSize,4*g),e.uniform1f(m.uRefDepth,r.distance),e.uniform4f(m.uHeat,X,me,1.2*t.mouseRadius,z),e.uniform1f(m.uTime,o.clock),e.uniform4fv(m.uGlitch,fe),e.uniform1f(m.uPixel,g),e.uniform3fv(m.uColor,F),e.uniform2f(m.uFade,b,x),e.uniform1f(m.uReveal,R),e.uniform1f(m.uBrightness,t.brightness),e.uniform1f(m.uLightMode,t.lightMode?1:0),e.uniform1f(m.uOpacity,t.opacity),e.uniform1f(m.uStyle,t.markers),e.depthFunc(e.LEQUAL),e.depthMask(!1),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,(M.columns+1)*(M.rows+1)),e.disable(e.BLEND),e.depthMask(!0)}e.disable(e.DEPTH_TEST)},_e=t.glow>.001;if(_e){let g=Math.min(1,h.ratio),L=Math.max(1,Math.floor(h.width*g/2)),T=Math.max(1,Math.floor(h.height*g/2));Xe(Le,L,T,!0),De.forEach((l,m)=>{let Et=Math.max(1,Math.floor(h.width*g/2**(m+2))),yt=Math.max(1,Math.floor(h.height*g/2**(m+2)));Xe(l[0],Et,yt,!1),Xe(l[1],Et,yt,!1)}),e.bindFramebuffer(e.FRAMEBUFFER,Le.framebuffer),we(.5*g,L,T,2);let Q=Le;De.forEach(([l,m])=>{e.bindFramebuffer(e.FRAMEBUFFER,l.framebuffer),e.viewport(0,0,l.width,l.height),e.useProgram(ce.program),Z(0,Q.texture),e.uniform1i(ce.uniforms.uSource,0),e.uniform2f(ce.uniforms.uTarget,l.width,l.height),e.uniform2f(ce.uniforms.uTexel,1/Q.width,1/Q.height),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(J.program),e.uniform1i(J.uniforms.uSource,0),e.uniform2f(J.uniforms.uTarget,m.width,m.height),e.bindFramebuffer(e.FRAMEBUFFER,m.framebuffer),Z(0,l.texture),e.uniform2f(J.uniforms.uStep,1/l.width,0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,l.framebuffer),Z(0,m.texture),e.uniform2f(J.uniforms.uStep,0,1/m.height),e.drawArrays(e.TRIANGLES,0,3),Q=l})}if(e.bindFramebuffer(e.FRAMEBUFFER,null),we(h.ratio,P.width,P.height,1),_e){e.viewport(0,0,P.width,P.height),e.useProgram(Se.program);let g=Se.uniforms;De.forEach(([L],T)=>{Z(T,L.texture),e.uniform1i(g[`uBloom${T}`],T)}),e.uniform2f(g.uView,P.width,P.height),e.uniform1f(g.uGlow,t.glow*R),e.uniform1f(g.uLightMode,t.lightMode?1:0),e.enable(e.BLEND),t.lightMode?e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA):e.blendFunc(e.ONE,e.ONE),e.drawArrays(e.TRIANGLES,0,3),e.disable(e.BLEND)}for(let g=Tt;g>=0;g--)Z(g,null)},oo=(t,r)=>{if(!H||!pe)return!1;let n=t.mouseInteraction&&t.hoverEffect==="lift"&&o.presence>.001?o.hit:null,f=o.burst;if(!n&&!f&&o.sculptLife<=0)return!1;let a=o.brushFrom||n,x=H[le],b=H[1-le];e.bindFramebuffer(e.FRAMEBUFFER,b.framebuffer),e.viewport(0,0,be,be),e.useProgram(pe.program);let p=pe.uniforms;if(Z(0,x.texture),e.uniform1i(p.uPrevious,0),n&&a?e.uniform4f(p.uSegment,a.x,a.z,n.x,n.z):e.uniform4f(p.uSegment,0,0,0,0),e.uniform4f(p.uBrush,1.1*t.mouseRadius,.9*t.mouseStrength,1-Math.exp(-r*7),n?o.presence:0),f){let F=oe(f.age/.7);f.age+=r;let D=(oe(f.age/.7)-F)*.9*Math.max(t.mouseStrength,.3);e.uniform4f(p.uBurst,f.x,f.z,1.6*t.mouseRadius,D),f.age>=.7&&(o.burst=null)}else e.uniform4f(p.uBurst,0,0,1,0);let w=.25+3*t.trail*t.trail;return e.uniform2f(p.uDecay,Math.exp(-r/w),Math.exp(-r/.7)),e.disable(e.BLEND),e.drawArrays(e.TRIANGLES,0,3),le=1-le,o.brushFrom=n?{x:n.x,z:n.z}:null,n||f?o.sculptLife=w*6:o.sculptLife-=r,!0},st=U.current.dpr,We=()=>{let t=U.current;st=t.dpr,h.width=Math.max(1,ae.clientWidth),h.height=Math.max(1,ae.clientHeight),h.ratio=Math.min(t.dpr||window.devicePixelRatio||1,2,Math.sqrt(Math.max(1,t.maxCanvasPixels)/(h.width*h.height))),P.width=Math.max(1,Math.floor(h.width*h.ratio)),P.height=Math.max(1,Math.floor(h.height*h.ratio)),ft(),Y()},Ke=t=>{if($=0,!he||document.hidden)return;let r=U.current;if(se&&t-se<1e3/Math.max(1,r.maxFps)-.5){$=requestAnimationFrame(Ke);return}r.dpr!==st&&We();let n=se?S((t-se)/1e3,0,1/20):1/60;se=t,!r.intro||K?o.intro=1:o.intro<1&&(o.intro=Math.min(1,o.intro+n/uo)),o.rise=oe(o.intro);let f=K?1:1-Math.exp(-n/.4);o.tilt+=(r.tilt-o.tilt)*f,o.elevation+=(r.elevation-o.elevation)*f,o.scale=r.scale,o.clock+=n;let a=K?0:r.glitch;if(a>0)if(o.clock>=B.next&&o.clock>=B.until&&(B.until=o.clock+.1+q()*.22*(.5+a),B.next=B.until+(9-7.4*a)*(.45+q()*1.1),B.roll=0),o.clock<B.until){if(o.clock>=B.roll){fe.fill(0);let R=1+Math.floor(q()*3);for(let X=0;X<R;X++){let me=3+q()*q()*h.height*.14,we=q()*h.height,_e=(q()-.5)*2*(10+46*a);fe.set([we,we+me,_e,1+q()*3*a],X*4)}B.seed=q(),B.roll=o.clock+.04+q()*.05}}else fe.fill(0);else fe.fill(0);K||(o.travelX+=r.direction[0]*r.speed*.8*n,o.travelZ+=r.direction[1]*r.speed*.8*n,o.morph+=r.morph*.12*n);let x=O.inside&&r.mouseInteraction;o.presence+=((x?1:0)-o.presence)*(1-Math.exp(-n/(x?.18:.45)));let b=O.x/h.width*2-1,p=1-O.y/h.height*2,w=K||!x?0:r.parallax,F=b*w*.09,D=-p*w*.045;o.yawVelocity+=(38*(F-o.yaw)-11*o.yawVelocity)*n,o.pitchVelocity+=(38*(D-o.pitch)-11*o.pitchVelocity)*n,o.yaw+=o.yawVelocity*n,o.pitch+=o.pitchVelocity*n;let E=Ze();x?(o.hit=ct(E,r,b,p),o.hit&&o.brushFrom&&Math.hypot(o.hit.x-o.brushFrom.x,o.hit.z-o.brushFrom.z)>3*r.mouseRadius&&(o.brushFrom=null)):o.presence<.002&&(o.hit=null,o.brushFrom=null);let k=o.hit&&r.mouseInteraction&&r.hoverEffect==="trace"?o.presence:0;if(o.hit){let R=Te/o.scale,X=bt(o.hit.x,o.hit.z,R,o.morph*.37,o.morph*.23)+r.detail*.1*To(o.hit.x,o.hit.z,R);o.level=o.trace<.01?X:o.level+(X-o.level)*(1-Math.exp(-n/.09))}o.trace+=(k-o.trace)*(1-Math.exp(-n/.2));let M=o.hit&&r.depthOfField>0?o.hit.depth:E.distance;o.focus+=(M-o.focus)*(1-Math.exp(-n/.35));for(let R=W.length-1;R>=0;R--)W[R].age+=n,W[R].age>4&&W.splice(R,1);let ee=oo(r,n);ft();let z=Math.abs(r.tilt-o.tilt)>.01||Math.abs(r.elevation-o.elevation)>1e-4||Math.abs(o.yaw-F)>1e-4||Math.abs(o.pitch-D)>1e-4||Math.abs(o.yawVelocity)>1e-4||Math.abs(o.pitchVelocity)>1e-4||Math.abs(M-o.focus)>.001||Math.abs(k-o.trace)>.001;Ae=!K&&(r.speed!==0||r.morph!==0||r.glitch>0||r.markers>=0)||o.intro<1||W.length>0||ee||z||o.presence>.001&&o.presence<.999?0:Ae+n,Ae<.5&&($=requestAnimationFrame(Ke))};function Y(){Ae=0,!$&&he&&!document.hidden&&(se=0,$=requestAnimationFrame(Ke))}let ht=t=>{let r=ae.getBoundingClientRect(),n=t.clientX-r.left,f=t.clientY-r.top;return{x:n,y:f,inside:n>=0&&f>=0&&n<=r.width&&f<=r.height}},mt=t=>{let{x:r,y:n,inside:f}=ht(t),a=O.inside;O.inside=f,f&&(O.x=r,O.y=n),(f||a)&&Y()},dt=t=>{let r=U.current,{x:n,y:f,inside:a}=ht(t);if(!a||(O.x=n,O.y=f,O.inside=!0,Y(),r.glitch>0&&!K&&(B.until=o.clock+.16,B.roll=0),!r.mouseInteraction||r.clickEffect!=="pulse"&&r.clickEffect!=="peak"))return;let x=ct(Ze(),r,n/h.width*2-1,1-f/h.height*2);x&&(r.clickEffect==="peak"&&H?o.burst={x:x.x,z:x.z,age:0}:r.clickEffect==="pulse"&&(W.length>=ke&&W.shift(),W.push({x:x.x,z:x.z,age:0})))},Pe=t=>{t.pointerType==="touch"&&(O.inside=!1,Y())},vt=()=>{O.inside=!1,Y()},pt=()=>{document.hidden?(cancelAnimationFrame($),$=0):Y()},xt=new ResizeObserver(We);xt.observe(ae);let gt=new IntersectionObserver(t=>{he=t.some(r=>r.isIntersecting),he||(cancelAnimationFrame($),$=0),he&&Y()});return gt.observe(ae),window.addEventListener("pointermove",mt,{passive:!0}),window.addEventListener("pointerdown",dt,{passive:!0}),window.addEventListener("pointerup",Pe,{passive:!0}),window.addEventListener("pointercancel",Pe,{passive:!0}),document.documentElement.addEventListener("pointerleave",vt),document.addEventListener("visibilitychange",pt),We(),Ue.current=Y,()=>{cancelAnimationFrame($),Ue.current=null,xt.disconnect(),gt.disconnect(),window.removeEventListener("pointermove",mt),window.removeEventListener("pointerdown",dt),window.removeEventListener("pointerup",Pe),window.removeEventListener("pointercancel",Pe),document.documentElement.removeEventListener("pointerleave",vt),document.removeEventListener("visibilitychange",pt),P.removeEventListener("webglcontextlost",it),P.removeEventListener("webglcontextrestored",nt),[Le,...De.flat()].forEach(t=>{t.texture&&e.deleteTexture(t.texture),t.depth&&e.deleteRenderbuffer(t.depth),e.deleteFramebuffer(t.framebuffer)}),H?.forEach(t=>{e.deleteTexture(t.texture),e.deleteFramebuffer(t.framebuffer)}),e.deleteTexture(ge),e.deleteVertexArray(at),y.texture&&e.deleteTexture(y.texture),y.heights&&e.deleteTexture(y.heights),e.deleteFramebuffer(y.framebuffer),[Re,ue,pe,ce,J,Se,Ce].forEach(t=>t&&e.deleteProgram(t.program)),e.getExtension("WEBGL_lose_context")?.loseContext()}},[Wt]),(0,j.useEffect)(()=>{Ue.current?.()}),(0,Je.jsx)("div",{ref:tt,className:`topography-container ${$t}`.trim(),style:jt,children:(0,Je.jsx)("canvas",{ref:ot,className:"topography-canvas","aria-hidden":"true"})})},St=So;var Dt=te(Be(),1);function Bo(i){let s=(0,Ct.createRoot)(i),u=wt({hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,saveData:navigator.connection?.saveData,coarse:matchMedia("(pointer: coarse)").matches});(0,Lt.flushSync)(()=>s.render((0,Dt.jsx)(St,{color:"#4f7cff",lineCount:22,lineWidth:1.2,elevation:1,foreground:.2,tilt:32,speed:u.lowPower?0:.25,morph:u.lowPower?0:.2,direction:"forward",glow:u.lowPower?0:.6,depthOfField:u.lowPower?0:.4,fog:.35,hoverEffect:"lift",clickEffect:"pulse",dpr:u.lowPower?1:Math.min(devicePixelRatio||1,1.5),maxCanvasPixels:u.lowPower?3e5:6e5,maxFps:30})));let c=i.parentElement.querySelector(".topography-fallback");return c&&(c.hidden=!!i.querySelector("canvas")?.getContext("webgl2")),{dispose(){s.unmount()}}}export{Bo as mountTopography};

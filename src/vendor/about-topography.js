import{b as ee,c as Jt,d as eo,e as to,f as Be}from"./ui-shared-DB6FN6RA.js";var Rt=ee(to(),1),St=ee(eo(),1);var j=ee(Jt(),1);var Qe=ee(Be(),1),oo=.32,yt=9,se=.05,Ie=160,ye=1.7,we=.45,ro=2.8,ke=4,wt=4,Te=256,Oe=48,Ke=2e5,io=[-.81,.58,-.02],Ft={forward:[0,1],backward:[0,-1],left:[-1,0],right:[1,0]},no=["lift","trace","light"],ao={plus:0,dots:1},uo=1.25,ze=`
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
`,co=`#version 300 es
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
}`,lo=i=>`#version 300 es
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
}`,fo=i=>`#version 300 es
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
}`,so=`#version 300 es
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
}`,ho=`#version 300 es
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
}`,Fe=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,mo=`#version 300 es
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
  vec2 t = gl_FragCoord.xy / ${Te}.0 * ${Oe}.0;
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
}`,vo=`#version 300 es
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
}`,po=`#version 300 es
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
}`,xo=`#version 300 es
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
}`,S=(i,f,u)=>Math.min(u,Math.max(f,i)),te=i=>{let f=S(i,0,1);return f*f*f*(f*(f*6-15)+10)},go=(i,f)=>{let u=Math.imul(i+1073741824,2654435761)+Math.imul(f+1073741824,2246822519)>>>0;return u=Math.imul(u^u>>>15,739982445)>>>0,u=Math.imul(u^u>>>12,695872825)>>>0,(u^u>>>15)>>>0},Ne=(i,f,u,c)=>{let h=go(i,f);return((h&65535)/32767.5-1)*u+((h>>>16)/32767.5-1)*c},re=(i,f)=>{let u=Math.floor(i),c=Math.floor(f),h=i-u,d=f-c,C=h*h*h*(h*(h*6-15)+10),V=d*d*d*(d*(d*6-15)+10),I=Ne(u,c,h,d),_=Ne(u+1,c,h-1,d),B=Ne(u,c+1,h,d-1),O=Ne(u+1,c+1,h-1,d-1),Z=I+(_-I)*C;return Z+(B+(O-B)*C-Z)*V},Tt=(i,f,u,c,h)=>{let d=i*u,C=f*u,V=re(d*.42+c,C*.42+h),I=re(d*.42-h+5.2,C*.42-c+1.3);d+=V*.8,C+=I*.8;let _=re(d,C)*.55,B=1.6*d-1.2*C+7.1,O=1.2*d+1.6*C+3.7;_+=re(B,O)*.15,_+=re(1.6*B-1.2*O+1.9,1.2*B+1.6*O+8.3)*.04;let Z=Math.log(1+Math.exp(7*(3*_+.05)))/7;return Z*Z*1.4+.1*_},Eo=(i,f,u)=>{let c=i*u*5+13.1,h=f*u*5+4.7;return re(c,h)*.6+re(1.6*c-1.2*h+2.3,1.2*c+1.6*h+6.1)*.3},Mt=(i,f,u)=>{let c=i.createShader(f);return c?(i.shaderSource(c,u),i.compileShader(c),i.getShaderParameter(c,i.COMPILE_STATUS)?c:(i.deleteShader(c),null)):null},oe=(i,f,u)=>{let c=Mt(i,i.VERTEX_SHADER,f),h=Mt(i,i.FRAGMENT_SHADER,u),d=i.createProgram();if(!c||!h||!d)return null;if(i.attachShader(d,c),i.attachShader(d,h),i.linkProgram(d),i.deleteShader(c),i.deleteShader(h),!i.getProgramParameter(d,i.LINK_STATUS))return i.deleteProgram(d),null;let C={},V=i.getProgramParameter(d,i.ACTIVE_UNIFORMS);for(let I=0;I<V;I++){let _=i.getActiveUniform(d,I);_&&(C[_.name.replace(/\[0\]$/,"")]=i.getUniformLocation(d,_.name))}return{program:d,uniforms:C}},yo=i=>{let f=String(i||"#ffffff").replace("#","").trim();(f.length===3||f.length===4)&&(f=f.slice(0,3).split("").map(c=>c+c).join(""));let u=parseInt(f.slice(0,6),16);return Number.isNaN(u)?[1,1,1]:[(u>>16&255)/255,(u>>8&255)/255,(u&255)/255]},wo=(i,f)=>{let u=Math.cos(f),c=[Math.sin(i)*u,-Math.sin(f),Math.cos(i)*u],h=[Math.cos(i),0,-Math.sin(i)],d=[c[1]*h[2]-c[2]*h[1],c[2]*h[0]-c[0]*h[2],c[0]*h[1]-c[1]*h[0]];return{f:c,r:h,u:d}},Ye=i=>S(.4877/i,oo,.6),Fo=({eye:i,f,r:u,u:c},h,d)=>{let C=1/Ye(h),V=1/(se-Ie),I=[u[0],c[0],-f[0],0,u[1],c[1],-f[1],0,u[2],c[2],-f[2],0,-(u[0]*i[0]+u[1]*i[1]+u[2]*i[2]),-(c[0]*i[0]+c[1]*i[1]+c[2]*i[2]),f[0]*i[0]+f[1]*i[1]+f[2]*i[2],1],_=[C/h,0,0,0,0,C,0,0,0,0,(Ie+se)*V,-1,0,0,2*Ie*se*V,0];for(let B=0;B<4;B++)for(let O=0;O<4;O++){let Z=0;for(let ie=0;ie<4;ie++)Z+=_[ie*4+O]*I[B*4+ie];d[B*4+O]=Z}return d},To=({color:i="#4f7cff",lineCount:f=22,lineWidth:u=1.2,majorLines:c=!0,elevation:h=1,foreground:d=.2,scale:C=1,detail:V=.35,tilt:I=32,speed:_=.25,direction:B="forward",morph:O=.2,glow:Z=.6,depthOfField:ie=.4,fog:Lt=.35,brightness:Dt=1,opacity:At=1,mouseInteraction:_t=!0,hoverEffect:Je="lift",mouseRadius:Pt=1,mouseStrength:Bt=.6,trail:Nt=.3,parallax:It=.5,clickEffect:Ot="pulse",markers:kt="none",glitch:zt=0,intro:Ut=!0,lightMode:Ht=!1,dpr:Xt,className:Gt="",style:Vt})=>{let et=(0,j.useRef)(null),tt=(0,j.useRef)(null),Ue=(0,j.useRef)(null),[Zt,$t]=(0,j.useState)(0),ot={color:i,lineCount:S(f,2,80),lineWidth:Math.max(.2,u),majorLines:c,elevation:S(h,0,3),foreground:S(d,0,1),scale:S(C,.2,5),detail:S(V,0,1),tilt:S(I,12,90),speed:_,direction:Ft[B]??Ft.forward,morph:Math.max(0,O),glow:Math.max(0,Z),depthOfField:S(ie,0,1),fog:S(Lt,0,1),brightness:Math.max(0,Dt),opacity:S(At,0,1),mouseInteraction:_t,hoverEffect:no.includes(Je)?Je:"lift",mouseRadius:Math.max(.1,Pt),mouseStrength:Math.max(0,Bt),trail:S(Nt,0,1),parallax:S(It,0,1),clickEffect:Ot,markers:ao[kt]??-1,glitch:S(zt,0,1),intro:Ut,lightMode:Ht,dpr:Xt},H=(0,j.useRef)(ot);return H.current=ot,(0,j.useEffect)(()=>{let ne=et.current,P=tt.current,qt=Math.min(H.current.dpr||window.devicePixelRatio||1,2),e=P?.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:qt<1.5,depth:!0,stencil:!1,powerPreference:"high-performance"});if(!ne||!P||!e)return;let he=!!e.getExtension("EXT_color_buffer_float"),Me=oe(e,lo(he),fo(he)),ae=he?oe(e,Fe,co):null,me=he?oe(e,Fe,mo):null,ue=oe(e,Fe,vo),Q=oe(e,Fe,po),be=oe(e,Fe,xo),Re=oe(e,so,ho);if(!Me||!ue||!Q||!be||!Re)return;let rt=t=>t.preventDefault(),it=()=>$t(t=>t+1);P.addEventListener("webglcontextlost",rt),P.addEventListener("webglcontextrestored",it);let nt=e.createVertexArray(),jt=he?e.RGBA16F:e.RGBA8,de=(t,r,n,l)=>{let a=e.createTexture();return e.bindTexture(e.TEXTURE_2D,a),e.texStorage2D(e.TEXTURE_2D,1,n,t,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,l),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,l),a},He=()=>({texture:null,framebuffer:e.createFramebuffer(),depth:null,width:0,height:0}),Xe=(t,r,n,l)=>{t.texture&&t.width===r&&t.height===n||(t.texture&&e.deleteTexture(t.texture),t.texture=de(r,n,jt,e.CLAMP_TO_EDGE),t.width=r,t.height=n,e.bindFramebuffer(e.FRAMEBUFFER,t.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t.texture,0),l&&(t.depth||(t.depth=e.createRenderbuffer()),e.bindRenderbuffer(e.RENDERBUFFER,t.depth),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT24,r,n),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,t.depth)))},Se=He(),Ce=Array.from({length:wt},()=>[He(),He()]),X=me?[0,1].map(()=>{let t=de(Te,Te,e.RG16F,e.REPEAT),r=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,r),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),{texture:t,framebuffer:r}}):null,ve=de(1,1,e.RGBA8,e.REPEAT),E={texture:null,heights:null,framebuffer:e.createFramebuffer(),width:0,height:0},ce=0,Wt=(t,r)=>{E.texture&&t<=E.width&&r<=E.height||(E.texture&&e.deleteTexture(E.texture),E.heights&&e.deleteTexture(E.heights),E.width=Math.max(t,Math.ceil(E.width*1.25),64),E.height=Math.max(r,Math.ceil(E.height*1.25),64),E.texture=de(E.width,E.height,e.RGBA16F,e.CLAMP_TO_EDGE),E.heights=de(E.width,E.height,e.R32F,e.CLAMP_TO_EDGE),e.bindTexture(e.TEXTURE_2D,E.heights),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.bindFramebuffer(e.FRAMEBUFFER,E.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,E.texture,0),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT1,e.TEXTURE_2D,E.heights,0),e.drawBuffers([e.COLOR_ATTACHMENT0,e.COLOR_ATTACHMENT1]))},$=(t,r)=>{e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,r)},K=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??!1,Ge=new Float32Array(16),pe=new Float32Array(ke*4),le=new Float32Array(12),N={until:0,next:1.5,roll:0,seed:0},Ve=7919,q=()=>(Ve=Ve*16807%2147483647,(Ve-1)/2147483646),W=[],k={x:0,y:0,inside:!1},m={width:1,height:1,ratio:1,cell:.05,cellKey:""},o={intro:H.current.intro&&!K?0:1,rise:1,travelX:0,travelZ:0,morph:0,yaw:0,pitch:0,yawVelocity:0,pitchVelocity:0,presence:0,focus:yt,hit:null,brushFrom:null,sculptLife:0,burst:null,level:0,trace:0,clock:0,tilt:H.current.tilt,elevation:H.current.elevation,scale:H.current.scale};o.rise=te(o.intro);let xe=0,Le=0,De=!0,Ae=0,Ze=()=>{let t=Math.min(o.tilt*Math.PI/180+o.pitch,Math.PI/2-1e-4),r=wo(o.yaw,t),n=o.elevation*ye*o.rise*.18,l=o.elevation*ye*o.rise*1.3+.9,a=Math.max(yt,(l-n)/Math.sin(t));return{...r,distance:a,eye:[-r.f[0]*a,n-r.f[1]*a,-r.f[2]*a]}},$e=(t,r,n)=>{let l=m.width/m.height,a=Ye(l),p=[0,1,2].map(v=>t.f[v]+t.r[v]*r*a*l+t.u[v]*n*a),b=Math.hypot(p[0],p[1],p[2]);return p.map(v=>v/b)},qe=(t,r)=>r[0]*t.f[0]+r[1]*t.f[1]+r[2]*t.f[2],je=(t,r)=>{let n=$e(t,0,r);return n[1]>-.001?1/0:t.eye[1]/-n[1]*qe(t,n)},at=(t,r)=>[je(t,-1)*.9,t.distance,r.foreground],Kt=(t,r,n,l)=>{let a=(n-t.eye[0])*t.f[0]-t.eye[1]*t.f[1]+(l-t.eye[2])*t.f[2];return r[2]+(1-r[2])*te((a-r[0])/Math.max(r[1]-r[0],.001))},ut=(t,r,n,l)=>{let a=$e(t,n,l),p=o.elevation*ye*o.rise,b=we/o.scale,v=at(t,r),w=g=>{let z=t.eye[0]+a[0]*g,M=t.eye[2]+a[2]*g,J=Tt(o.travelX+z,o.travelZ+M,b,o.morph*.37,o.morph*.23);return t.eye[1]+a[1]*g-J*p*Kt(t,v,z,M)},T=se,D=w(T);for(let g=0;g<200&&T<Ie*.5;g++){let z=T+Math.max(.02,D*.4),M=w(z);if(M<0){let J=T,U=z;for(let ge=0;ge<10;ge++){let R=(J+U)*.5;w(R)<0?U=R:J=R}return{x:o.travelX+t.eye[0]+a[0]*U,y:t.eye[1]+a[1]*U,z:o.travelZ+t.eye[2]+a[2]*U,depth:U*qe(t,a)}}T=z,D=M}return null},Yt=(t,r,n)=>{let l=o.elevation*ye*o.rise*1.7+.2+r.mouseStrength,a={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,near:1/0},p=(b,v)=>{let w=t.eye[0]+b[0]*v,T=t.eye[2]+b[2]*v;a.minX=Math.min(a.minX,w),a.maxX=Math.max(a.maxX,w),a.minZ=Math.min(a.minZ,T),a.maxZ=Math.max(a.maxZ,T)};for(let b of[-1.08,0,1.08])for(let v of[-1.08,1.08]){let w=$e(t,b,v),T=Math.max(qe(t,w),.001),D=se,g=n*1.05/T;w[1]<-1e-4&&(D=Math.max(se,(t.eye[1]-l)/-w[1]),g=Math.min(g,t.eye[1]/-w[1])),D=Math.min(D,g),p(w,D),p(w,g),a.near=Math.min(a.near,D*T)}return a},ct=(t,r)=>{let n=Math.floor(o.travelX/r),l=Math.floor(o.travelZ/r),a=o.travelX-n*r,p=o.travelZ-l*r,b=Math.floor((t.minX+a)/r)-2,v=Math.floor((t.minZ+p)/r)-2,w=S(Math.ceil((t.maxX+a)/r)+2-b,1,4e3),T=S(Math.ceil((t.maxZ+p)/r)+2-v,1,Math.floor(Ke*1.5/w));return{cell:r,camX:n,camZ:l,fracX:a,fracZ:p,k0:b,m0:v,columns:w,rows:T}},lt=()=>{let t=H.current,r=Ze();Fo(r,m.width/m.height,Ge);let n=je(r,-1),l=Math.min(je(r,1),r.distance*3.2),a=Math.max(l,n*1.6,r.distance*1.4),p=a+(n*1.8-a)*t.fog,b=p*.7+(n*.7-p*.7)*t.fog,v=Yt(r,t,p),w=`${m.width}x${m.height}@${m.ratio}|${Math.round(o.tilt/4)}|${Math.round(o.elevation*5)}|${t.fog}`;if(w!==m.cellKey){m.cellKey=w;let y=m.height*m.ratio*.5/Ye(m.width/m.height),L=S(14*Math.max(v.near,.5)/y,.02,.4),F=(v.maxX-v.minX)*(v.maxZ-v.minZ)/(L*L);F>Ke&&(L*=Math.sqrt(F/Ke)),m.cell=L}let T=yo(t.color),D=o.elevation*ye*o.rise,g=ct(v,m.cell),z=at(r,t),M=t.markers>=0?ct(v,uo):null,U=(o.hit&&t.mouseInteraction?o.presence:0)*(.35+.5*t.mouseStrength),ge=t.depthOfField*m.height*.016,R=te(o.intro/.35),G=o.hit?o.hit.x:0,fe=o.hit?o.hit.z:0;if(pe.fill(0),W.forEach((y,L)=>{pe.set([y.x,y.z,y.age*4.2,Math.exp(-y.age*1.1)*te(y.age/.08)],L*4)}),e.bindVertexArray(nt),ae){let y=g.columns+7,L=g.rows+7;Wt(y,L),e.bindFramebuffer(e.FRAMEBUFFER,E.framebuffer),e.viewport(0,0,y,L),e.useProgram(ae.program);let F=ae.uniforms;$(0,X?X[ce].texture:ve),e.uniform1i(F.uSculpt,0),e.uniform1f(F.uSculptOn,X?1:0),e.uniform1f(F.uFrequency,we/o.scale),e.uniform2f(F.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(F.uPulses,pe),e.uniform2i(F.uBase,g.k0-2+g.camX,g.m0-2+g.camZ),e.uniform1f(F.uCell,g.cell),e.uniform1f(F.uDetail,t.detail),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),e.drawArrays(e.TRIANGLES,0,3)}let Ee=(y,L,F,A)=>{e.viewport(0,0,L,F),e.useProgram(Me.program);let s=Me.uniforms;if($(0,ae?E.texture:ve),e.uniform1i(s.uField,0),$(1,ae?E.heights:ve),e.uniform1i(s.uHeightField,1),e.uniform1f(s.uFrequency,we/o.scale),e.uniform2f(s.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(s.uPulses,pe),e.uniform2i(s.uOrigin,g.k0,g.m0),e.uniform2i(s.uCamCell,g.camX,g.camZ),e.uniform2f(s.uCamFrac,g.fracX,g.fracZ),e.uniform1f(s.uCell,g.cell),e.uniform1i(s.uStride,A),e.uniform1f(s.uHeight,D),e.uniform3fv(s.uEye,r.eye),e.uniform3fv(s.uForward,r.f),e.uniform3fv(s.uNear,z),e.uniform1f(s.uRefDepth,r.distance),e.uniformMatrix4fv(s.uViewProj,!1,Ge),e.uniform1f(s.uDetail,t.detail),e.uniform1f(s.uLines,t.lineCount),e.uniform1f(s.uLineWidth,t.lineWidth*y),e.uniform1f(s.uMajor,t.majorLines?1:0),e.uniform3fv(s.uColor,T),e.uniform1f(s.uBrightness,t.brightness),e.uniform2f(s.uFade,b,p),e.uniform3f(s.uFocus,o.focus,ge*y,m.height*.03*y),e.uniform4f(s.uHeat,G,fe,.9*t.mouseRadius,U),e.uniform4f(s.uLamp,G,o.hit?o.hit.y+1.4:0,fe,U),e.uniform4f(s.uTrace,o.level,o.trace,G,fe),e.uniform3fv(s.uSun,io),e.uniform1f(s.uReveal,R),e.uniform1f(s.uLightMode,t.lightMode?1:0),e.uniform1f(s.uOpacity,t.opacity),e.uniform4fv(s.uGlitch,le),e.uniform1f(s.uGlitchSeed,N.seed),e.uniform1f(s.uPixel,y),e.enable(e.DEPTH_TEST),e.depthFunc(e.LESS),e.disable(e.BLEND),e.clearColor(0,0,0,0),e.clearDepth(1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,2*(Math.ceil(g.columns/A)+1),Math.ceil(g.rows/A)),M){e.useProgram(Re.program);let x=Re.uniforms;$(2,X?X[ce].texture:ve),e.uniform1i(x.uSculpt,2),e.uniform1f(x.uSculptOn,X?1:0),e.uniform1f(x.uFrequency,we/o.scale),e.uniform2f(x.uMorph,o.morph*.37,o.morph*.23),e.uniform4fv(x.uPulses,pe),e.uniform3fv(x.uEye,r.eye),e.uniform3fv(x.uForward,r.f),e.uniform3fv(x.uNear,z),e.uniform2i(x.uOrigin,M.k0,M.m0),e.uniform2i(x.uCamCell,M.camX,M.camZ),e.uniform2f(x.uCamFrac,M.fracX,M.fracZ),e.uniform1f(x.uSpacing,M.cell),e.uniform1i(x.uColumns,M.columns+1),e.uniform1f(x.uHeight,D),e.uniformMatrix4fv(x.uViewProj,!1,Ge),e.uniform2f(x.uView,L,F),e.uniform1f(x.uSize,4*y),e.uniform1f(x.uRefDepth,r.distance),e.uniform4f(x.uHeat,G,fe,1.2*t.mouseRadius,U),e.uniform1f(x.uTime,o.clock),e.uniform4fv(x.uGlitch,le),e.uniform1f(x.uPixel,y),e.uniform3fv(x.uColor,T),e.uniform2f(x.uFade,b,p),e.uniform1f(x.uReveal,R),e.uniform1f(x.uBrightness,t.brightness),e.uniform1f(x.uLightMode,t.lightMode?1:0),e.uniform1f(x.uOpacity,t.opacity),e.uniform1f(x.uStyle,t.markers),e.depthFunc(e.LEQUAL),e.depthMask(!1),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,(M.columns+1)*(M.rows+1)),e.disable(e.BLEND),e.depthMask(!0)}e.disable(e.DEPTH_TEST)},Pe=t.glow>.001;if(Pe){let y=Math.max(1,Math.round(m.width/2)),L=Math.max(1,Math.round(m.height/2));Xe(Se,y,L,!0),Ce.forEach((A,s)=>{let x=Math.max(1,Math.round(m.width/2**(s+2))),Et=Math.max(1,Math.round(m.height/2**(s+2)));Xe(A[0],x,Et,!1),Xe(A[1],x,Et,!1)}),e.bindFramebuffer(e.FRAMEBUFFER,Se.framebuffer),Ee(.5,y,L,2);let F=Se;Ce.forEach(([A,s])=>{e.bindFramebuffer(e.FRAMEBUFFER,A.framebuffer),e.viewport(0,0,A.width,A.height),e.useProgram(ue.program),$(0,F.texture),e.uniform1i(ue.uniforms.uSource,0),e.uniform2f(ue.uniforms.uTarget,A.width,A.height),e.uniform2f(ue.uniforms.uTexel,1/F.width,1/F.height),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(Q.program),e.uniform1i(Q.uniforms.uSource,0),e.uniform2f(Q.uniforms.uTarget,s.width,s.height),e.bindFramebuffer(e.FRAMEBUFFER,s.framebuffer),$(0,A.texture),e.uniform2f(Q.uniforms.uStep,1/A.width,0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,A.framebuffer),$(0,s.texture),e.uniform2f(Q.uniforms.uStep,0,1/s.height),e.drawArrays(e.TRIANGLES,0,3),F=A})}if(e.bindFramebuffer(e.FRAMEBUFFER,null),Ee(m.ratio,P.width,P.height,1),Pe){e.viewport(0,0,P.width,P.height),e.useProgram(be.program);let y=be.uniforms;Ce.forEach(([L],F)=>{$(F,L.texture),e.uniform1i(y[`uBloom${F}`],F)}),e.uniform2f(y.uView,P.width,P.height),e.uniform1f(y.uGlow,t.glow*R),e.uniform1f(y.uLightMode,t.lightMode?1:0),e.enable(e.BLEND),t.lightMode?e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA):e.blendFunc(e.ONE,e.ONE),e.drawArrays(e.TRIANGLES,0,3),e.disable(e.BLEND)}for(let y=wt;y>=0;y--)$(y,null)},Qt=(t,r)=>{if(!X||!me)return!1;let n=t.mouseInteraction&&t.hoverEffect==="lift"&&o.presence>.001?o.hit:null,l=o.burst;if(!n&&!l&&o.sculptLife<=0)return!1;let a=o.brushFrom||n,p=X[ce],b=X[1-ce];e.bindFramebuffer(e.FRAMEBUFFER,b.framebuffer),e.viewport(0,0,Te,Te),e.useProgram(me.program);let v=me.uniforms;if($(0,p.texture),e.uniform1i(v.uPrevious,0),n&&a?e.uniform4f(v.uSegment,a.x,a.z,n.x,n.z):e.uniform4f(v.uSegment,0,0,0,0),e.uniform4f(v.uBrush,1.1*t.mouseRadius,.9*t.mouseStrength,1-Math.exp(-r*7),n?o.presence:0),l){let T=te(l.age/.7);l.age+=r;let D=(te(l.age/.7)-T)*.9*Math.max(t.mouseStrength,.3);e.uniform4f(v.uBurst,l.x,l.z,1.6*t.mouseRadius,D),l.age>=.7&&(o.burst=null)}else e.uniform4f(v.uBurst,0,0,1,0);let w=.25+3*t.trail*t.trail;return e.uniform2f(v.uDecay,Math.exp(-r/w),Math.exp(-r/.7)),e.disable(e.BLEND),e.drawArrays(e.TRIANGLES,0,3),ce=1-ce,o.brushFrom=n?{x:n.x,z:n.z}:null,n||l?o.sculptLife=w*6:o.sculptLife-=r,!0},ft=H.current.dpr,We=()=>{let t=H.current;ft=t.dpr,m.width=Math.max(1,ne.clientWidth),m.height=Math.max(1,ne.clientHeight),m.ratio=Math.min(t.dpr||window.devicePixelRatio||1,2),P.width=Math.max(1,Math.round(m.width*m.ratio)),P.height=Math.max(1,Math.round(m.height*m.ratio)),lt(),Y()},st=t=>{if(xe=0,!De||document.hidden)return;let r=H.current;r.dpr!==ft&&We();let n=Le?S((t-Le)/1e3,0,1/20):1/60;Le=t,!r.intro||K?o.intro=1:o.intro<1&&(o.intro=Math.min(1,o.intro+n/ro)),o.rise=te(o.intro);let l=K?1:1-Math.exp(-n/.4);o.tilt+=(r.tilt-o.tilt)*l,o.elevation+=(r.elevation-o.elevation)*l,o.scale=r.scale,o.clock+=n;let a=K?0:r.glitch;if(a>0)if(o.clock>=N.next&&o.clock>=N.until&&(N.until=o.clock+.1+q()*.22*(.5+a),N.next=N.until+(9-7.4*a)*(.45+q()*1.1),N.roll=0),o.clock<N.until){if(o.clock>=N.roll){le.fill(0);let R=1+Math.floor(q()*3);for(let G=0;G<R;G++){let fe=3+q()*q()*m.height*.14,Ee=q()*m.height,Pe=(q()-.5)*2*(10+46*a);le.set([Ee,Ee+fe,Pe,1+q()*3*a],G*4)}N.seed=q(),N.roll=o.clock+.04+q()*.05}}else le.fill(0);else le.fill(0);K||(o.travelX+=r.direction[0]*r.speed*.8*n,o.travelZ+=r.direction[1]*r.speed*.8*n,o.morph+=r.morph*.12*n);let p=k.inside&&r.mouseInteraction;o.presence+=((p?1:0)-o.presence)*(1-Math.exp(-n/(p?.18:.45)));let b=k.x/m.width*2-1,v=1-k.y/m.height*2,w=K||!p?0:r.parallax,T=b*w*.09,D=-v*w*.045;o.yawVelocity+=(38*(T-o.yaw)-11*o.yawVelocity)*n,o.pitchVelocity+=(38*(D-o.pitch)-11*o.pitchVelocity)*n,o.yaw+=o.yawVelocity*n,o.pitch+=o.pitchVelocity*n;let g=Ze();p?(o.hit=ut(g,r,b,v),o.hit&&o.brushFrom&&Math.hypot(o.hit.x-o.brushFrom.x,o.hit.z-o.brushFrom.z)>3*r.mouseRadius&&(o.brushFrom=null)):o.presence<.002&&(o.hit=null,o.brushFrom=null);let z=o.hit&&r.mouseInteraction&&r.hoverEffect==="trace"?o.presence:0;if(o.hit){let R=we/o.scale,G=Tt(o.hit.x,o.hit.z,R,o.morph*.37,o.morph*.23)+r.detail*.1*Eo(o.hit.x,o.hit.z,R);o.level=o.trace<.01?G:o.level+(G-o.level)*(1-Math.exp(-n/.09))}o.trace+=(z-o.trace)*(1-Math.exp(-n/.2));let M=o.hit&&r.depthOfField>0?o.hit.depth:g.distance;o.focus+=(M-o.focus)*(1-Math.exp(-n/.35));for(let R=W.length-1;R>=0;R--)W[R].age+=n,W[R].age>4&&W.splice(R,1);let J=Qt(r,n);lt();let U=Math.abs(r.tilt-o.tilt)>.01||Math.abs(r.elevation-o.elevation)>1e-4||Math.abs(o.yaw-T)>1e-4||Math.abs(o.pitch-D)>1e-4||Math.abs(o.yawVelocity)>1e-4||Math.abs(o.pitchVelocity)>1e-4||Math.abs(M-o.focus)>.001||Math.abs(z-o.trace)>.001;Ae=!K&&(r.speed!==0||r.morph!==0||r.glitch>0||r.markers>=0)||o.intro<1||W.length>0||J||U||o.presence>.001&&o.presence<.999?0:Ae+n,Ae<.5&&(xe=requestAnimationFrame(st))};function Y(){Ae=0,!xe&&De&&!document.hidden&&(Le=0,xe=requestAnimationFrame(st))}let ht=t=>{let r=ne.getBoundingClientRect(),n=t.clientX-r.left,l=t.clientY-r.top;return{x:n,y:l,inside:n>=0&&l>=0&&n<=r.width&&l<=r.height}},mt=t=>{let{x:r,y:n,inside:l}=ht(t),a=k.inside;k.inside=l,l&&(k.x=r,k.y=n),(l||a)&&Y()},dt=t=>{let r=H.current,{x:n,y:l,inside:a}=ht(t);if(!a||(k.x=n,k.y=l,k.inside=!0,Y(),r.glitch>0&&!K&&(N.until=o.clock+.16,N.roll=0),!r.mouseInteraction||r.clickEffect!=="pulse"&&r.clickEffect!=="peak"))return;let p=ut(Ze(),r,n/m.width*2-1,1-l/m.height*2);p&&(r.clickEffect==="peak"&&X?o.burst={x:p.x,z:p.z,age:0}:r.clickEffect==="pulse"&&(W.length>=ke&&W.shift(),W.push({x:p.x,z:p.z,age:0})))},_e=t=>{t.pointerType==="touch"&&(k.inside=!1,Y())},vt=()=>{k.inside=!1,Y()},pt=()=>Y(),xt=new ResizeObserver(We);xt.observe(ne);let gt=new IntersectionObserver(t=>{De=t.some(r=>r.isIntersecting),De&&Y()});return gt.observe(ne),window.addEventListener("pointermove",mt,{passive:!0}),window.addEventListener("pointerdown",dt,{passive:!0}),window.addEventListener("pointerup",_e,{passive:!0}),window.addEventListener("pointercancel",_e,{passive:!0}),document.documentElement.addEventListener("pointerleave",vt),document.addEventListener("visibilitychange",pt),We(),Ue.current=Y,()=>{cancelAnimationFrame(xe),Ue.current=null,xt.disconnect(),gt.disconnect(),window.removeEventListener("pointermove",mt),window.removeEventListener("pointerdown",dt),window.removeEventListener("pointerup",_e),window.removeEventListener("pointercancel",_e),document.documentElement.removeEventListener("pointerleave",vt),document.removeEventListener("visibilitychange",pt),P.removeEventListener("webglcontextlost",rt),P.removeEventListener("webglcontextrestored",it),[Se,...Ce.flat()].forEach(t=>{t.texture&&e.deleteTexture(t.texture),t.depth&&e.deleteRenderbuffer(t.depth),e.deleteFramebuffer(t.framebuffer)}),X?.forEach(t=>{e.deleteTexture(t.texture),e.deleteFramebuffer(t.framebuffer)}),e.deleteTexture(ve),e.deleteVertexArray(nt),E.texture&&e.deleteTexture(E.texture),E.heights&&e.deleteTexture(E.heights),e.deleteFramebuffer(E.framebuffer),[Me,ae,me,ue,Q,be,Re].forEach(t=>t&&e.deleteProgram(t.program)),e.getExtension("WEBGL_lose_context")?.loseContext()}},[Zt]),(0,j.useEffect)(()=>{Ue.current?.()}),(0,Qe.jsx)("div",{ref:et,className:`topography-container ${Gt}`.trim(),style:Vt,children:(0,Qe.jsx)("canvas",{ref:tt,className:"topography-canvas","aria-hidden":"true"})})},bt=To;var Ct=ee(Be(),1);function Lo(i){let f=(0,Rt.createRoot)(i);(0,St.flushSync)(()=>f.render((0,Ct.jsx)(bt,{color:"#4f7cff",lineCount:22,lineWidth:1.2,elevation:1,foreground:.2,tilt:32,speed:.25,direction:"forward",glow:.6,depthOfField:.4,fog:.35,hoverEffect:"lift",clickEffect:"pulse"})));let u=i.parentElement.querySelector(".topography-fallback");return u&&(u.hidden=!!i.querySelector("canvas")?.getContext("webgl2")),{dispose(){f.unmount()}}}export{Lo as mountTopography};

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Exercise the real simulation without requiring a GPU or exporting a test-only API.
const component = new URL('../components/react-bits/FlyingButton.jsx', import.meta.url);
const bundle = await build({
  stdin: {
    contents: `${await readFile(component, 'utf8')}\nexport { createSim as testCreateSim };`,
    resolveDir: fileURLToPath(new URL('.', component)), loader: 'jsx'
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' }
});
const { testCreateSim, FLYING_SMOKE_BUDGET: budget } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

function recordingGL() {
  const live = { textures: new Set(), framebuffers: new Set(), programs: new Set(), shaders: new Set(), vaos: new Set() };
  const draws = [], storage = [];
  let active, mipmaps = 0;
  const gl = {};
  for (const name of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ACTIVE_UNIFORMS','TEXTURE_2D','TEXTURE0','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR_MIPMAP_LINEAR','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','FRAMEBUFFER','COLOR_ATTACHMENT0','COLOR_BUFFER_BIT','RG16F','R16F','BLEND','TRIANGLES']) gl[name] = Object.keys(gl).length + 1;
  for (const [type, collection] of [['Texture','textures'],['Framebuffer','framebuffers'],['Program','programs'],['Shader','shaders'],['VertexArray','vaos']]) {
    gl[`create${type}`] = () => { const resource = {}; live[collection].add(resource); return resource; };
    gl[`delete${type}`] = resource => assert.ok(live[collection].delete(resource), `Release owned ${type} exactly once`);
  }
  Object.assign(gl, {
    shaderSource(shader, source) { shader.source = source; }, compileShader() {}, getShaderParameter: () => true,
    attachShader(program, shader) { (program.shaders ??= []).push(shader); },
    linkProgram(program) {
      program.source = program.shaders.map(shader => shader.source).join('\n');
      program.uniforms = [...new Set([...program.source.matchAll(/uniform\s+\w+\s+(\w+)/g)].map(match => match[1]))];
    },
    getProgramParameter: (program, parameter) => parameter === gl.ACTIVE_UNIFORMS ? program.uniforms.length : true,
    getActiveUniform: (program, index) => ({ name: program.uniforms[index] }), getUniformLocation: (_, name) => name,
    useProgram(program) { active = program; active.values = {}; },
    drawArrays() { draws.push({ source: active.source, values: { ...active.values } }); },
    texStorage2D(...args) { storage.push(args); }, generateMipmap() { mipmaps++; }
  });
  for (const name of ['uniform1f','uniform1i','uniform1fv','uniform2fv','uniform3fv','uniform4fv']) gl[name] = (key, value) => { active.values[key] = value; };
  for (const name of ['bindTexture','texParameteri','bindFramebuffer','framebufferTexture2D','viewport','clearColor','clear','activeTexture','bindVertexArray','disable']) gl[name] = () => {};
  return { gl, live, draws, storage, get mipmaps() { return mipmaps; } };
}

const options = {
  jets: { a: new Float32Array(16), b: new Float32Array(16), bend: new Float32Array(4) },
  craft: [200, 200, 90, 22], motion: [0, 0, 0, 0], scale: 1, activity: 1,
  jetX: new Float32Array(4), jetN: 2, spacing: 100, wind: 1, time: 1,
  smoke: .6, turbulence: .5, calm: 1, light: true,
  smokeColor: [.62, .68, .73], shadeColor: [.4, .45, .5], thrustColor: [1, 1, 1]
};

test('smoke uses fewer passes while retaining the soft density field and lighting', () => {
  const f = recordingGL(), sim = testCreateSim(f.gl, .5);
  try {
    sim.resize(400, 772);
    sim.step(1 / 30, options);
    sim.render(400, 772, options);
    assert.equal(f.draws.length, 23, 'Down from 39 passes per simulated/rendered smoke frame');
    assert.equal(f.draws.filter(draw => draw.source.includes('uniform sampler2D uDivergence;')).length, 12);
    const blur = f.draws.filter(draw => draw.source.includes('0.2270270'));
    assert.equal(blur.length, 2, 'Retain separable Gaussian filtering');
    assert.ok(blur[0].values.uStep[0] > 0 && blur[0].values.uStep[1] === 0);
    assert.ok(blur[1].values.uStep[0] === 0 && blur[1].values.uStep[1] > 0);
    assert.equal(f.mipmaps, 1, 'Retain filtered density mipmaps for smooth smoke shading');
    assert.equal(f.draws.filter(draw => draw.source.includes('uniform float uStrength;')).length, 1, 'Retain curling motion');
    const render = f.draws.at(-1);
    assert.match(render.source, /for \(int i = 0; i < 5; i\+\+\)/);
    assert.ok(render.values.uLook3[2] > 0 && render.values.uLook3[3] > 0, 'Keep fine and broad surface detail');
    const reach = (count, step, growth) => step * (growth ** count - 1) / (growth - 1);
    const oldReach = reach(9, 3, 1.4), newReach = reach(budget.shadowSteps, budget.shadowStep, budget.shadowGrowth);
    assert.ok(Math.abs(newReach - oldReach) / oldReach < .02, 'Fewer shadow samples cover the same soft-shadow distance');
    assert.ok((39 - f.draws.length) / 39 > .4);
  } finally { sim.dispose(); }
  assert.ok(Object.values(f.live).every(resources => resources.size === 0));
});

test('smoke reuses targets at a stable size and releases them on resize and unmount', () => {
  const f = recordingGL(), sim = testCreateSim(f.gl, .5);
  sim.resize(400, 772);
  assert.equal(f.live.textures.size, 10);
  const allocations = f.storage.length;
  for (let frame = 0; frame < 10; frame++) { sim.resize(400, 772); sim.step(1 / 30, options); }
  assert.equal(f.storage.length, allocations, 'No texture allocations per frame');
  sim.resize(600, 900);
  assert.equal(f.live.textures.size, 10, 'Old targets are freed before replacement');
  sim.clear();
  sim.dispose();
  assert.ok(Object.values(f.live).every(resources => resources.size === 0));
});

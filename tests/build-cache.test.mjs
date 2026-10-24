import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildProject, versionModuleImports, versionHtmlResources } from '../scripts/build.mjs';
import { serveStatic } from '../scripts/static-handler.mjs';

async function fixture(callback) {
  const directory=await mkdtemp(path.join(tmpdir(),'longd-build-cache-')),source=path.join(directory,'src'),destination=path.join(directory,'dist');
  await mkdir(path.join(source,'nested'),{recursive:true});await mkdir(path.join(source,'assets'));
  const app="import { language } from './project-media.js'; export { language }; export const open = () => import('./nested/showcase.js'); export const asset = new URL('./assets/demo.mp4', import.meta.url).href;";
  await Promise.all([
    writeFile(path.join(source,'index.html'),'<title>Long D.</title><link rel="stylesheet" href="./styles.css"><link rel="modulepreload" href="./project-media.js"><script type="module" src="./app.js"></script>'),
    writeFile(path.join(source,'package.json'),'{"type":"module"}'),writeFile(path.join(source,'app.js'),app),
    writeFile(path.join(source,'project-media.js'),"export const language = 'en';"),writeFile(path.join(source,'styles.css'),'body{color:#304a3d}'),
    writeFile(path.join(source,'nested/showcase.js'),"export { language } from '../project-media.js';"),writeFile(path.join(source,'assets/demo.mp4'),Buffer.from('the actual demo bytes'))
  ]);
  try { await callback({source,destination,directory,app}); } finally { await rm(directory,{recursive:true,force:true}); }
}

test('a fresh build versions the entire module graph and a changed nested module bypasses an existing module cache',async()=>fixture(async({source,destination,app})=>{
  const first=await buildProject({source,destination});assert.match(first.revision,/^[a-f0-9]{16}$/);
  for(const file of ['index.html','app.js','nested/showcase.js']){
    const output=await readFile(path.join(destination,file),'utf8'),references=[...output.matchAll(/["'](\.{1,2}\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(match=>match[1]);
    assert.ok(references.length);for(const reference of references)assert.equal(new URL(reference,'https://portfolio.test/').searchParams.get('v'),first.revision);
  }
  assert.equal(await readFile(path.join(source,'app.js'),'utf8'),app,'Build revisions must never be written into source');
  const firstModule=await import(`${pathToFileURL(path.join(destination,'app.js'))}?v=${first.revision}`);
  assert.equal(firstModule.language,'en');assert.equal((await firstModule.open()).language,'en');
  assert.equal(await readFile(fileURLToPath(firstModule.asset),'utf8'),'the actual demo bytes','import.meta relative assets still resolve');
  const identical=await buildProject({source,destination});assert.equal(identical.revision,first.revision,'Unchanged input yields stable URLs');
  await writeFile(path.join(source,'project-media.js'),"export const language = 'vi';");
  const second=await buildProject({source,destination});assert.notEqual(second.revision,first.revision);
  const secondModule=await import(`${pathToFileURL(path.join(destination,'app.js'))}?v=${second.revision}`);
  assert.equal(secondModule.language,'vi');assert.equal((await secondModule.open()).language,'vi','Dynamic and transitive modules must use the new revision too');
  assert.equal(firstModule.language,'en','The test retains the old cached module to prove the new graph was loaded');
  assert.equal(await readFile(path.join(source,'app.js'),'utf8'),app);
}));

test('the revision also changes when an asset changes, while copied media bytes stay exact',async()=>fixture(async({source,destination})=>{
  const first=await buildProject({source,destination}),replacement=Buffer.from('a corrected recording');
  await writeFile(path.join(source,'assets/demo.mp4'),replacement);const second=await buildProject({source,destination});
  assert.notEqual(first.revision,second.revision);assert.deepEqual(await readFile(path.join(destination,'assets/demo.mp4')),replacement);
}));

test('static, side-effect, exported, dynamic, and template-expression imports are stamped without changing prose or shader strings',()=>{
  const code=[
    "import thing from './one.js';", "import './side.js';", "export * from '../two.js';", "export { value } from './three.mjs?raw=1#part';",
    "const lazy=import /* keep this comment */ ('./lazy.js');", "const template=`text import('./shader.js') ${import('./inside.js')}`;",
    "const prose=\"import('./example.js')\";", "// import('./comment.js');", "/* export * from './block.js'; */",
    "const pattern=/import\\('example.js'\\)/;", "import external from 'https://cdn.test/external.js';", "const image=new URL('./assets/poster.jpg',import.meta.url);"
  ].join('\n');
  const output=versionModuleImports(code,'abc123');
  for(const file of ['./one.js','./side.js','../two.js','./lazy.js','./inside.js'])assert.ok(output.includes(`${file}?v=abc123`));
  assert.ok(output.includes('./three.mjs?raw=1&v=abc123#part'));
  for(const file of ['./shader.js','./example.js','./comment.js','./block.js','https://cdn.test/external.js','./assets/poster.jpg']){
    assert.ok(output.includes(file));assert.ok(!output.includes(`${file}?v=`));
  }
  assert.equal(versionModuleImports(output,'abc123'),output,'Versioning is idempotent');
  assert.equal(versionHtmlResources('<script src="./app.js?test=1#entry"></script><link rel="modulepreload" href="./nested.js"><link href="./styles.css"><a href="https://cdn.test/app.js">external</a>','abc123'),'<script src="./app.js?test=1&v=abc123#entry"></script><link rel="modulepreload" href="./nested.js?v=abc123"><link href="./styles.css?v=abc123"><a href="https://cdn.test/app.js">external</a>');
});

test('preview code revalidates while media remains cacheable and supports version-query byte ranges',async()=>fixture(async({source,destination})=>{
  await buildProject({source,destination});
  async function request(url,{range,development=false}={}){
    const response={status:0,headers:{},body:null,writeHead(status,headers={}){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    await serveStatic({url,headers:range?{range}:{}},response,destination,development);return response;
  }
  for(const url of ['/','/app.js?v=old','/nested/showcase.js?v=new','/styles.css?v=new','/package.json']){
    const response=await request(url);assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'no-cache');
  }
  assert.equal((await request('/app.js',{development:true})).headers['Cache-Control'],'no-store');
  const video=await request('/assets/demo.mp4?v=recording',{range:'bytes=4-9'});assert.equal(video.status,206);assert.equal(video.headers['Cache-Control'],'public, max-age=300');
  assert.equal(video.headers['Accept-Ranges'],'bytes');assert.equal(video.headers['Content-Type'],'video/mp4');assert.equal(video.headers['Content-Range'],'bytes 4-9/21');assert.equal(video.body.toString(),'actual');
  assert.equal((await request('/assets/demo.mp4')).headers['Cache-Control'],'public, max-age=300');
  assert.equal((await request('/assets/demo.mp4',{range:'bytes=9999-'})).status,416);
}));

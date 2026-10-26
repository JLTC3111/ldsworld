import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('every locked component dependency has a complete version, including optional platform binaries',async()=>{
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  for(const [path,entry]of Object.entries(lock.packages))assert.match(entry.version||'',/^\d+\.\d+\.\d+(?:[-+].+)?$/,`Incomplete dependency version: ${path||'root'}`);
  const esbuild=lock.packages['node_modules/esbuild'];
  for(const [name,version]of Object.entries(esbuild.optionalDependencies)){
    const entry=lock.packages[`node_modules/${name}`];
    assert.ok(entry,`Missing esbuild platform metadata: ${name}`);
    assert.equal(entry.version,version);assert.equal(entry.optional,true);
    assert.ok(entry.cpu?.length&&entry.os?.length,`Missing platform constraints: ${name}`);
  }
});

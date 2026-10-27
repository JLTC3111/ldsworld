import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readdir, rm } from 'node:fs/promises';

const vendor=new URL('../src/vendor/',import.meta.url);
for(const filename of await readdir(vendor))if(/^ui-shared-.*\.js$/.test(filename))await rm(new URL(filename,vendor));

await build({
  absWorkingDir:fileURLToPath(new URL('../', import.meta.url)),
  entryPoints:{'portfolio-controls':'components/portfolio-controls.jsx','about-topography':'components/about-topography.jsx','project-flying-button':'components/project-flying-button.jsx','project-carousel':'components/project-carousel.js'},
  outdir:'src/vendor', splitting:true, chunkNames:'ui-shared-[hash]',
  bundle:true, format:'esm', platform:'browser', target:'es2022',
  jsx:'automatic', minify:true, legalComments:'eof',
  define:{ 'process.env.NODE_ENV':'"production"' }
});

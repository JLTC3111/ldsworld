import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir:fileURLToPath(new URL('../', import.meta.url)),
  entryPoints:['components/portfolio-controls.jsx'],
  outfile:'src/vendor/portfolio-controls.js',
  bundle:true, format:'esm', platform:'browser', target:'es2022',
  jsx:'automatic', minify:true, legalComments:'eof',
  define:{ 'process.env.NODE_ENV':'"production"' }
});

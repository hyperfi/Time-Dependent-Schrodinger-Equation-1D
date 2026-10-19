import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:['tests/physics.test.ts'],bundle:true,write:false,platform:'node',format:'cjs'});
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);

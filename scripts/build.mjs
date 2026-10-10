import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/lib',{recursive:true});
for(const f of ['index.html','app.mjs','styles.css'])await copyFile(f,`dist/${f}`);
await copyFile('lib/workouts.mjs','dist/lib/workouts.mjs');
console.log('Stride build complete.');

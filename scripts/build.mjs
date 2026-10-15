import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/lib',{recursive:true});
for(const f of ['index.html','app.mjs','styles.css','lib/workouts.mjs','lib/dashboard.mjs'])await copyFile(f,`dist/${f}`);
console.log('Stride build complete.');

import { mkdir, copyFile, rm } from 'node:fs/promises';
await mkdir('vendor', {recursive:true});
await copyFile('node_modules/babylonjs/babylon.js', 'vendor/babylon.js');
await copyFile('node_modules/babylonjs/license.md', 'vendor/BABYLON-LICENSE.md');
await rm('vendor/three.module.js',{force:true});
await rm('vendor/THREE-LICENSE.txt',{force:true});

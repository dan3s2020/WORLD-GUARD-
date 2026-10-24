import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const files=['scripts/build-life-bundle.mjs','sim/life.mjs','sim/life-train.mjs','life-ui.mjs','life.bundle.js'];

for(const ending of ['LF','CRLF','mixed']){
 test(`bundle verification is reproducible with ${ending} source and checkout line endings`,()=>{
  const root=mkdtempSync(join(tmpdir(),'worldguard-line-endings-'));
  try{
   for(const name of files){
    mkdirSync(resolve(root,name,'..'),{recursive:true});
    const canonical=readFileSync(resolve(projectRoot,name),'utf8').replace(/\r\n?/g,'\n');
    const content=ending==='CRLF'||(ending==='mixed'&&name!=='life.bundle.js')?canonical.replace(/\n/g,'\r\n'):canonical;
    writeFileSync(resolve(root,name),content);
   }
   const check=()=>execFileSync(process.execPath,[resolve(root,'scripts/build-life-bundle.mjs'),'--check'],{encoding:'utf8'});
   assert.match(check(),/PASS/);
   execFileSync(process.execPath,[resolve(root,'scripts/build-life-bundle.mjs')]);
   const built=readFileSync(resolve(root,'life.bundle.js'),'utf8');
   const committed=readFileSync(resolve(projectRoot,'life.bundle.js'),'utf8').replace(/\r\n?/g,'\n');
   assert.equal(built,committed);
   assert.match(check(),/PASS/);
   writeFileSync(resolve(root,'life.bundle.js'),built.replace('// SOURCE: sim/life.mjs','// SOURCE: altered/life.mjs'));
   assert.throws(check,/stale/);
  }finally{rmSync(root,{recursive:true,force:true});}
 });
}

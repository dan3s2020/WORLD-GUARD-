import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..', import.meta.url)));
const raw=readFileSync(resolve(root,'docs/REQUIREMENTS_CHECKLIST.json'),'utf8');
const data=JSON.parse(raw);
const valid=new Set(['verified','partial','missing']);
if(!Array.isArray(data.requirements)||!data.requirements.length)throw Error('Checklist is empty');
const ids=new Set();
for(const item of data.requirements){
 if(!/^WG-\d{3}$/.test(item.id)||ids.has(item.id))throw Error('Invalid or duplicate ID: '+item.id);
 if(!valid.has(item.status))throw Error('Unknown checklist status: '+item.id);
 if(!item.title||!item.requirement||!data.sources[item.source])throw Error('Incomplete checklist item: '+item.id);
 if(item.status==='verified'&&(!item.target||!item.evidence))throw Error('Verified item needs clickable target and evidence: '+item.id);
 if(item.status==='missing'&&item.target)throw Error('Missing item cannot link to a fake feature: '+item.id);
 ids.add(item.id);
}
const rendered='/* Generated from docs/REQUIREMENTS_CHECKLIST.json by scripts/build-requirements.mjs. */\nwindow.WORLD_GUARD_REQUIREMENTS = '+JSON.stringify(data,null,2)+';\n';
const outfile=resolve(root,'checklist.data.js');
if(process.argv.includes('--check')){
 const found=readFileSync(outfile,'utf8').replace(/\r\n?/g,'\n');
 if(found!==rendered)throw Error('checklist.data.js is stale; run npm run build:checklist');
 console.log('PASS requirements manifest validates and checklist.data.js matches source');
}else{
 writeFileSync(outfile,rendered);
 console.log('Built checklist.data.js ('+data.requirements.length+' requirements)');
}

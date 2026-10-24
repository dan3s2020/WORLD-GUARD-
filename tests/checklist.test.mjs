import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const data=JSON.parse(readFileSync(resolve(root,'docs/REQUIREMENTS_CHECKLIST.json'),'utf8'));
const statuses=['verified','partial','missing'];
const items=data.requirements;
test('59 explicitly traceable requirements have unique IDs and supported states',()=>{
 assert.equal(items.length,59);assert.equal(new Set(items.map(x=>x.id)).size,59);
 for(const x of items){assert.ok(statuses.includes(x.status));assert.ok(data.sources[x.source]);assert.ok(x.title&&x.requirement);}
});
test('only genuinely navigable synthetic features are marked verified',()=>{
 const allowed=new Set(['globe','city','building','apartment','agent','choices','review','guard','replay','run','export','train','ledger','checklist','game','persistence','follow','spatialReplay','explore','walk','build']);
 for(const x of items){if(x.status==='verified'){assert.ok(x.target&&allowed.has(x.target),x.id);assert.ok(x.evidence,x.id);}else if(x.status==='missing')assert.equal(x.target,undefined,x.id);}
 assert.deepEqual(Object.fromEntries(statuses.map(s=>[s,items.filter(x=>x.status===s).length])),{verified:19,partial:30,missing:10});
});
test('model training and 3D gameplay must not be misrepresented as verified',()=>{
 for(const id of ['WG-003','WG-010','WG-031','WG-032','WG-034','WG-046'])assert.notEqual(items.find(x=>x.id===id).status,'verified',id);
});
test('real decision-engine identification is Laya and not LayaAir',()=>{
 const x=items.find(x=>x.id==='WG-031');assert.match(x.requirement,/NandhaKishorM\/laya/);
 const js=readFileSync(resolve(root,'checklist-ui.js'),'utf8');assert.match(js,/WorldGuardFeatureFocus/);
 const html=readFileSync(resolve(root,'life.html'),'utf8');assert.match(html,/id="settingsChecklist"/);
 assert.ok(existsSync(resolve(root,'docs/REQUIREMENTS_CHECKLIST.json')));
});

/* Settings-only requirements auditor. Reads canonical generated data, never grants acceptance. */
(function(){
'use strict';
const dataset=window.WORLD_GUARD_REQUIREMENTS;
const dialog=document.getElementById('requirementsDialog');
const list=document.getElementById('requirementItems');
const search=document.getElementById('requirementSearch');
const filter=document.getElementById('requirementFilter');
const total=document.getElementById('requirementSummary');
const notice=document.getElementById('requirementNotice');
const opener=document.getElementById('settingsChecklist');
if(!dataset||!dialog||!list||!search||!filter||!opener)throw Error('Requirements Settings could not initialize');
const all=dataset.requirements;
const statusLabels={verified:'VERIFIED IN SYNTHETIC PROTOTYPE',partial:'PARTIAL / INCOMPLETE',missing:'NOT IMPLEMENTED'};
const counts=all.reduce((out,x)=>(out[x.status]++,out),{verified:0,partial:0,missing:0});
total.textContent=`${all.length} REQUIREMENTS · ${counts.verified} VERIFIED (TOY SCOPE) · ${counts.partial} PARTIAL · ${counts.missing} MISSING`;
const hint=document.getElementById('requirementVersion');
hint.textContent=dataset.releaseTarget+' · assessed against checked-in code, not production safety';
let lastTrigger=opener;
const clearSearch=document.createElement('button');clearSearch.type='button';clearSearch.textContent='Clear search ✕';clearSearch.setAttribute('aria-label','Clear requirement search');clearSearch.hidden=true;search.parentElement.append(clearSearch);
clearSearch.addEventListener('click',()=>{search.value='';render();search.focus();});
function append(item){
 const li=document.createElement('li');li.className='requirement-entry '+item.status;
 const top=document.createElement('div');top.className='requirement-top';
 const box=document.createElement('input');box.type='checkbox';box.checked=item.status==='verified';box.disabled=true;box.setAttribute('aria-label',item.title+': '+statusLabels[item.status]);
 const title=document.createElement('strong');title.textContent=item.id+' · '+item.title;
 const chip=document.createElement('span');chip.className='requirement-chip';chip.textContent=statusLabels[item.status];
 top.append(box,title,chip);li.append(top);
 const description=document.createElement('p');description.textContent=item.requirement;li.append(description);
 const source=document.createElement('p');source.className='requirement-source';source.textContent='Verbatim source: '+dataset.sources[item.source];li.append(source);
 if(item.evidence){const e=document.createElement('p');e.className='requirement-proof';e.textContent='Evidence / limitation: '+item.evidence;li.append(e);}
 const actions=document.createElement('div');actions.className='requirement-actions';
 if(item.target){
  const go=document.createElement('button');go.type='button';go.className='button '+(item.status==='verified'?'cyan':'secondary');
  go.textContent=item.status==='verified'?'Go to working feature →':'Inspect partial prototype →';
  go.addEventListener('click',()=>{
   if(typeof window.WorldGuardFeatureFocus!=='function'){notice.textContent='Viewer is not initialized; reload and inspect any startup error.';return;}
   const done=window.WorldGuardFeatureFocus(item.target);
   if(!done){notice.textContent='Feature target unavailable; requirement cannot be treated as verified.';return;}
   dialog.close();
  });actions.append(go);
 }
 if(item.status==='missing'){
  const no=document.createElement('span');no.className='requirement-unavailable';no.textContent='No working feature available to open';actions.append(no);
 }
 li.append(actions);return li;
}
function render(){
 clearSearch.hidden=!search.value;
 const q=search.value.trim().toLowerCase();const kind=filter.value;
 const visible=all.filter(x=>(kind==='all'||x.status===kind)&&(!q||[x.id,x.title,x.requirement,x.evidence||''].join(' ').toLowerCase().includes(q)));
 list.replaceChildren(...visible.map(append));
 notice.textContent=visible.length===0?'No requirements match this filter.':`Showing ${visible.length} of ${all.length} requirements. Only verified synthetic features have checked boxes.`;
}
opener.addEventListener('click',()=>{lastTrigger=opener;search.value='';filter.value='all';render();dialog.showModal();search.focus();});
document.getElementById('closeRequirements').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>{lastTrigger.focus();});
search.addEventListener('input',render);filter.addEventListener('change',render);
window.WorldGuardChecklistTest={getCounts:()=>({...counts}),lookup:id=>all.find(x=>x.id===id)};
})();

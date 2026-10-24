import {CITIES,BUILDINGS,SCENARIOS,createLifeWorld,capture,decisionAt,lifeStep,resolveLifeReview,restoreFrame,optionsFor} from './sim/life.mjs';
import {createLifeTrainer,evaluateLifePolicy,randomLifePolicy} from './sim/life-train.mjs';
const el=id=>document.getElementById(id);
const cv=el('worldCanvas'),g=cv.getContext('2d');
let w=createLifeWorld(7),policy=null,trainer=null,training=false,running=null;
let frameIndex=0,selectedAgent='AG-0001',view={level:'globe',city:'eu',building:'B-01'};
let rotation=-25,globeScale=1,dragged=false,dragStart=null,markers=[],buildingsHit=[],apartmentHit=[];
const rgb={aqua:'#59dfe9',gold:'#f8bf78',muted:'#95b3ce',white:'#f0f7ff',good:'#74dabb',red:'#f68c9d'};
const rand=n=>{let v=Math.sin(n*129.987+45.3)*43758.56;return v-Math.floor(v);};
const starfield=Array.from({length:150},(_,i)=>({x:rand(i+13)*1200,y:rand(i+331)*660,r:rand(i+92)*1.5+.25}));
const continents=[
  [[-168,67],[-140,72],[-124,62],[-110,60],[-97,50],[-81,46],[-64,51],[-60,42],[-81,9],[-100,14],[-109,30],[-120,32],[-132,53]],
  [[-78,10],[-65,11],[-52,-2],[-48,-15],[-54,-32],[-70,-55],[-76,-35],[-81,-7]],
  [[-11,35],[-15,30],[-12,15],[-18,2],[-8,-20],[11,-34],[26,-30],[35,-12],[51,12],[41,25],[34,32],[20,34]],
  [[-10,36],[-10,49],[-2,60],[20,71],[45,70],[71,55],[93,55],[107,48],[127,49],[141,40],[141,26],[116,5],[108,-7],[95,3],[72,9],[62,24],[41,34],[28,37],[18,44],[8,43]],
  [[113,-11],[136,-12],[154,-22],[151,-39],[128,-43],[112,-24]],
  [[45,-12],[50,-15],[50,-26],[44,-27]],
  [[-50,79],[-31,82],[-37,62],[-52,60]],
  [[-9,59],[1,55],[-5,50],[-11,51]],
  [[130,34],[142,43],[146,31],[137,30]],
];
const deg=Math.PI/180;
function proj(lon,lat){
 const la=lat*deg,lo=(lon+rotation)*deg,tilt=17*deg;
 const a=Math.cos(la)*Math.sin(lo),b=Math.sin(la),c=Math.cos(la)*Math.cos(lo);
 return {x:590+246*globeScale*a,y:320-246*globeScale*(b*Math.cos(tilt)-c*Math.sin(tilt)),front:b*Math.sin(tilt)+c*Math.cos(tilt)>0};
}
function line(points,stroke,width=1,dash=[]){g.beginPath();for(let i=0;i<points.length;i++){const p=points[i];i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);}g.strokeStyle=stroke;g.lineWidth=width;g.setLineDash(dash);g.stroke();g.setLineDash([]);}
function polygon(points,fill,stroke){g.beginPath();for(let i=0;i<points.length;i++){const p=points[i];i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);}g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.stroke();}}
function txt(s,x,y,color=rgb.white,size=14,align='center',weight='600') {g.fillStyle=color;g.font=`${weight} ${size}px ui-monospace,monospace`;g.textAlign=align;g.textBaseline='middle';g.fillText(s,x,y);}
function backdrop(){g.clearRect(0,0,1200,660);const grad=g.createLinearGradient(0,0,0,660);grad.addColorStop(0,'#0d243d');grad.addColorStop(1,'#071121');g.fillStyle=grad;g.fillRect(0,0,1200,660);for(const s of starfield){g.fillStyle=`rgba(183,217,251,${.13+s.r*.16})`;g.fillRect(s.x,s.y,s.r,s.r);} }
function globe(){
 const radius=246*globeScale;
 g.save();g.shadowColor='#268ec0';g.shadowBlur=45;g.fillStyle='#0b213c';g.beginPath();g.arc(590,320,radius,0,Math.PI*2);g.fill();g.restore();
 g.save();g.beginPath();g.arc(590,320,radius,0,Math.PI*2);g.clip();
 const water=g.createRadialGradient(515,233,5,590,320,radius*1.25);water.addColorStop(0,'#26678a');water.addColorStop(.5,'#103958');water.addColorStop(1,'#071a35');g.fillStyle=water;g.fillRect(590-radius,320-radius,radius*2,radius*2);
 for(let lat=-75;lat<=75;lat+=15){let pts=[];for(let lon=-180;lon<=180;lon+=3){const p=proj(lon,lat);if(!p.front){if(pts.length>1)line(pts,'#5d9abc32');pts=[];}else pts.push(p);}if(pts.length>1)line(pts,'#5d9abc32');}
 for(let lon=-180;lon<180;lon+=15){let pts=[];for(let lat=-89;lat<=89;lat+=3){const p=proj(lon,lat);if(!p.front){if(pts.length>1)line(pts,'#5d9abc32');pts=[];}else pts.push(p);}if(pts.length>1)line(pts,'#5d9abc32');}
 for(const shape of continents){const vertices=shape.map(([lon,lat])=>proj(lon,lat));const shown=vertices.filter(p=>p.front);if(shown.length>2)polygon(shown,'#2d746d','#55bcac89');}
 g.restore();g.beginPath();g.arc(590,320,radius,0,Math.PI*2);g.strokeStyle='#8bddeb77';g.lineWidth=2;g.stroke();
 txt('WORLD GUARD / PLANET 001',590,38,rgb.aqua,13);txt('ORTHOGRAPHIC 3D PROJECTION · DRAG THE GLOBE',590,60,rgb.muted,10);
 markers=[];
 for(const city of CITIES){const p=proj(city.lon,city.lat);if(!p.front)continue;markers.push({x:p.x,y:p.y,city:city.id});g.beginPath();g.arc(p.x,p.y,7,0,Math.PI*2);g.fillStyle=rgb.gold;g.fill();g.strokeStyle='#f9dfbb';g.lineWidth=2;g.stroke();txt(city.name,p.x+12,p.y-17,rgb.white,12,'left');}
 g.fillStyle='#101e32b9';g.fillRect(35,82,237,111);txt('RESIDENTS',54,102,rgb.muted,11,'left');txt(String(w.population).padStart(3,'0'),55,134,rgb.white,29,'left','400');txt('6 synthetic city regions',54,166,rgb.aqua,11,'left');
 g.fillStyle='#101e32b9';g.fillRect(899,447,261,110);txt('OBSERVER AUTHORITY',916,471,rgb.aqua,11,'left');txt('Independent action veto',916,496,rgb.white,12,'left');txt('Event-sourced replay',916,522,rgb.white,12,'left');
}
function iso(x,y,z=0){return {x:600+(x-y)*78,y:125+(x+y)*41-z};}
function tile(x,y){const p=iso(x,y);return[{x:p.x,y:p.y-39},{x:p.x+76,y:p.y},{x:p.x,y:p.y+39},{x:p.x-76,y:p.y}];}
function cube(p,h,colors){const roof=tile(p.x,p.y),top=roof.map(v=>({x:v.x,y:v.y-h}));polygon([roof[3],roof[2],top[2],top[3]],colors[1],'#0e263b');polygon([roof[1],roof[2],top[2],top[1]],colors[2],'#0e263b');polygon(top,colors[0],'#96badb');return top;}
function cityView(){const city=CITIES.find(c=>c.id===view.city);txt(`${city.name.toUpperCase()} / ${city.region.toUpperCase()}`,600,45,rgb.aqua,17);txt('SELECT BUILDING · AGENTS AND APARTMENTS ARE INTERACTIVE',600,69,rgb.muted,11);
 buildingsHit=[];
 for(let x=0;x<6;x++)for(let y=0;y<3;y++){const pts=tile(x,y);polygon(pts,(x+y)%2?'#18354b':'#153047','#2c566c');}
 for(const b of BUILDINGS){const residents=frameState().agents.filter(a=>a.city===view.city&&a.building===b.id);const height=b.kind==='office'?84:b.kind==='civic'?66:35+(b.x*9)%40;const top=cube(b,height,b.kind==='office'?['#90bee4','#284b68','#315c7a']:b.kind==='civic'?['#f0b986','#694a54','#77545e']:['#74a8b9','#23435b','#2b5067']);const p=iso(b.x,b.y,height);if(residents.length){g.fillStyle=rgb.good;g.fillRect(p.x-4,p.y-5,8,8);}txt(b.id,p.x,p.y+24,rgb.white,11);buildingsHit.push({building:b.id,x:p.x,y:p.y+12,hasResidents:residents.length});}
 txt('CLICK A ROOF TO INSPECT APARTMENTS',600,624,rgb.muted,12);
}
function buildingView(){const b=BUILDINGS.find(x=>x.id===view.building);const people=frameState().agents.filter(a=>a.city===view.city&&a.building===view.building);txt(`${view.building} / ${b.name.toUpperCase()}`,600,55,rgb.aqua,19);txt('BUILDING INSPECTION · SYNTHETIC RESIDENTS ONLY',600,84,rgb.muted,11);
 apartmentHit=[];const base=iso(2,2,0),floors=Math.max(3,people.length);for(let floor=0;floor<floors;floor++){const p={x:base.x,y:base.y-floor*76};polygon([{x:p.x-195,y:p.y-35},{x:p.x+110,y:p.y-35},{x:p.x+195,y:p.y+12},{x:p.x-110,y:p.y+12}],floor%2?'#1d3a51':'#24475d','#5c8095');for(let room=0;room<3;room++){const x=p.x-140+room*120;g.fillStyle='#14283f';g.fillRect(x,p.y-26,97,31);g.strokeStyle='#6689a4';g.strokeRect(x,p.y-26,97,31);}}
 txt('APARTMENTS',862,150,rgb.aqua,12);if(!people.length)txt('No residents in this building.',860,198,rgb.muted,12);for(let i=0;i<Math.min(people.length,8);i++){txt(`${String(people[i].apartment).padStart(2,'0')} · ${people[i].id}`,860,198+i*39,rgb.white,13);apartmentHit.push({id:people[i].id,x:860,y:198+i*39});}
 txt('CLICK AN APARTMENT LABEL OR SELECT A RESIDENT IN THE INSPECTOR',600,615,rgb.muted,11);
}
function agentView(){const agent=frameState().agents.find(a=>a.id===selectedAgent);const b=BUILDINGS.find(x=>x.id===agent.building);txt(`${agent.id} / SIMULATED LIFE`,600,60,rgb.aqua,19);txt(`${agent.occupation.toUpperCase()} · ${agent.city.toUpperCase()} / ${b.name.toUpperCase()}`,600,91,rgb.muted,11);
 const center={x:580,y:365};polygon([{x:center.x,y:center.y-188},{x:center.x+285,y:center.y-52},{x:center.x,y:center.y+99},{x:center.x-285,y:center.y-52}],'#234b59','#80bcca');polygon([{x:center.x-285,y:center.y-52},{x:center.x,y:center.y+99},{x:center.x,y:center.y+155},{x:center.x-285,y:center.y+4}],'#183047','#3a6980');polygon([{x:center.x,y:center.y+99},{x:center.x+285,y:center.y-52},{x:center.x+285,y:center.y+4},{x:center.x,y:center.y+155}],'#1b344d','#3a6980');
 txt('HOME + WORK SIMULATION',580,293,rgb.white,14);g.fillStyle='#f0bf89';g.beginPath();g.arc(580,342,24,0,Math.PI*2);g.fill();g.fillStyle='#3c82a0';g.fillRect(558,368,44,60);txt(agent.id,580,455,rgb.aqua,14);txt(`ENERGY ${agent.energy}   TRUST ${agent.trust}`,580,484,rgb.white,12);txt('FICTIONAL PERSONA · NOT A HUMAN IDENTITY CLAIM',580,599,rgb.muted,11);
}
function frameState(){return frameIndex===w.frames.length-1?capture(w):restoreFrame(w,frameIndex);}
function draw(){backdrop();if(view.level==='globe')globe();else if(view.level==='city')cityView();else if(view.level==='building')buildingView();else agentView();}
function currentCityName(){return CITIES.find(c=>c.id===view.city)?.name||'Unknown';}
function selectView(level){view.level=level;el('back').disabled=level==='globe';el('path').textContent=level==='globe'?'EARTH / GLOBAL':`EARTH / ${currentCityName().toUpperCase()}${level==='city'?'':` / ${view.building}${level==='agent'?` / ${selectedAgent}`:''}`}`;el('viewChip').textContent={globe:'3D PROJECTED GLOBE',city:'2.5D CITY',building:'APARTMENT CUTAWAY',agent:'AGENT LIFE INSPECTOR'}[level];el('worldTitle').textContent={globe:'Planetary view',city:'City systems',building:'Building · Apartments',agent:'Agent experience'}[level];el('mapHint').textContent={globe:'DRAG TO ROTATE · SELECT A CITY',city:'CLICK A ROOF TO ENTER A BUILDING',building:'CHOOSE A RESIDENT FROM THE INSPECTOR',agent:'PERSONA AND FULL REPLAY'}[level];render();}
const actionLabel=(scenario,id)=>optionsFor(scenario).find(a=>a.id===id)?.label||id.replaceAll('_',' ');
function render(){const snapshot=frameState(),d=decisionAt(w),current=snapshot.agents.find(a=>a.id===selectedAgent)||snapshot.agents[0];const idx=frameIndex;
 el('statAgents').textContent=w.population;el('statTurns').textContent=snapshot.turn;el('statFrames').textContent=w.frames.length;el('statBlocks').textContent=snapshot.metrics.blocked;el('statReviews').textContent=snapshot.metrics.approvals;
 el('clock').textContent=`Day ${String(snapshot.day).padStart(2,'0')} · ${SCENARIOS[Math.min(SCENARIOS.length-1,Math.floor(snapshot.turn/w.population))].at}`;
 el('frame').max=String(w.frames.length-1);el('frame').value=String(idx);el('timelineCount').textContent=`FRAME ${String(idx).padStart(4,'0')} / ${String(w.frames.length-1).padStart(4,'0')}`;
 el('replayNotice').textContent=idx<w.frames.length-1?'REPLAY MODE — inspecting immutable past states. New steps continue from the live state, never rewrite history.':'LIVE WORLD — complete decision trace captured.';
 el('eventTag').textContent=`FRAME ${String(idx).padStart(4,'0')}`;
 const decision=idx===w.frames.length-1?d:null,displayAgent=decision?.agent||current;
 el('activeAgent').textContent=displayAgent.id;el('activeMeta').textContent=`${displayAgent.occupation} · ${CITIES.find(c=>c.id===displayAgent.city).name}`;
 el('scenarioClock').textContent=decision?`${decision.scenario.at} · ${decision.scenario.place.toUpperCase()}`:idx<w.frames.length-1?'HISTORICAL FRAME · READ-ONLY':'END OF SCHEDULE';
 el('scenarioTitle').textContent=decision?.scenario.title||'Replay an earlier choice';el('scenarioDescription').textContent=decision?.scenario.description||'Inspect the event ledger and resident history at this frame.';
 const opts=el('options');opts.replaceChildren();if(decision){const rec=policy?.choose(decision);for(const a of optionsFor(decision.scenario.id)){const b=document.createElement('button');b.className='choice'+(a.id===rec?' recommended':'');b.type='button';b.textContent=a.label;if(a.id===rec){const span=document.createElement('span');span.textContent='LEARNED';b.append(span);}b.disabled=!!w.pending;b.addEventListener('click',()=>execute(a.id));opts.append(b);}}else{opts.textContent=w.done?'All 252 scheduled decisions completed. Reset to simulate again.':'Return to the latest frame to select an action.';}
 el('approvalPanel').hidden=!w.pending;el('approvalDescription').textContent=w.pending?`${w.pending.why} Scope: ${w.pending.scope} Alternative: ${w.pending.alternative}`:'';
 el('runStatus').textContent=w.pending?'HALTED · waiting for human review':w.done?'COMPLETE · whole day recorded':running?'LIVE · executing action policy':'READY · independent guard enabled';
 el('step').disabled=!!w.pending||w.done||training;el('run').disabled=!!w.pending||w.done||training||!!running;el('pause').disabled=!running;
 el('agentDetails').innerHTML=`<b>${current.id}</b> · Apt ${current.apartment}<div>Occupation: ${current.occupation}</div><div>City: ${CITIES.find(c=>c.id===current.city).name}</div><div>Building: ${current.building}</div><div>Energy: ${current.energy} · Trust: ${current.trust}</div><div>Task progress: ${current.task} · Harm: ${current.harm}</div>`;
 const history=el('agentHistory');history.replaceChildren();const entries=current.history.slice().reverse();if(!entries.length){const p=document.createElement('div');p.textContent='No observed choices yet at this frame.';history.append(p);}else for(const h of entries){const p=document.createElement('div');p.textContent=`#${String(h.turn).padStart(3,'0')} ${h.scenario}: ${actionLabel(h.scenario,h.action)} · reward ${h.reward}`;history.append(p);}
 const log=el('events');log.replaceChildren();const upTo=w.events.filter(e=>e.frame<=idx).slice(-40).reverse();if(!upTo.length){const p=document.createElement('div');p.className='event empty';p.textContent='No events yet. Train the policy, then step through a day.';log.append(p);}else for(const e of upTo){const div=document.createElement('div');div.className='event '+(e.kind==='blocked'?'bad':e.kind==='review'?'review':'');const clock=document.createElement('time');clock.textContent=`F${String(e.frame).padStart(4,'0')}`;const body=document.createElement('div');body.textContent=`${e.agentId} · ${e.scenario} · ${e.action} — ${e.explanation}`;div.append(clock,body);log.append(div);}
 draw();
}
function execute(action,{keepRunning=false}={}){if(!keepRunning)stop();if(frameIndex!==w.frames.length-1)frameIndex=w.frames.length-1;const result=lifeStep(w,action);frameIndex=w.frames.length-1;render();return result;}
function stepPolicy(){const d=decisionAt(w);if(!d)return;const action=policy?policy.choose(d):({morning:'wake',excel:'complete',software:'test_fix',injection:'verify',hospital:'approval',family:'help',review:'disclose'})[d.scenario.id];execute(action,{keepRunning:!!running});}
function stop(){if(running){clearInterval(running);running=null;}el('pause').disabled=true;}
function run(){if(running||w.done||w.pending||training)return;running=setInterval(()=>{if(w.pending||w.done){stop();render();return;}stepPolicy();if(w.pending||w.done)stop();render();},Number(el('speed').value));render();}
function populateCityButtons(){const box=el('citySelect');for(const city of CITIES){const b=document.createElement('button');b.textContent=city.name;b.type='button';b.addEventListener('click',()=>{view.city=city.id;selectView('city');});box.append(b);}}
function populateAgents(){const sel=el('agentSelect');sel.replaceChildren();for(const a of w.agents){const opt=document.createElement('option');opt.value=a.id;opt.textContent=`${a.id} · ${CITIES.find(c=>c.id===a.city).name} · Apt ${a.apartment}`;sel.append(opt);}sel.value=selectedAgent;}
function beginTraining(){if(training)return;stop();training=true;trainer=createLifeTrainer({episodes:12000,seed:41});policy=null;el('train').disabled=true;el('statPolicy').textContent='TRAIN';el('trainStatus').textContent='Updating learned values in batches…';
 const batch=()=>{const s=trainer.stepBatch(600);el('trainBar').style.width=`${100*s.completed/12000}%`;el('trainStatus').textContent=`${s.completed.toLocaleString('en-US')} / 12,000 updates · ${s.states} distinct states · last mean reward ${s.meanReward}`;
 if(!s.done){setTimeout(batch,0);return;}policy=trainer.policy;training=false;el('train').disabled=false;el('statPolicy').textContent='ON';el('statPolicyDetail').textContent=`${policy.q.size} Q states`;const learned=evaluateLifePolicy(policy,{seed:44444,episodes:2000}),baseline=evaluateLifePolicy(randomLifePolicy(8),{seed:44444,episodes:2000});el('benchmark').textContent=`HELD-OUT (2,000 choices) · learned ${learned.meanReward} vs random ${baseline.meanReward} mean reward; unsafe choices ${learned.truthViolations} vs ${baseline.truthViolations}; blocked-harm attempts ${learned.attemptedCriticalHarm} vs ${baseline.attemptedCriticalHarm}. Benchmark not a general safety proof.`;render();};setTimeout(batch,0);
}
function reset(){stop();w=createLifeWorld(w.seed+1,{population:w.population});frameIndex=0;populateAgents();render();}
function exportCheckpoint(){const data={format:'worldguard-life-v0.2',simulation:'synthetic',created:new Date().toISOString(),seed:w.seed,world:{agents:w.agents,events:w.events,frames:w.frames,metrics:w.metrics},training:policy?{episodes:policy.episodes,seed:policy.seed,q:[...policy.q.entries()]}:null,metrics:policy?evaluateLifePolicy(policy):null};const b=new Blob([JSON.stringify(data)],{type:'application/json'});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=`worldguard-life-seed${w.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
cv.addEventListener('pointerdown',e=>{const rect=cv.getBoundingClientRect(),scale=cv.width/rect.width;dragStart={x:(e.clientX-rect.left)*scale,y:(e.clientY-rect.top)*scale,rotation};dragged=false;cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{if(!dragStart||view.level!=='globe')return;const rect=cv.getBoundingClientRect(),x=(e.clientX-rect.left)*cv.width/rect.width;const delta=x-dragStart.x;if(Math.abs(delta)>4)dragged=true;rotation=dragStart.rotation+delta*.32;draw();});
cv.addEventListener('pointerup',e=>{if(!dragStart)return;const rect=cv.getBoundingClientRect(),x=(e.clientX-rect.left)*cv.width/rect.width,y=(e.clientY-rect.top)*cv.height/rect.height;dragStart=null;if(dragged){dragged=false;return;}
 if(view.level==='globe'){let hit=markers.map(m=>({...m,d:Math.hypot(m.x-x,m.y-y)})).sort((a,b)=>a.d-b.d)[0];if(hit&&hit.d<42){view.city=hit.city;selectView('city');}}
 else if(view.level==='city'){const hit=buildingsHit.map(b=>({...b,d:Math.hypot(b.x-x,b.y-y)})).sort((a,b)=>a.d-b.d)[0];if(hit&&hit.d<72){view.building=hit.building;selectView('building');const person=w.agents.find(a=>a.city===view.city&&a.building===view.building);if(person){selectedAgent=person.id;el('agentSelect').value=person.id;render();}}}
 else if(view.level==='building'){const hit=apartmentHit.map(a=>({...a,d:Math.hypot(a.x-x,a.y-y)})).sort((a,b)=>a.d-b.d)[0];if(hit&&hit.d<60){selectedAgent=hit.id;el('agentSelect').value=hit.id;selectView('agent');}}
});
cv.addEventListener('wheel',e=>{if(view.level!=='globe')return;e.preventDefault();globeScale=Math.max(.65,Math.min(1.22,globeScale+(e.deltaY<0?.07:-.07)));draw();},{passive:false});
cv.addEventListener('keydown',e=>{if(view.level==='globe'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();rotation+=e.key==='ArrowLeft'?-12:12;draw();}});
el('agentSelect').addEventListener('change',e=>{selectedAgent=e.target.value;const a=w.agents.find(x=>x.id===selectedAgent);view.city=a.city;view.building=a.building;selectView('agent');});
el('back').addEventListener('click',()=>{selectView(({agent:'building',building:'city',city:'globe'})[view.level]||'globe');});
el('return').addEventListener('click',()=>{rotation=-25;globeScale=1;selectView('globe');});
el('frame').addEventListener('input',e=>{stop();frameIndex=Number(e.target.value);render();});
el('first').addEventListener('click',()=>{stop();frameIndex=0;render();});
el('previous').addEventListener('click',()=>{stop();frameIndex=Math.max(0,frameIndex-1);render();});
el('latest').addEventListener('click',()=>{stop();frameIndex=w.frames.length-1;render();});
el('train').addEventListener('click',beginTraining);el('reset').addEventListener('click',reset);el('step').addEventListener('click',stepPolicy);el('run').addEventListener('click',run);el('pause').addEventListener('click',()=>{stop();render();});
el('approve').addEventListener('click',()=>{stop();resolveLifeReview(w,true);frameIndex=w.frames.length-1;render();});el('deny').addEventListener('click',()=>{stop();resolveLifeReview(w,false);frameIndex=w.frames.length-1;render();});
el('export').addEventListener('click',exportCheckpoint);
populateCityButtons();populateAgents();render();
el('viewerLoading').hidden=true;
// Navigation API for the immutable acceptance checklist. Never awards completion.
window.WorldGuardFeatureFocus=function navigateToVerifiedFeature(feature){
 const destination={
  globe:['worldCanvas','globe'],city:['worldCanvas','city'],building:['worldCanvas','building'],
  apartment:['worldCanvas','agent'],agent:['agentDetails','agent'],choices:['options',null],
  review:['runStatus',null],guard:['runStatus',null],replay:['frame',null],
  run:['run',null],export:['export',null],train:['train',null],
  ledger:['events',null],checklist:['settingsChecklist',null]
 }[feature];
 if(!destination)return false;
 const [id,level]=destination;
 if(level==='globe'){stop();selectView('globe');}
 if(level==='city'){stop();view.city='eu';selectView('city');}
 if(level==='building'){stop();view.city='eu';view.building='B-01';selectView('building');}
 if(level==='agent'){stop();const chosen=w.agents[0];selectedAgent=chosen.id;view.city=chosen.city;view.building=chosen.building;el('agentSelect').value=chosen.id;selectView('agent');}
 const target=el(id);
 if(!target)return false;
 target.scrollIntoView({block:'center',behavior:'instant'});
 target.classList.add('requirement-focus');
 target.addEventListener('animationend',()=>target.classList.remove('requirement-focus'),{once:true});
 if(target.matches('button,select,input'))target.focus({preventScroll:true});
 return true;
};


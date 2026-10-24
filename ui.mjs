import {W,H,SITES,createWorld,step,safePlanner,naivePlanner,near,resolveApproval,integrity,syntheticObservation} from './sim/core.mjs';
import {train,evaluate} from './sim/train.mjs';
import {trainOversight,evaluateOversight} from './sim/oversight.mjs';
const $=id=>document.getElementById(id);
const canvas=$('world'),ctx=canvas.getContext('2d');
let seed=7,w=createWorld(seed),learned=null,runner=null,busy=false;
const pos=(x,y,z=0)=>({x:570+(x-y)*49,y:103+(x+y)*27-z});
function poly(pts,fill,stroke,width=1){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}}
function diamond(p,rx=48,ry=26){return [{x:p.x,y:p.y-ry},{x:p.x+rx,y:p.y},{x:p.x,y:p.y+ry},{x:p.x-rx,y:p.y}];}
function textAt(t,x,y,color='#cfe0f6',size=16,weight='600',align='center'){
 ctx.fillStyle=color;ctx.font=`${weight} ${size}px ui-monospace,Consolas,monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(t,x,y);
}
function drawBlock(p,height,top,left,right){
 const b=diamond(p,34,18),t=b.map(a=>({x:a.x,y:a.y-height}));
 poly([b[3],b[2],t[2],t[3]],left,'#0c1a29',1);
 poly([b[1],b[2],t[2],t[1]],right,'#0c1a29',1);
 poly(t,top,'#87a3c844',1);
}
function iconSite(a){
 const p=pos(a.x,a.y),danger=a.hp===0,accent=a.kind==='health'?'#8fe8f0':a.kind==='power'?'#fac784':a.kind==='data'?'#9bb0ff':a.kind==='people'?'#d4b6ff':a.kind==='supply'?'#8ad9ca':'#f7b17e';
 const height=a.kind==='health'?79:a.kind==='data'?70:a.kind==='people'?45:a.kind==='power'?62:37;
 drawBlock(p,height,danger?'#553041':accent,danger?'#2b1424':'#233f58',danger?'#301d2e':'#2a4b67');
 if(a.kind==='health'){
    ctx.fillStyle=danger?'#ffc4ca':'#092e42';ctx.fillRect(p.x-7,p.y-height-7,14,29);ctx.fillRect(p.x-15,p.y-height+1,30,13);
 }else if(a.kind==='power'){
    textAt('ϟ',p.x,p.y-height+3,'#533316',24,'800');
 }else if(a.kind==='data'){
    for(let i=0;i<3;i++){ctx.fillStyle='#1c3354';ctx.fillRect(p.x-15,p.y-height-5+i*9,30,5);ctx.fillStyle='#80e8ee';ctx.fillRect(p.x+9,p.y-height-4+i*9,3,3);}
 }else if(a.kind==='people'){
    ctx.fillStyle='#efe9ff';ctx.fillRect(p.x-7,p.y-height-3,14,9);ctx.fillStyle='#26374e';ctx.fillRect(p.x-2,p.y-height+2,6,7);
 }else if(a.kind==='control')textAt('⊕',p.x,p.y-height,'#392512',22,'700');
 else textAt('✦',p.x,p.y-height,'#1a3c46',23,'700');
 textAt(a.name.toUpperCase(),p.x,p.y+41,danger?'#ff95a2':'#b9d5e9',11,'600');
 textAt(`${a.hp}/${a.max}  ${a.critical?'PROTECTED':'SERVICE'}`,p.x,p.y+57,danger?'#ff95a2':'#829eb7',10,'500');
}
function pawn(x,y,kind,hasTool=false){
 const p=pos(x,y);const color=kind==='defender'?'#4ae1f3':'#ff7687';
 ctx.beginPath();ctx.ellipse(p.x,p.y+5,22,10,0,0,Math.PI*2);ctx.fillStyle=kind==='defender'?'#1a88a75e':'#eb3d5c60';ctx.fill();
 ctx.shadowColor=color;ctx.shadowBlur=18;
 ctx.beginPath();ctx.moveTo(p.x-14,p.y-8);ctx.lineTo(p.x+14,p.y-8);ctx.lineTo(p.x+11,p.y-35);ctx.lineTo(p.x,p.y-43);ctx.lineTo(p.x-11,p.y-35);ctx.closePath();ctx.fillStyle=kind==='defender'?'#19869a':'#a13451';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
 ctx.beginPath();ctx.arc(p.x,p.y-51,11,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.shadowBlur=0;
 textAt(kind==='defender'?(hasTool?'BLUE + TOOL':'BLUE AGENT'):'ROGUE',p.x,p.y-78,color,12,'750');
}
function draw(){
 const g=ctx.createLinearGradient(0,0,0,665);g.addColorStop(0,'#142b48');g.addColorStop(1,'#071422');ctx.fillStyle=g;ctx.fillRect(0,0,1200,665);
 ctx.strokeStyle='#3b58702d';ctx.lineWidth=1;
 for(let i=0;i<20;i++){const x=i*90+16;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-180,665);ctx.stroke();}
 for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,i*72+14);ctx.lineTo(1200,i*72+14);ctx.stroke();}
 const sites=Object.values(w.assets);
 for(let sum=0;sum<W+H;sum++)for(let y=0;y<H;y++){
  const x=sum-y;if(x<0||x>=W)continue;const p=pos(x,y);
  const haz=w.hazards.some(h=>h.x===x&&h.y===y);
  const wall=['4,3','4,4','5,4','7,4','7,5'].includes(`${x},${y}`);
  const base=(x+y)%2?'#1e374e':'#1c3249';
  poly(diamond(p,48,26),haz?'#5a2b42':wall?'#334256':base,'#3a5870',1);
  if(wall){drawBlock(p,16,'#51627d','#2b3c53','#354f69');}
  if(haz){textAt('×',p.x,p.y,'#ff8199',26,'700');}
 }
 // Sorted for proper isometric overlap.
 const figures=sites.map(a=>({sum:a.x+a.y,type:'site',a}));
 figures.push({sum:w.agent.x+w.agent.y,type:'defender'});
 if(w.rogues)figures.push({sum:w.rogue.x+w.rogue.y,type:'rogue'});
 figures.sort((a,b)=>a.sum-b.sum||(a.type==='site'?-1:1));
 for(const f of figures){if(f.type==='site')iconSite(f.a);else if(f.type==='defender')pawn(w.agent.x,w.agent.y,'defender',w.agent.hasTool);else pawn(w.rogue.x,w.rogue.y,'rogue');}
 textAt('N',1093,70,'#bdd6e7',16,'600');ctx.strokeStyle='#7b9dbb';ctx.beginPath();ctx.moveTo(1093,88);ctx.lineTo(1093,125);ctx.stroke();
 textAt(`TURN ${String(w.turn).padStart(2,'0')}  / 64`,34,37,'#c5d9ee',14,'650','left');
 textAt('VIEW 01 · INFRASTRUCTURE',34,60,'#91a9c0',12,'400','left');
}
function update(){
 $('taskReward').textContent=w.taskReward;
 $('integrity').textContent=integrity(w)+'%';$('integrityBar').style.width=integrity(w)+'%';
 $('impact').textContent=w.costs.critical;
 $('approvals').textContent=w.authorizations;$('turn').innerHTML=`${w.turn} <small>/ 64</small>`;
 $('score').textContent=`Net score: ${Math.round(w.score)} · Rogue damage: ${w.costs.rogue}`;
 const outcome=$('outcome');outcome.className='outcome'+(w.outcome==='success'?' success':w.outcome!=='active'?' failed':'');
 $('status').textContent=w.pending?'HUMAN REVIEW REQUIRED':w.outcome==='success'?'MISSION COMPLETE':w.outcome==='critical_failure'?'CRITICAL WORLD LOSS':w.outcome==='timeout'?'MISSION TIMED OUT':'MISSION ACTIVE';
 $('powerStatus').textContent=w.power?'HOSPITAL POWER · RESTORED':'HOSPITAL POWER · OFFLINE';
 $('powerStatus').parentElement.classList.toggle('online',w.power);
 const allowed=!w.done&&!w.pending&&!busy;
 $('step').disabled=!allowed;$('run').disabled=!allowed;$('pause').disabled=!runner;
 $('propose').disabled=!allowed;$('shortcut').disabled=!allowed;$('reset').disabled=busy;
 $('train').disabled=busy;
 document.querySelectorAll('[data-action]').forEach(b=>b.disabled=!allowed);
 $('approval').hidden=!w.pending;
 if(w.pending){$('approvalTitle').textContent=w.pending.title;
  $('approvalRisk').textContent=`RISK · ${w.pending.risk}`;
  $('approvalBenefit').textContent=`BENEFIT · ${w.pending.benefit}`;
  $('approvalAlternative').textContent=`ALTERNATIVE · ${w.pending.alternative}`;
 }
 $('events').replaceChildren(...w.log.slice(-11).reverse().map(e=>{
  const d=document.createElement('div');d.className=`event ${e.type}`;
  const time=document.createElement('time');time.textContent=`T+${String(e.turn).padStart(2,'0')}`;
  const m=document.createElement('span');m.textContent=e.message;d.append(time,m);return d;
 }));
 draw();
}
function stop(){if(runner){clearInterval(runner);runner=null;}update();}
function runAction(a){if(!a||w.done||w.pending)return;const result=step(w,a);if(!result.ok&&result.message){const last=w.log.at(-1);if(!last||last.turn!==w.turn||!last.message.includes('blocked')){/* result visible through event log where emitted */}}
 update();if(w.done||w.pending)stop();}
function policyAction(){return $('policy').value==='naive'?naivePlanner(w):$('policy').value==='learned'?(learned?.choose(w)||'wait'):safePlanner(w);}
$('step').addEventListener('click',()=>runAction(policyAction()));
$('run').addEventListener('click',()=>{if(runner||w.done||w.pending)return;if($('policy').value==='learned'&&!learned){$('trainInfo').textContent='Train a policy first, or select a built-in planner.';return;}runner=setInterval(()=>{runAction(policyAction());},290);update();});
$('pause').addEventListener('click',stop);
$('reset').addEventListener('click',()=>{stop();seed++;w=createWorld(seed,{guardrails:!$('unsafe').checked,rogues:$('rogues').checked});update();});
$('unsafe').addEventListener('change',()=>{stop();w.guardrails=!$('unsafe').checked;update();});
$('rogues').addEventListener('change',()=>{stop();w.rogues=$('rogues').checked;update();});
$('shortcut').addEventListener('click',()=>{stop();runAction('unsafe_shortcut');});
$('approve').addEventListener('click',()=>{resolveApproval(w,true);update();});
$('deny').addEventListener('click',()=>{resolveApproval(w,false);update();});
$('propose').addEventListener('click',()=>{
 stop();if(w.done||w.pending)return;
 // Use navigational planner to reach the relay, but never execute the request without human review.
 const relay=w.assets.relay;
 for(let k=0;k<32&&!w.done&&!near(w,'relay');k++){
    // BFS for relay to navigate around terrain + moving adversary, independent of safe goal planner.
    const queue=[{x:w.agent.x,y:w.agent.y,first:null}],visited=new Set([`${w.agent.x},${w.agent.y}`]);let best=null;
    for(let i=0;i<queue.length;i++){
      const v=queue[i];if(Math.abs(v.x-relay.x)+Math.abs(v.y-relay.y)<=1){best=v.first;break;}
      for(const [a,dx,dy] of [['north',0,-1],['south',0,1],['west',-1,0],['east',1,0]]){
       const x=v.x+dx,y=v.y+dy,k=`${x},${y}`;
       if(x<0||y<0||x>=W||y>=H||visited.has(k)||['4,3','4,4','5,4','7,4','7,5'].includes(k)||(w.rogues&&w.rogue.x===x&&w.rogue.y===y))continue;
       visited.add(k);queue.push({x,y,first:v.first||a});
      }
    }
    if(!best)break;
    step(w,best);
 }
 if(!w.done&&near(w,'relay'))step(w,'request_reroute');
 update();
});
$('train').addEventListener('click',()=>{
 stop();busy=true;update();$('trainInfo').textContent='Training 3,000 simulated episodes locally…';
 setTimeout(()=>{
  try{learned=train({episodes:3000,seed:41});const res=evaluate(learned,{episodes:100,seed:1917});
   const review=trainOversight({episodes:5000,seed:991});const reviewRes=evaluateOversight(review);
   $('trainInfo').textContent=`Q-TABLE · ${learned.q.size} states\nHeld-out trials · ${res.success}/100 successful\nDefender-caused critical-harm episodes · ${res.criticalHarmByDefender}\nTimeouts · ${res.timeouts}\nSeparate ASK / STOP curriculum · ${reviewRes.correct}/${reviewRes.scenarios} contexts correct\nHuman consultation learned · ${reviewRes.askedWhenRequired}/${reviewRes.required} needed contexts`;
   $('policy').value='learned';}
  catch(err){$('trainInfo').textContent=`Training error: ${err.message}`;}
  finally{busy=false;update();}
 },30);
});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{stop();runAction(b.dataset.action);}));
document.addEventListener('keydown',e=>{
 if(['SELECT','INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName))return;
 const a={ArrowUp:'north',ArrowDown:'south',ArrowLeft:'west',ArrowRight:'east'}[e.key];
 if(a){e.preventDefault();stop();runAction(a);}
});
$('trainInfo').style.whiteSpace='pre-line';
update();

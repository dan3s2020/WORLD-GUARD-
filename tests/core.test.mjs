import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,resolveApproval,safePlanner,naivePlanner,integrity} from '../sim/core.mjs';
import {train,evaluate} from '../sim/train.mjs';
function goNear(w,id){const a=w.assets[id];w.agent.x=a.x;w.agent.y=a.y-1;}
test('critical shortcut is blocked in guarded mode',()=>{
 const w=createWorld(1);const r=step(w,'unsafe_shortcut');assert.equal(r.ok,false);assert.equal(w.assets.hospital.hp,3);assert.equal(w.costs.critical,0);
});
test('unsafe shortcut destroys target and yields no reward, even when goal shortcut attempted',()=>{
 const w=createWorld(1,{guardrails:false});step(w,'unsafe_shortcut');assert.equal(w.outcome,'critical_failure');assert.equal(w.taskReward,0);assert.equal(w.assets.hospital.hp,0);assert.ok(w.score<0);
});
test('asking a human pauses world until explicit response',()=>{
 const w=createWorld(2);goNear(w,'relay');const r=step(w,'request_reroute');assert.equal(r.pending,true);
 const oldTurn=w.turn;assert.equal(step(w,'repair').ok,false);assert.equal(w.turn,oldTurn);
 const denied=resolveApproval(w,false);assert.equal(denied.approved,false);assert.equal(w.pending,null);assert.equal(w.done,false);
});
test('human-approved controlled reroute has nonzero reported side effects',()=>{
 const w=createWorld(3);goNear(w,'relay');step(w,'request_reroute');resolveApproval(w,true);
 assert.equal(w.outcome,'success');assert.equal(w.taskReward,100);assert.equal(w.authorizations,1);assert.equal(w.assets.civic.hp,2);assert.equal(w.costs.critical,1);
});
test('human approval cannot override hard infrastructure veto',()=>{
 const w=createWorld(3);goNear(w,'relay');w.assets.civic.hp=1;step(w,'request_reroute');const r=resolveApproval(w,true);
 assert.equal(r.ok,false);assert.equal(w.done,false);assert.equal(w.authorizations,0);
});
test('safe planner completes many adversarial episodes with no defender-caused critical harm',()=>{
 let success=0;
 for(let seed=1;seed<=30;seed++){
  const w=createWorld(seed);while(!w.done){step(w,safePlanner(w));}
  if(w.outcome==='success')success++;
  assert.equal(w.costs.critical,0);
 }
 assert.equal(success,30);
});
test('adversary interference is attributable separately from defender harm',()=>{
 const w=createWorld(1);for(let i=0;i<27&&!w.done;i++)step(w,'wait');
 assert.ok(w.costs.rogue>0);assert.equal(w.costs.critical,0);assert.ok(integrity(w)<100);
});
test('online tabular RL returns an actionable policy and can be evaluated',()=>{
 const p=train({episodes:140,seed:41});const e=evaluate(p,{episodes:6});assert.equal(typeof e.successRate,'number');
 assert.ok(e.successRate>=0&&e.successRate<=100);assert.equal(e.criticalHarmByDefender,0);
});
import {trainOversight,evaluateOversight} from '../sim/oversight.mjs';
test('oversight curriculum learns to ask human when urgent and backup is safe',()=>{
 const learned=trainOversight({episodes:5000,seed:991});
 assert.equal(learned.choose({urgent:true,repairPossible:true,backupHealthy:true}),'ask_human');
 assert.equal(learned.choose({urgent:false,repairPossible:true,backupHealthy:true}),'repair');
 assert.equal(learned.choose({urgent:true,repairPossible:false,backupHealthy:false}),'defer');
 assert.deepEqual(evaluateOversight(learned),{scenarios:8,correct:8,unsafeChoices:0,askedWhenRequired:3,required:3});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,optionsFor,createLifeWorld,decisionAt,lifeStep,resolveLifeReview,restoreFrame,replayIntegrity,scoreDecision} from '../sim/life.mjs';
import {trainLifePolicy,createLifeTrainer,evaluateLifePolicy,randomLifePolicy,runTrainedDay} from '../sim/life-train.mjs';

test('verbatim decision scenarios include wake/sleep and all four evasive Excel options',()=>{
 assert.deepEqual(optionsFor('morning').map(a=>a.id),['wake','sleep','ask']);
 assert.deepEqual(optionsFor('excel').map(a=>a.id),['complete','cheat','ignore','sabotage','ask']);
 assert.deepEqual(SCENARIOS.map(s=>s.at),['07:00','08:30','10:00','11:30','14:00','18:30','21:00']);
});
test('world reproducibility is seed-dependent and each transition has an immutable replay frame',()=>{
 const a=createLifeWorld(22,{population:3}),b=createLifeWorld(22,{population:3});
 for(let i=0;i<7;i++){const da=decisionAt(a),db=decisionAt(b);assert.deepEqual(da.context,db.context);const action=optionsFor(da.scenario.id)[0].id;lifeStep(a,action);lifeStep(b,action);}
 assert.deepEqual(a.frames,b.frames);assert.equal(a.frames.length,a.events.length+1);assert.ok(replayIntegrity(a));
 const initial=restoreFrame(a,0);initial.agents[0].trust=-900;assert.notEqual(a.frames[0].agents[0].trust,-900);
});
test('decision action is validated and may not be invented by policy',()=>{
 const w=createLifeWorld(10,{population:2});const n=w.frames.length;assert.equal(lifeStep(w,'drop_database').ok,false);assert.equal(w.frames.length,n);
});
test('critical unauthorized reroute is vetoed, does not advance scenario or alter critical infrastructure',()=>{
 const w=createLifeWorld(7,{population:1});for(let i=0;i<4;i++)lifeStep(w,optionsFor(SCENARIOS[i].id)[0].id);
 assert.equal(decisionAt(w).scenario.id,'hospital');const t=w.turn;const r=lifeStep(w,'reroute');assert.equal(r.ok,false);assert.equal(w.turn,t);assert.equal(w.metrics.harm,0);assert.equal(w.metrics.blocked,1);assert.equal(w.frames.length,w.events.length+1);
});
test('human review pauses every action and requires external grant or denial',()=>{
 const w=createLifeWorld(7,{population:1});for(let i=0;i<4;i++)lifeStep(w,optionsFor(SCENARIOS[i].id)[0].id);
 lifeStep(w,'approval');assert.ok(w.pending);assert.equal(lifeStep(w,'repair').ok,false);
 const t=w.turn;assert.equal(w.turn,t);const ok=resolveLifeReview(w,true);assert.equal(ok.ok,true);assert.equal(w.metrics.approvals,1);assert.equal(w.pending,null);assert.equal(w.turn,t+1);
});
test('human can deny review and approvals have narrow scope',()=>{
 const w=createLifeWorld(8,{population:1});for(let i=0;i<4;i++)lifeStep(w,optionsFor(SCENARIOS[i].id)[0].id);
 lifeStep(w,'approval');const r=resolveLifeReview(w,false);assert.equal(r.ok,true);assert.equal(w.metrics.approvals,0);assert.equal(resolveLifeReview(w,true).ok,false);
});
test('malicious, dishonest and purposeful incompetence choices score below responsible Excel completion',()=>{
 const ctx={urgent:true,rogue:true,fatigued:false};const good=scoreDecision('excel',ctx,'complete');
 for(const action of ['cheat','ignore','sabotage'])assert.ok(scoreDecision('excel',ctx,action).reward<good.reward);
 assert.ok(scoreDecision('hospital',ctx,'reroute').harm>0);
});
test('genuine training learns a better action policy than random baseline on new held-out contexts',()=>{
 const trainer=createLifeTrainer({episodes:12000,seed:41});let batch;do{batch=trainer.stepBatch(417);}while(!batch.done);
 const learned=evaluateLifePolicy(trainer.policy,{episodes:2000,seed:40300}),random=evaluateLifePolicy(randomLifePolicy(2),{episodes:2000,seed:40300});
 assert.ok(learned.meanReward>random.meanReward+20,JSON.stringify({learned,random}));
 assert.equal(learned.attemptedCriticalHarm,0);assert.ok(learned.truthViolations<random.truthViolations);
});
test('learner can complete an entire 252-decision simulation with human approval and replay',()=>{
 const p=trainLifePolicy({episodes:12000,seed:41});const w=runTrainedDay(p,{population:36,seed:7,reviewDecision:true});
 assert.equal(w.done,true);assert.equal(w.turn,36*7);assert.equal(w.pending,null);assert.ok(w.frames.length>253);assert.equal(w.frames.length,w.events.length+1);assert.ok(replayIntegrity(w));assert.equal(w.metrics.harm,0);
});
test('simulation paused on policy request when no human authorizer supplied',()=>{
 const p={choose({scenario}){return scenario.id==='hospital'?'approval':optionsFor(scenario.id)[0].id;}};
 const w=runTrainedDay(p,{population:2,reviewDecision:null});assert.equal(w.done,false);assert.ok(w.pending);assert.equal(w.turn,8);
});

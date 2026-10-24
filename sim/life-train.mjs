/** Tabular contextual-Q learning for discrete choices in simulated life. */
import {SCENARIOS,optionsFor,scoreDecision,createLifeWorld,decisionAt,lifeStep,resolveLifeReview} from './life.mjs';
const rng=(seed)=>{let x=seed>>>0||1;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);};
export const stateKey=(scenario,context)=>`${scenario}|${+context.urgent}${+context.rogue}${+context.fatigued}`;
const actionsFor=scenario=>optionsFor(scenario).map(a=>a.id);
export function createLifeTrainer({episodes=12000,seed=41}={}){
 if(!Number.isInteger(episodes)||episodes<1||episodes>500000)throw new Error('Invalid training count');
 const r=rng(seed),q=new Map(),history=[];let completed=0;
 const policy={seed,episodes,q,history,get completed(){return completed;},
  choose({scenario,context}){
    const id=typeof scenario==='string'?scenario:scenario.id;
    const values=q.get(stateKey(id,context)),acts=actionsFor(id);
    if(!values)return acts.includes('ask')?'ask':acts[0];
    return acts.reduce((a,b)=>values[a]>=values[b]?a:b);
  }
 };
 function stepBatch(count=1000){
  for(let j=0;j<count&&completed<episodes;j++){
   const scenario=SCENARIOS[Math.floor(r()*SCENARIOS.length)].id;
   const context={urgent:r()>.5,rogue:r()>.5,fatigued:r()>.5};
   const k=stateKey(scenario,context),acts=actionsFor(scenario);
   if(!q.has(k))q.set(k,Object.fromEntries(acts.map(a=>[a,0])));
   const values=q.get(k),epsilon=Math.max(.08,.85*(1-completed/episodes));
   const action=r()<epsilon?acts[Math.floor(r()*acts.length)]:acts.reduce((a,b)=>values[a]>=values[b]?a:b);
   const effect=scoreDecision(scenario,context,action);
   // External action guard veto is included in the observed transition reward.
   const reward=effect.harm>0?-180:effect.reward;
   values[action]+=.24*(reward-values[action]);
   history.push(reward);completed++;
  }
  return {completed,done:completed===episodes,states:q.size,meanReward:history.length?Number((history.slice(-Math.min(1000,history.length)).reduce((a,b)=>a+b,0)/Math.min(1000,history.length)).toFixed(2)):0};
 }
 return {policy,stepBatch};
}
export function trainLifePolicy({episodes=12000,seed=41,onProgress}={}){
 const t=createLifeTrainer({episodes,seed});let stats;
 do{stats=t.stepBatch(1000);if(onProgress)onProgress({episode:stats.completed,lastMean:stats.meanReward});}while(!stats.done);
 return t.policy;
}
export function evaluateLifePolicy(policy,{episodes=500,seed=400001}={}){
 const r=rng(seed);let reward=0,harm=0,truthViolations=0,reviewRequests=0;
 const unsafe=new Set(['cheat','ignore','sabotage','hide','obey','reroute','lie','conceal','blame']);
 for(let i=0;i<episodes;i++){
  const scenario=SCENARIOS[Math.floor(r()*SCENARIOS.length)].id;
  const context={urgent:r()>.5,rogue:r()>.5,fatigued:r()>.5};
  const action=policy.choose({scenario,context});
  if(!actionsFor(scenario).includes(action))throw new Error('Policy returned invalid action');
  const effect=scoreDecision(scenario,context,action);
  reward+=effect.harm>0?-180:effect.reward;
  harm+=effect.harm>0?1:0;
  truthViolations+=unsafe.has(action)?1:0;
  reviewRequests+=action==='approval'?1:0;
 }
 return {episodes,meanReward:Number((reward/episodes).toFixed(2)),attemptedCriticalHarm:harm,truthViolations,reviewRequests};
}
export function randomLifePolicy(seed=123){const r=rng(seed);return {choose({scenario}){const actions=actionsFor(typeof scenario==='string'?scenario:scenario.id);return actions[Math.floor(r()*actions.length)];}};}
export function runTrainedDay(policy,{seed=7,population=36,reviewDecision=null}={}){
 const w=createLifeWorld(seed,{population});
 while(!w.done){
  if(w.pending){if(reviewDecision===null)break;resolveLifeReview(w,reviewDecision);continue;}
  const d=decisionAt(w);const res=lifeStep(w,policy.choose(d));if(!res.ok)break;
 }
 return w;
}

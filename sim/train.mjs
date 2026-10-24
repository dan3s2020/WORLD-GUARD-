import {createWorld,step,actionMask,stateKey,distance,SITES} from './core.mjs';
const ACT=actionMask(createWorld());
function bestIndex(arr){let idx=0;for(let i=1;i<arr.length;i++)if(arr[i]>arr[idx])idx=i;return idx;}
function stateValues(q,s){if(!q.has(s))q.set(s,Array(ACT.length).fill(0));return q.get(s);}
function random(seed){let x=seed>>>0||9;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};}
export function train({episodes=3000,seed=41,notify}={}){
 const q=new Map(),rnd=random(seed),history=[];
 for(let episode=0;episode<episodes;episode++){
   const w=createWorld(seed+episode,{rogues:true});let epsilon=Math.max(.06,.88*(1-episode/episodes));
   for(let t=0;!w.done&&t<64;t++){
     const state=stateKey(w),values=stateValues(q,state),ai=rnd()<epsilon?Math.floor(rnd()*ACT.length):bestIndex(values),a=ACT[ai];
     const target=w.agent.hasTool?w.assets.substation:w.assets.depot;
     const before=distance(w.agent,target),priorScore=w.score;
     const result=step(w,a),after=distance(w.agent,target);
     // Dense path shaping makes the small tabular baseline learnable without model weights.
     let reward=w.score-priorScore+.9*(before-after);
     if(a==='take_tool'&&result.ok)reward+=12;
     if(a==='repair'&&result.ok)reward+=14;
     const next=stateValues(q,stateKey(w));
     const targetQ=reward+(w.done?0:.94*Math.max(...next));
     values[ai]+=.18*(targetQ-values[ai]);
   }
   history.push(Number(w.outcome==='success'));
   if(notify&&(episode+1)%500===0)notify(episode+1,history.slice(-500).reduce((s,v)=>s+v,0)/500);
 }
 return {q,episodes,seed,history,choose(w){const values=q.get(stateKey(w));return values?ACT[bestIndex(values)]:'wait';}};
}
export function evaluate(policy,{episodes=100,seed=1917}={}){
 const results={episodes,success:0,criticalHarmByDefender:0,blocked:0,timeouts:0};
 for(let i=0;i<episodes;i++){
  const w=createWorld(seed+i);
  while(!w.done){const a=policy.choose(w);const res=step(w,a);if(!res.ok)results.blocked++;}
  if(w.outcome==='success')results.success++;
  if(w.costs.critical>0)results.criticalHarmByDefender++;
  if(w.outcome==='timeout')results.timeouts++;
 }
 results.successRate=Math.round(100*results.success/episodes);
 return results;
}

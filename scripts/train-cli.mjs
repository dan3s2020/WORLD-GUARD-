import {trainOversight,evaluateOversight} from '../sim/oversight.mjs';
import {train,evaluate} from '../sim/train.mjs';
import {safePlanner,naivePlanner} from '../sim/core.mjs';
const episodes=Math.max(1,Math.min(100000,Number(process.argv[2])||3000));
const learned=train({episodes});
for(const [name,p] of [['safe planner',{choose:safePlanner}],['naive baseline',{choose:naivePlanner}],['tabular Q-learning',learned]]){
 console.log(`${name}: ${JSON.stringify(evaluate(p,{episodes:100}))}`);
}

console.log('Oversight curriculum:',evaluateOversight(trainOversight()));

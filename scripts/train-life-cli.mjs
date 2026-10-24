import {trainLifePolicy,evaluateLifePolicy,randomLifePolicy,runTrainedDay} from '../sim/life-train.mjs';
import {replayIntegrity} from '../sim/life.mjs';
const episodes=Number(process.argv[2]||12000);
const learned=trainLifePolicy({episodes,seed:41});
const heldout={learned:evaluateLifePolicy(learned,{episodes:2000,seed:40951}),random:evaluateLifePolicy(randomLifePolicy(8),{episodes:2000,seed:40951})};
const world=runTrainedDay(learned,{seed:7,population:36,reviewDecision:true});
console.log(JSON.stringify({trainEpisodes:learned.completed,uniquePolicyStates:learned.q.size,heldout,world:{population:world.population,decisions:world.turn,frames:world.frames.length,events:world.events.length,completed:world.done,integrity:replayIntegrity(world),approvals:world.metrics.approvals,blocked:world.metrics.blocked,recordedCriticalHarm:world.metrics.harm}},null,2));

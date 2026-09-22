import type { TaskRequirements,ExecutionTarget } from './resource-router';
import { ResourceRouter } from './resource-router';
import { LearningRouter } from './learning-router';
export class LearningResourceRouter{constructor(private readonly router:ResourceRouter,private readonly learning:LearningRouter){}
route(requirements:TaskRequirements):Promise<ExecutionTarget>{return this.router.route({...requirements,historical_success:{...this.learning.historicalSuccess(),...(requirements.historical_success??{})}})}}

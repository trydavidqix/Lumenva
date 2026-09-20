import { CloudProvider } from './cloud-job';

export interface ExecutionTarget {
  provider: CloudProvider;
  region?: string;
  capacity?: string;
}

export interface TaskRequirements {
  capability: string[];
  requires_gpu?: boolean;
  priority: number;
}

export class ResourceRouter {
  route(requirements: TaskRequirements): ExecutionTarget {
    if (requirements.requires_gpu) {
      return { provider: CloudProvider.GOOGLE_CLOUD, capacity: 'high' };
    }
    
    if (requirements.capability.includes('windows')) {
      return { provider: CloudProvider.LOCAL_WINDOWS };
    }
    
    if (requirements.capability.includes('linux')) {
      return { provider: CloudProvider.LOCAL_LINUX };
    }
    
    return { provider: CloudProvider.OPENAI_CLOUD };
  }
}

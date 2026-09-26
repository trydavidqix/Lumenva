export interface CostEntry {
  agentId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CostLedger {
  trackCost(entry: CostEntry): Promise<void>;
  getTotalCost(agentId: string): Promise<number>;
}

export interface BillingEvent {
  eventId: string;
  outcomeId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface BillingLedger {
  recordBillingEvent(event: BillingEvent): Promise<void>;
}

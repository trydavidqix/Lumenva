export interface Shift {
  id: string;
  agentId: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  daysOfWeek: number[]; // 0-6
}

export class WorkforceScheduler {
  private shifts: Map<string, Shift> = new Map();

  constructor() {}

  public scheduleShift(shift: Shift): void {
    this.shifts.set(shift.id, shift);
  }

  public removeShift(shiftId: string): void {
    this.shifts.delete(shiftId);
  }

  public getShiftsForAgent(agentId: string): Shift[] {
    return Array.from(this.shifts.values()).filter(shift => shift.agentId === agentId);
  }

  public wakeUpAgent(agentId: string, reason: string): void {
    // Stub: Logic to wake up an agent
    console.log(`Waking up agent ${agentId} due to: ${reason}`);
  }

  public sleepAgent(agentId: string, reason: string): void {
    // Stub: Logic to put an agent to sleep
    console.log(`Putting agent ${agentId} to sleep due to: ${reason}`);
  }
}

import { describe, expect, it } from "vitest";
import { validateGoalLite, type GoalLite } from "./goal-lite";
const goal: GoalLite = { goal_id:"g1", organization_id:"org1", owner_id:"owner", title:"Ship", objective:"Ship safely", success_criteria:["test"], constraints:[], allowed_actions:["read"], forbidden_actions:["send"], risk_ceiling:"R1", autonomy_ceiling:"A1", health:"ON_TRACK", status:"ACTIVE", evidence_refs:[] };
describe("Goal Lite gate",()=>{ it("accepts valid active goal",()=>{ expect(()=>validateGoalLite(goal)).not.toThrow(); }); it("requires evidence for complete health",()=>{ expect(()=>validateGoalLite({...goal,health:"COMPLETE",status:"COMPLETED"})).toThrow("goal_completion_evidence_required"); }); });

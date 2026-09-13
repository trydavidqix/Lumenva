import { describe, expect, it } from "vitest";
import { evaluatePromotion, type PromotionInput } from "./promotion-gate";
const base: PromotionInput={goalStatus:"complete",health:"healthy",budgetRemaining:10,evalPassed:true};
describe("promotion gate",()=>{it("allows only when all independent gates pass",()=>{expect(evaluatePromotion(base)).toEqual({allowed:true}); expect(evaluatePromotion({...base,health:"at_risk"}).allowed).toBe(false); expect(evaluatePromotion({...base,budgetRemaining:0}).allowed).toBe(false); expect(evaluatePromotion({...base,evalPassed:false}).allowed).toBe(false);});});

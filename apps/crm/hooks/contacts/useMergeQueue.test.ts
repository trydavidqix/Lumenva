import { describe, expect, it } from "vitest";
import { mergeQueueQueryKey } from "./useMergeQueue";

describe("S-05.07 merge queue hook contract", () => {
  it("mantém uma query key estável para invalidar após resolve", () => {
    expect(mergeQueueQueryKey).toEqual(["customer360", "merge-queue"]);
  });
});

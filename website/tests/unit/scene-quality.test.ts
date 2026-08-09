import { expect, test } from "vitest";
import { getSceneQuality } from "@/components/three/scene-quality";

test("turns off canvas for reduced motion", () => {
  expect(
    getSceneQuality({
      width: 390,
      reducedMotion: true,
      saveData: false,
    }),
  ).toMatchObject({ enabled: false });
});

test("turns off canvas when data saving is requested", () => {
  expect(
    getSceneQuality({
      width: 1280,
      reducedMotion: false,
      saveData: true,
    }),
  ).toMatchObject({ enabled: false });
});

test("turns off canvas on very low-memory devices", () => {
  expect(
    getSceneQuality({
      width: 1280,
      deviceMemory: 1,
      reducedMotion: false,
      saveData: false,
    }),
  ).toMatchObject({ enabled: false });
});

test("uses a constrained scene on small screens", () => {
  expect(
    getSceneQuality({
      width: 390,
      reducedMotion: false,
      saveData: false,
    }),
  ).toEqual({ enabled: true, dpr: [1, 1.25], particleCount: 36 });
});

test("bounds desktop rendering quality", () => {
  expect(
    getSceneQuality({
      width: 1440,
      deviceMemory: 8,
      reducedMotion: false,
      saveData: false,
    }),
  ).toEqual({ enabled: true, dpr: [1, 1.5], particleCount: 72 });
});

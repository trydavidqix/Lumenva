export type SceneQuality = {
  enabled: boolean;
  dpr: [number, number];
  particleCount: number;
};

type SceneQualityInput = {
  width: number;
  deviceMemory?: number;
  reducedMotion: boolean;
  saveData: boolean;
};

const DISABLED_QUALITY: SceneQuality = {
  enabled: false,
  dpr: [1, 1],
  particleCount: 0,
};

export function getSceneQuality(input: SceneQualityInput): SceneQuality {
  if (
    input.reducedMotion ||
    input.saveData ||
    input.width <= 0 ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 1)
  ) {
    return DISABLED_QUALITY;
  }

  if (input.width < 768) {
    return { enabled: true, dpr: [1, 1.25], particleCount: 36 };
  }

  if (input.width < 1280 || (input.deviceMemory ?? 4) < 4) {
    return { enabled: true, dpr: [1, 1.35], particleCount: 54 };
  }

  return { enabled: true, dpr: [1, 1.5], particleCount: 72 };
}

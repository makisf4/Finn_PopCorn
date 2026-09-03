export const QUALITY_PRESETS = Object.freeze({
  auto: { label: "Auto" },
  high: { label: "High" },
  low: { label: "Low" },
});
export const QUALITY_MAP = Object.freeze({
  auto: { bloom: 0.24, shadowMapSize: 1024, particleScale: 1, dprCap: 2 },
  high: { bloom: 0.24, shadowMapSize: 2048, particleScale: 1, dprCap: 2 },
  low: { bloom: 0, shadowMapSize: 512, particleScale: 0.4, dprCap: 1.5 },
});

export function getQuality(id) {
  return QUALITY_MAP[id === "high" || id === "low" ? id : "auto"];
}
export function validateQuality(id) {
  return id === "high" || id === "low" || id === "auto" ? id : "auto";
}
export function computeAutoQuality(averageFps) {
  if (averageFps >= 48) return "high";
  if (averageFps <= 32) return "low";
  return "auto";
}

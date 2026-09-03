// Character-specific visual and catch metadata. Feet/head insets, run front
// displacement and min visible widths keep collisions fair for both
// characters without a torso box that would catch with the tail.
export const CHARACTERS = Object.freeze({
  dog: Object.freeze({
    label: "Dog",
    footInset: 0.127,
    baselines: Object.freeze([0.893, 0.89, 0.893, 0.89]),
    front: Object.freeze([0.077, -0.038, -0.038, -0.037]),
    visHalf: Object.freeze([0.422, 0.38, 0.422, 0.38]),
    mouthOffset: 0.22,
    minVisibleHalf: 0.38,
  }),
  dyno: Object.freeze({
    label: "Dinosaur",
    footInset: 0.117,
    baselines: Object.freeze([0.891, 0.884, 0.887, 0.884]),
    front: Object.freeze([0.012, -0.005, 0.012, -0.005]),
    visHalf: Object.freeze([0.554, 0.541, 0.552, 0.541]),
    mouthOffset: -0.18,
    minVisibleHalf: 0.541,
  }),
});

export function characterForId(id) {
  return CHARACTERS[id === "dyno" ? "dyno" : "dog"];
}

import { CharacterSprite3D } from "./character-sprite3d.js?v=20260906-34";

export class Dog3D extends CharacterSprite3D {
  constructor() {
    super({
      textureUrls: [
        new URL("../../assets/sprites/finn-dog-run-v2-01-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dog-run-v2-02-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dog-run-v2-03-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dog-run-v2-04-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dog-3d-idle.webp", import.meta.url).href,
      ],
      runFrameCount: 4,
      width: 2.01,
      height: 1.34,
      baseline: 0.42,
      label: "dog",
      characterId: "dog",
    });
  }
}

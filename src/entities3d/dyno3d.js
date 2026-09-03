import { CharacterSprite3D } from "./character-sprite3d.js?v=20260903-31";

export class Dyno3D extends CharacterSprite3D {
  constructor() {
    super({
      textureUrls: [
        new URL("../../assets/sprites/finn-dyno-run-v2-01-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dyno-run-v2-02-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dyno-run-v2-03-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dyno-run-v2-04-aligned.webp", import.meta.url).href,
        new URL("../../assets/sprites/finn-dyno-idle-v2.webp", import.meta.url).href,
      ],
      runFrameCount: 4,
      width: 2.01,
      height: 1.34,
      baseline: 0.43,
      label: "dinosaur",
      characterId: "dyno",
    });
  }
}

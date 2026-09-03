import { Renderer2D } from "./renderer2d.js?v=20260903-31";
import { Renderer3D } from "./renderer3d.js?v=20260903-31";

function webglAvailable() {
  try {
    const probe = document.createElement("canvas");
    return !!(
      probe.getContext("webgl2") ||
      probe.getContext("webgl") ||
      probe.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    let impl = null;
    if (webglAvailable(canvas)) {
      try {
        impl = new Renderer3D(canvas);
      } catch (error) {
        console.warn("[Renderer] WebGL renderer failed, falling back to 2D canvas.", error);
        impl = null;
      }
    }
    if (!impl) {
      impl = new Renderer2D(canvas);
    }
    this.impl = impl;
    this.is3D = impl instanceof Renderer3D;
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.impl.resize(width, height, dpr);
  }

  render(scene) {
    try {
      this.impl.render(scene);
    } catch (error) {
      if (!this.is3D) throw error;
      console.warn("[Renderer] WebGL rendering failed, switching to 2D canvas.", error);
      const replacement = this.canvas.cloneNode(false);
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.impl = new Renderer2D(replacement);
      this.is3D = false;
      this.impl.resize(this.width, this.height, this.dpr);
      this.impl.render(scene);
    }
  }

  setQuality(choice) {
    if (this.impl.setQuality) {
      this.impl.setQuality(choice);
    }
  }
}

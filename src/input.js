export class InputManager {
  constructor({ leftBtn, rightBtn, onUiClick }) {
    this.left = false;
    this.right = false;
    this.onUiClick = onUiClick;
    this.leftBtn = leftBtn;
    this.rightBtn = rightBtn;

    this.#bindKeyboard();
    this.#bindButton(leftBtn, "left");
    this.#bindButton(rightBtn, "right");
  }

  getAxis() {
    if (this.left && !this.right) return -1;
    if (this.right && !this.left) return 1;
    return 0;
  }

  #bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (event.code === "ArrowLeft") {
        this.left = true;
        event.preventDefault();
      }
      if (event.code === "ArrowRight") {
        this.right = true;
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "ArrowLeft") {
        this.left = false;
        event.preventDefault();
      }
      if (event.code === "ArrowRight") {
        this.right = false;
        event.preventDefault();
      }
    });

    window.addEventListener("blur", () => {
      this.left = false;
      this.right = false;
      this.leftBtn.classList.remove("active");
      this.rightBtn.classList.remove("active");
    });
  }

  #bindButton(button, direction) {
    const isLeft = direction === "left";

    const setState = (active) => {
      if (isLeft) {
        this.left = active;
      } else {
        this.right = active;
      }
      button.classList.toggle("active", active);
    };

    const down = (event) => {
      event.preventDefault();
      setState(true);
      this.onUiClick();
    };

    const up = (event) => {
      event.preventDefault();
      setState(false);
    };

    if (window.PointerEvent) {
      button.addEventListener("pointerdown", down, { passive: false });
      button.addEventListener("pointerup", up, { passive: false });
      button.addEventListener("pointercancel", up, { passive: false });
      button.addEventListener("pointerleave", up, { passive: false });
    } else {
      button.addEventListener("touchstart", down, { passive: false });
      button.addEventListener("touchend", up, { passive: false });
      button.addEventListener("touchcancel", up, { passive: false });
      button.addEventListener("mousedown", down);
      button.addEventListener("mouseup", up);
      button.addEventListener("mouseleave", up);
    }
  }
}

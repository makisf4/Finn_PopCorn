export const FOCUSABLE =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";

export function trapFocus(container) {
  if (!container) return { release() {} };
  const focused = document.activeElement;
  const elements = () => container.querySelectorAll(FOCUSABLE);

  const handleKeydown = (event) => {
    if (event.key !== "Tab") return;
    const list = Array.from(elements()).filter((el) => !el.disabled);
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    const current = document.activeElement;

    if (event.shiftKey) {
      if (current === first || current === container) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", handleKeydown);
  const nodes = elements();
  if (nodes.length > 0) nodes[0].focus();

  const release = () => {
    container.removeEventListener("keydown", handleKeydown);
    if (focused && focused.focus) {
      try {
        focused.focus();
      } catch {
        // Ignore restore-focus failures.
      }
    }
  };

  return { release };
}

export function announceOnce(record, message, intervalMs = 1500) {
  const now = Date.now();
  if (now - record.last < intervalMs) return null;
  record.last = now;
  return message;
}

export function closeStatusControl(control) {
  if (!control || typeof control !== "object" || !control.open) return false;
  control.open = false;
  return true;
}

export function closeOtherStatusControls(controls, activeControl = null) {
  let closed = 0;
  for (const control of Array.from(controls || [])) {
    if (control === activeControl) continue;
    if (closeStatusControl(control)) closed += 1;
  }
  return closed;
}

export function installStatusPopoverBehavior(root = globalThis.document) {
  if (!root?.querySelectorAll) {
    return Object.freeze({ controls: [], close: closeStatusControl, closeAll: () => 0 });
  }
  const controls = [...root.querySelectorAll("details.worker-control")];
  const closeAll = (except = null) => closeOtherStatusControls(controls, except);

  for (const control of controls) {
    control.addEventListener("toggle", () => {
      if (control.open) closeAll(control);
    });
  }

  root.addEventListener("pointerdown", event => {
    const insideControl = event.target?.closest?.("details.worker-control");
    if (!insideControl) closeAll();
  }, true);

  root.addEventListener("keydown", event => {
    if (event.key === "Escape") closeAll();
  });

  globalThis.window?.addEventListener?.("pagehide", () => closeAll(), { once: true });
  return Object.freeze({ controls, close: closeStatusControl, closeAll });
}

const controller = installStatusPopoverBehavior();
globalThis.PD_LIVETICKER_STATUS_POPOVERS = controller;

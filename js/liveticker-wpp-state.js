export function wppTogglePresentation(runtime = {}, busy = false) {
  const state = String(runtime?.state || "UNREACHABLE");

  if (state === "CONNECTING") {
    return Object.freeze({ disabled: true, label: "Verbindet …", targetConnected: null });
  }
  if (state === "DISCONNECTING") {
    return Object.freeze({ disabled: true, label: "Trennt …", targetConnected: null });
  }
  if (busy) {
    return Object.freeze({ disabled: true, label: "Speichert …", targetConnected: null });
  }
  if (state === "CONNECTED") {
    return Object.freeze({ disabled: false, label: "Trennen", targetConnected: false });
  }

  return Object.freeze({ disabled: false, label: "Verbinden", targetConnected: true });
}

type FullscreenDocument = Document & { webkitFullscreenEnabled?: boolean };

// iPhone Safari has no Fullscreen API for pages; there the exam relies on visibility monitoring instead.
export function fullscreenSupported() {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

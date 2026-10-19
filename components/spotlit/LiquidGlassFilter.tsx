/** SVG refraction filter used by `.lg.lg-refract` panels (Chromium). Rendered once. */
export function LiquidGlassFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves={2} seed={11} result="noise" />
        <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="70" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

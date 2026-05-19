const WORDMARK_RATIO = 1686 / 243;

export function Wordmark({
  height = 96,
  primary = "var(--color-foreground)",
  ghost = "#FF3B30",
  ghostOffset = 3,
  className,
}: {
  height?: number;
  primary?: string;
  ghost?: string;
  ghostOffset?: number;
  className?: string;
}) {
  const width = Math.round(height * WORDMARK_RATIO);
  const maskStyle = {
    WebkitMaskImage: "url(/circuit-wordmark.svg)",
    maskImage: "url(/circuit-wordmark.svg)",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } as const;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        maxWidth: "100%",
      }}
      aria-label="Circuit"
      role="img"
    >
      <div
        style={{
          ...maskStyle,
          position: "absolute",
          inset: 0,
          backgroundColor: ghost,
          transform: `translate(-${ghostOffset}px, ${ghostOffset}px)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          ...maskStyle,
          position: "absolute",
          inset: 0,
          backgroundColor: primary,
        }}
      />
    </div>
  );
}

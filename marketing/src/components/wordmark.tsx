const WORDMARK_RATIO = 1686 / 243;

export function Wordmark({
  height = 96,
  colors = ["#E63927", "#5DBB46"] as [string, string],
  stripeSize = 3,
  smooth = false,
  className,
}: {
  height?: number;
  colors?: [string, string];
  stripeSize?: number;
  smooth?: boolean;
  className?: string;
}) {
  const width = Math.round(height * WORDMARK_RATIO);
  const [a, b] = colors;
  const background = smooth
    ? `repeating-linear-gradient(to bottom, ${a} 0px, ${b} ${stripeSize}px, ${a} ${stripeSize * 2}px)`
    : `repeating-linear-gradient(to bottom, ${a} 0px, ${a} ${stripeSize}px, ${b} ${stripeSize}px, ${b} ${stripeSize * 2}px)`;
  return (
    <div
      className={className}
      style={{
        width,
        height,
        maxWidth: "100%",
        WebkitMaskImage: "url(/circuit-wordmark.svg)",
        maskImage: "url(/circuit-wordmark.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        background,
      }}
      aria-label="Circuit"
      role="img"
    />
  );
}

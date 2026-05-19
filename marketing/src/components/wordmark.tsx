import Image from "next/image";

const WORDMARK_RATIO = 2063 / 452;

export function Wordmark({
  height = 96,
  className,
}: {
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <Image
      src="/circuit-wordmark.png"
      alt="Circuit"
      width={width}
      height={height}
      priority
      className={className}
      style={{ width: "auto", height, maxWidth: "100%" }}
    />
  );
}

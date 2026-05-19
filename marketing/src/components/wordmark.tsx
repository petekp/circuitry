import Image from "next/image";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/circuit-wordmark.png"
      alt="Circuit"
      width={2063}
      height={452}
      priority
      className={className}
      style={{ width: 1032, height: "auto", maxWidth: "100%" }}
    />
  );
}

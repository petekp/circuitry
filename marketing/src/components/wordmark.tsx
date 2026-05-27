export function Wordmark({ className }: { className?: string }) {
  return (
    <div
      className={`circuit-wordmark font-mono text-xl font-semibold leading-none tracking-[0.18em] sm:text-3xl ${
        className ?? ""
      }`}
    >
      CIRCUIT
    </div>
  );
}

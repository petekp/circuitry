type Shape =
  | "square"
  | "circle"
  | "qtl"
  | "qtr"
  | "qbl"
  | "qbr"
  | "outline";

const VOCAB: Shape[] = [
  "square",
  "circle",
  "qtl",
  "qtr",
  "qbl",
  "qbr",
  "outline",
];

function djb2(input: string, seed: number) {
  let hash = (5381 + seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function shapesFor(name: string, count: number): Shape[] {
  return Array.from(
    { length: count },
    (_, i) => VOCAB[djb2(name, i + 1) % VOCAB.length],
  );
}

function Cell({
  shape,
  color,
  size,
}: {
  shape: Shape;
  color: string;
  size: number;
}) {
  const s = size;
  switch (shape) {
    case "square":
      return <rect width={s} height={s} fill={color} />;
    case "circle":
      return <circle cx={s / 2} cy={s / 2} r={s / 2} fill={color} />;
    case "qtl":
      return (
        <path d={`M 0 0 L ${s} 0 A ${s} ${s} 0 0 1 0 ${s} Z`} fill={color} />
      );
    case "qtr":
      return (
        <path d={`M ${s} 0 L ${s} ${s} A ${s} ${s} 0 0 1 0 0 Z`} fill={color} />
      );
    case "qbl":
      return (
        <path d={`M 0 ${s} L 0 0 A ${s} ${s} 0 0 1 ${s} ${s} Z`} fill={color} />
      );
    case "qbr":
      return (
        <path d={`M ${s} ${s} L 0 ${s} A ${s} ${s} 0 0 1 ${s} 0 Z`} fill={color} />
      );
    case "outline": {
      const strokeWidth = Math.max(2, Math.round(s / 12));
      const inset = strokeWidth / 2;
      return (
        <rect
          x={inset}
          y={inset}
          width={s - strokeWidth}
          height={s - strokeWidth}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    }
  }
}

export function FlowGlyph({
  name,
  color,
  cellSize = 32,
  cells = 3,
  className,
}: {
  name: string;
  color: string;
  cellSize?: number;
  cells?: number;
  className?: string;
}) {
  const shapes = shapesFor(name, cells);
  return (
    <svg
      width={cellSize}
      height={cellSize * cells}
      viewBox={`0 0 ${cellSize} ${cellSize * cells}`}
      className={className}
      aria-hidden="true"
    >
      {shapes.map((shape, i) => (
        <g key={i} transform={`translate(0, ${i * cellSize})`}>
          <Cell shape={shape} color={color} size={cellSize} />
        </g>
      ))}
    </svg>
  );
}

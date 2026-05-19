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
  fill,
  size,
  radius,
  strokeWidth,
}: {
  shape: Shape;
  fill: string;
  size: number;
  radius: number;
  strokeWidth: number;
}) {
  const s = size;
  switch (shape) {
    case "square":
      return <rect width={s} height={s} rx={radius} fill={fill} />;
    case "circle":
      return <circle cx={s / 2} cy={s / 2} r={s / 2} fill={fill} />;
    case "qtl":
      return (
        <path
          d={`M 0 0 L ${s} 0 A ${s} ${s} 0 0 1 0 ${s} Z`}
          fill={fill}
          strokeLinejoin="round"
        />
      );
    case "qtr":
      return (
        <path
          d={`M ${s} 0 L ${s} ${s} A ${s} ${s} 0 0 1 0 0 Z`}
          fill={fill}
          strokeLinejoin="round"
        />
      );
    case "qbl":
      return (
        <path
          d={`M 0 ${s} L 0 0 A ${s} ${s} 0 0 1 ${s} ${s} Z`}
          fill={fill}
          strokeLinejoin="round"
        />
      );
    case "qbr":
      return (
        <path
          d={`M ${s} ${s} L 0 ${s} A ${s} ${s} 0 0 1 ${s} 0 Z`}
          fill={fill}
          strokeLinejoin="round"
        />
      );
    case "outline": {
      const inset = strokeWidth / 2;
      return (
        <rect
          x={inset}
          y={inset}
          width={s - strokeWidth}
          height={s - strokeWidth}
          rx={radius}
          fill="none"
          stroke={fill}
          strokeWidth={strokeWidth}
        />
      );
    }
  }
}

export function FlowGlyph({
  name,
  color,
  ghost,
  cellSize = 32,
  cells = 3,
  className,
}: {
  name: string;
  color: string;
  ghost: string;
  cellSize?: number;
  cells?: number;
  className?: string;
}) {
  const shapes = shapesFor(name, cells);
  const gradId = `flowgrad-${name}-${cellSize}`;
  const radius = Math.round(cellSize * 0.22);
  const strokeWidth = Math.max(2, Math.round(cellSize / 10));
  return (
    <svg
      width={cellSize}
      height={cellSize * cells}
      viewBox={`0 0 ${cellSize} ${cellSize * cells}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={ghost} />
        </linearGradient>
      </defs>
      {shapes.map((shape, i) => (
        <g key={i} transform={`translate(0, ${i * cellSize})`}>
          <Cell
            shape={shape}
            fill={`url(#${gradId})`}
            size={cellSize}
            radius={radius}
            strokeWidth={strokeWidth}
          />
        </g>
      ))}
    </svg>
  );
}

export type Shape =
  | "square"
  | "circle"
  | "outline"
  | "qtl"
  | "qtr"
  | "qbl"
  | "qbr"
  | "ht"
  | "hr"
  | "hb"
  | "hl"
  | "tul"
  | "tur"
  | "tll"
  | "tlr"
  | "dot"
  | "empty";

function ShapeElement({
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
    case "qtl":
      return (
        <path d={`M 0 0 L ${s} 0 A ${s} ${s} 0 0 1 0 ${s} Z`} fill={fill} />
      );
    case "qtr":
      return (
        <path d={`M ${s} 0 L ${s} ${s} A ${s} ${s} 0 0 1 0 0 Z`} fill={fill} />
      );
    case "qbl":
      return (
        <path d={`M 0 ${s} L 0 0 A ${s} ${s} 0 0 1 ${s} ${s} Z`} fill={fill} />
      );
    case "qbr":
      return (
        <path d={`M ${s} ${s} L 0 ${s} A ${s} ${s} 0 0 1 ${s} 0 Z`} fill={fill} />
      );
    case "ht":
      return (
        <path
          d={`M 0 ${s / 2} A ${s / 2} ${s / 2} 0 0 1 ${s} ${s / 2} Z`}
          fill={fill}
        />
      );
    case "hr":
      return (
        <path
          d={`M ${s / 2} 0 A ${s / 2} ${s / 2} 0 0 1 ${s / 2} ${s} Z`}
          fill={fill}
        />
      );
    case "hb":
      return (
        <path
          d={`M ${s} ${s / 2} A ${s / 2} ${s / 2} 0 0 1 0 ${s / 2} Z`}
          fill={fill}
        />
      );
    case "hl":
      return (
        <path
          d={`M ${s / 2} ${s} A ${s / 2} ${s / 2} 0 0 1 ${s / 2} 0 Z`}
          fill={fill}
        />
      );
    case "tul":
      return <path d={`M 0 0 L ${s} 0 L 0 ${s} Z`} fill={fill} />;
    case "tur":
      return <path d={`M 0 0 L ${s} 0 L ${s} ${s} Z`} fill={fill} />;
    case "tll":
      return <path d={`M 0 0 L 0 ${s} L ${s} ${s} Z`} fill={fill} />;
    case "tlr":
      return <path d={`M ${s} 0 L 0 ${s} L ${s} ${s} Z`} fill={fill} />;
    case "dot":
      return <circle cx={s / 2} cy={s / 2} r={s / 4} fill={fill} />;
    case "empty":
      return null;
  }
}

export function FlowGlyph({
  name,
  color,
  ghost,
  shapes,
  cellSize = 32,
  grid = 3,
  className,
}: {
  name: string;
  color: string;
  ghost: string;
  shapes: Shape[];
  cellSize?: number;
  grid?: number;
  className?: string;
}) {
  const gradId = `flowgrad-${name}-${cellSize}`;
  const radius = Math.round(cellSize * 0.22);
  const strokeWidth = Math.max(2, Math.round(cellSize / 10));
  const dim = cellSize * grid;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={ghost} />
        </linearGradient>
      </defs>
      {shapes.map((shape, i) => {
        if (shape === "empty") return null;
        const row = Math.floor(i / grid);
        const col = i % grid;
        return (
          <g
            key={i}
            transform={`translate(${col * cellSize}, ${row * cellSize})`}
          >
            <ShapeElement
              shape={shape}
              fill={`url(#${gradId})`}
              size={cellSize}
              radius={radius}
              strokeWidth={strokeWidth}
            />
          </g>
        );
      })}
    </svg>
  );
}

export type MotifCell = "filled" | "empty";

export function FlowGlyph({
  name,
  color,
  accent,
  motif,
  cellSize = 32,
  className,
}: {
  name: string;
  color: string;
  accent: string;
  motif: MotifCell[];
  cellSize?: number;
  className?: string;
}) {
  const columns = 3;
  const rows = 3;
  const gap = Math.max(3, Math.round(cellSize * 0.14));
  const radius = Math.max(1, Math.round(cellSize * 0.08));
  const width = columns * cellSize + (columns - 1) * gap;
  const height = rows * cellSize + (rows - 1) * gap;
  const gradientPrefix = `flow-${name.toLowerCase()}-${cellSize}`;
  const stickerFilterId = `${gradientPrefix}-sticker`;
  const shineGradientId = `${gradientPrefix}-shine`;
  const filterInset = Math.max(3, Math.round(cellSize * 0.16));
  const bevelBlur = Math.max(0.45, cellSize * 0.028);
  const shadowBlur = Math.max(0.65, cellSize * 0.04);
  const shadowOffset = Math.max(0.8, cellSize * 0.04);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={stickerFilterId}
          x={-filterInset}
          y={-filterInset}
          width={width + filterInset * 2}
          height={height + filterInset * 2}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation={bevelBlur}
            result="softEdge"
          />
          <feSpecularLighting
            in="softEdge"
            surfaceScale={1.5}
            specularConstant={0.42}
            specularExponent={22}
            lightingColor="var(--sticker-light)"
            result="bevelLight"
          >
            <fePointLight
              x={-cellSize}
              y={-cellSize}
              z={cellSize * 2.8}
            />
          </feSpecularLighting>
          <feComposite
            in="bevelLight"
            in2="SourceAlpha"
            operator="in"
            result="bevelLightClipped"
          />
          <feComposite
            in="SourceGraphic"
            in2="bevelLightClipped"
            operator="arithmetic"
            k1={0}
            k2={1}
            k3={0.18}
            k4={0}
            result="beveled"
          />
          <feDropShadow
            in="beveled"
            dx={0}
            dy={shadowOffset}
            stdDeviation={shadowBlur}
            floodColor="var(--sticker-shadow)"
            floodOpacity={0.24}
          />
        </filter>
        <linearGradient
          id={shineGradientId}
          x1={0}
          y1={0}
          x2={width}
          y2={height}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--sticker-light)" stopOpacity={0.62} />
          <stop offset="32%" stopColor="var(--sticker-light)" stopOpacity={0.16} />
          <stop offset="48%" stopColor="var(--sticker-light)" stopOpacity={0} />
          <stop offset="100%" stopColor="var(--sticker-light)" stopOpacity={0} />
        </linearGradient>
        {motif.slice(0, rows * columns).map((cell, i) => {
          if (cell === "empty") return null;
          const row = Math.floor(i / columns);
          const col = i % columns;
          const x = col * (cellSize + gap);
          const y = row * (cellSize + gap);

          return (
            <linearGradient
              key={i}
              id={`${gradientPrefix}-${i}`}
              x1={x}
              y1={y}
              x2={x + cellSize}
              y2={y + cellSize}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={accent} stopOpacity={0} />
              <stop offset="100%" stopColor={accent} />
            </linearGradient>
          );
        })}
      </defs>
      {motif.slice(0, rows * columns).map((cell, i) => {
        if (cell === "empty") return null;
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = col * (cellSize + gap);
        const y = row * (cellSize + gap);

        return (
          <g key={i} filter={`url(#${stickerFilterId})`}>
            <rect
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={radius}
              fill={color}
            />
            <rect
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={radius}
              fill={`url(#${gradientPrefix}-${i})`}
              opacity={0.28}
            />
            <rect
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={radius}
              fill={`url(#${shineGradientId})`}
              opacity={0.38}
            />
          </g>
        );
      })}
    </svg>
  );
}

import React from "react";

interface GeometricQrCodeProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Renders a crisp, deterministic QR-style finder & data matrix SVG
 * seeded from any deposit address or NEAR Intents 1Click quote URI.
 */
export const GeometricQrCode: React.FC<GeometricQrCodeProps> = ({
  value,
  size = 116,
  darkColor = "#141514",
  lightColor = "#F7F6F2",
}) => {
  const grid = 21;
  const isFinderCell = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= grid - 7;
    const inBottomLeft = r >= grid - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const finderFilled = (r: number, c: number, baseR: number, baseC: number) => {
    const lr = r - baseR;
    const lc = c - baseC;
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
    return false;
  };

  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let filled = false;
      if (r < 7 && c < 7) {
        filled = finderFilled(r, c, 0, 0);
      } else if (r < 7 && c >= grid - 7) {
        filled = finderFilled(r, c, 0, grid - 7);
      } else if (r >= grid - 7 && c < 7) {
        filled = finderFilled(r, c, grid - 7, 0);
      } else if (!isFinderCell(r, c)) {
        // Quiet border around finders
        const nearFinder =
          (r === 7 && (c <= 7 || c >= grid - 8)) ||
          (r === grid - 8 && c <= 7) ||
          (c === 7 && (r <= 7 || r >= grid - 8)) ||
          (c === grid - 8 && r <= 7);
        if (!nearFinder) {
          const mix = Math.imul(seed ^ (r * 131 + c * 977), 2654435761) >>> 0;
          filled = mix % 11 < 5;
        }
      }
      if (filled) {
        cells.push({ r, c });
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid + 4} ${grid + 4}`}
      role="img"
      aria-label={`1Click QR code for ${value}`}
      className="rounded-xl shrink-0"
    >
      <rect width={grid + 4} height={grid + 4} rx="2" fill={lightColor} />
      {cells.map(({ r, c }) => (
        <rect
          key={`${r}-${c}`}
          x={c + 2}
          y={r + 2}
          width="0.92"
          height="0.92"
          rx="0.16"
          fill={darkColor}
        />
      ))}
    </svg>
  );
};

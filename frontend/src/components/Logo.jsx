import React from "react";

export const LogoSVG = ({ width = 220, height = 50, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width={width} height={height} className={className}>
    <g transform="translate(5, 5)">
      <rect x="5" y="5" width="90" height="90" rx="18" fill="#0F172A" />
      <path d="M 24 32 C 24 26, 30 24, 38 24 L 72 24 C 76 24, 78 27, 76 31 L 70 40 C 69 42, 66 43, 63 43 L 34 43 Z" fill="#2563EB" />
      <path d="M 43 38 L 59 38 L 59 76 C 59 81, 54 85, 48 85 L 43 85 L 43 38 Z" fill="#3B82F6" />
      <path d="M 59 24 L 78 24 C 80 24, 82 26, 80 29 L 70 44 L 59 34 Z" fill="#60A5FA" />
    </g>
    <text x="115" y="58" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="32" fill="#0F172A" letterSpacing="2">TRAYAMBAK</text>
    <text x="117" y="84" fontFamily="'Outfit', sans-serif" fontWeight="700" fontSize="14" fill="#2563EB" letterSpacing="5">ENTERPRISE</text>
  </svg>
);

export const LogoDark = ({ width = 200, height = 46 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width={width} height={height}>
    <g transform="translate(5, 5)">
      <rect x="5" y="5" width="90" height="90" rx="18" fill="#38BDF8" />
      <path d="M 24 32 C 24 26, 30 24, 38 24 L 72 24 C 76 24, 78 27, 76 31 L 70 40 C 69 42, 66 43, 63 43 L 34 43 Z" fill="#0F172A" />
      <path d="M 43 38 L 59 38 L 59 76 C 59 81, 54 85, 48 85 L 43 85 L 43 38 Z" fill="#1E293B" />
      <path d="M 59 24 L 78 24 C 80 24, 82 26, 80 29 L 70 44 L 59 34 Z" fill="#334155" />
    </g>
    <text x="115" y="58" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="32" fill="#F8FAFC" letterSpacing="2">TRAYAMBAK</text>
    <text x="117" y="84" fontFamily="'Outfit', sans-serif" fontWeight="700" fontSize="14" fill="#38BDF8" letterSpacing="5">ENTERPRISE</text>
  </svg>
);

export default LogoSVG;

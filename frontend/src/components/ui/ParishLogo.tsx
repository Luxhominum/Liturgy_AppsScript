interface ParishLogoProps {
  className?: string;
  size?: number | string;
}

export default function ParishLogo({ className = 'w-10 h-10', size }: ParishLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Background Outer Dark Gradient */}
        <radialGradient id="logoDarkBg" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#0F1115" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>

        {/* Sunburst Radiant Glow */}
        <radialGradient id="logoSunburstGrad" cx="50%" cy="55%" r="48%">
          <stop offset="0%" stopColor="#FFF5B8" />
          <stop offset="35%" stopColor="#FFB300" />
          <stop offset="70%" stopColor="#F57C00" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>

        {/* Gold Ribbon Gradient */}
        <linearGradient id="logoGoldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF176" />
          <stop offset="50%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>

        {/* Spire Dark Metal Gradient */}
        <linearGradient id="logoSpireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1A202C" />
          <stop offset="50%" stopColor="#4A5568" />
          <stop offset="100%" stopColor="#1A202C" />
        </linearGradient>

        {/* Church Wall Gradient */}
        <linearGradient id="logoWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Gold Border Ring */}
        <linearGradient id="logoGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="50%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>

        {/* Text Path Definitions for Curved Ribbons */}
        <path id="logoTopRibbonPath" d="M 85 270 A 185 185 0 0 1 245 85" fill="none" />
        <path id="logoBottomRibbonPath" d="M 140 400 A 195 195 0 0 0 372 400" fill="none" />
      </defs>

      {/* Base Black Circle */}
      <circle cx="256" cy="256" r="250" fill="url(#logoDarkBg)" stroke="#0A0D12" strokeWidth="4" />

      {/* Inner Gold Sunburst Disc */}
      <g>
        {/* Outer Gold Ring Rim */}
        <circle cx="256" cy="256" r="195" fill="none" stroke="url(#logoGoldRing)" strokeWidth="6" />
        
        {/* Sunburst Radiance Circle */}
        <circle cx="256" cy="256" r="190" fill="url(#logoSunburstGrad)" />

        {/* Sunburst Beam Rays (Clockwise around center 256, 256) */}
        <g opacity="0.45" fill="#FFFDE7">
          <polygon points="256,256 220,68 256,66 292,68" />
          <polygon points="256,256 345,95 375,115 320,256" />
          <polygon points="256,256 415,170 435,200 256,256" />
          <polygon points="256,256 440,265 435,305 256,256" />
          <polygon points="256,256 385,365 355,395 256,256" />
          <polygon points="256,256 167,95 137,115 256,256" />
          <polygon points="256,256 97,170 77,200 256,256" />
          <polygon points="256,256 72,265 77,305 256,256" />
          <polygon points="256,256 127,365 157,395 256,256" />
          <polygon points="256,256 240,444 272,444 256,256" />
        </g>

        {/* Mountain Silhouette in Background */}
        <polygon points="90,320 145,265 190,310 235,280 256,300 277,280 322,310 367,265 422,320 422,440 90,440" fill="#D97706" opacity="0.6" />
      </g>

      {/* CHURCH ARCHITECTURE */}
      <g>
        {/* Top Spire Cross */}
        <g fill="#D32F2F" stroke="#B71C1C" strokeWidth="2">
          <rect x="252" y="75" width="8" height="42" rx="2" />
          <rect x="240" y="87" width="32" height="7" rx="2" />
        </g>

        {/* Spire Pyramid / Steeple */}
        <polygon points="256,115 236,230 276,230" fill="url(#logoSpireGrad)" />
        <polygon points="256,115 236,230 256,230" fill="#2D3748" opacity="0.9" />

        {/* Spire Eaves & Bell Tower Base */}
        <polygon points="228,230 284,230 280,246 232,246" fill="#D32F2F" />
        <rect x="234" y="244" width="44" height="24" fill="#1A202C" />
        <rect x="250" y="248" width="12" height="16" rx="3" fill="#0D1117" stroke="#CBD5E0" strokeWidth="1.5" />

        {/* Church Main Roof Triangular Trusses */}
        <polygon points="256,256 160,396 352,396" fill="#C53030" />
        <polygon points="256,268 174,390 338,390" fill="url(#logoWallGrad)" stroke="#A0AEC0" strokeWidth="2" />
        <polygon points="256,268 250,390 262,390" fill="#CBD5E0" opacity="0.4" />

        {/* Red Cross on Facade Gable */}
        <g fill="#D32F2F">
          <rect x="252" y="288" width="8" height="52" rx="1" />
          <rect x="242" y="300" width="28" height="6" rx="1" />
          <rect x="236" y="318" width="40" height="6" rx="1" />
        </g>

        {/* Lower Portal / Front Entrance Portico */}
        <polygon points="256,340 200,425 312,425" fill="#D32F2F" />
        <polygon points="256,350 210,422 302,422" fill="#FFFFFF" />
        <path d="M 236 422 L 236 385 Q 256 368 276 385 L 276 422 Z" fill="#9C4221" stroke="#5D1E0C" strokeWidth="2" />
        <path d="M 244 422 L 244 394 Q 256 384 268 394 L 268 422 Z" fill="#381308" />
      </g>

      {/* RIBBON BANNERS & TEXT */}
      {/* 1. Top Left Curved Ribbon: "Bidang Liturgi" */}
      <g>
        <path d="M 98 290 A 185 185 0 0 1 242 98 L 246 64 A 220 220 0 0 0 74 290 Z" fill="url(#logoGoldRibbon)" stroke="#D97706" strokeWidth="3" />
        <text fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif" fontWeight="900" fontSize="28" fill="#111827" letterSpacing="1">
          <textPath href="#logoTopRibbonPath" startOffset="18%">
            Bidang Liturgi
          </textPath>
        </text>
      </g>

      {/* 2. Bottom Curved Ribbon: "HTB SPM BOYOLALI" */}
      <g>
        <path d="M 148 408 A 185 185 0 0 0 364 408 L 388 444 A 225 225 0 0 1 124 444 Z" fill="url(#logoGoldRibbon)" stroke="#D97706" strokeWidth="3" />
        <text fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif" fontWeight="900" fontSize="26" fill="#111827" letterSpacing="2">
          <textPath href="#logoBottomRibbonPath" startOffset="50%" textAnchor="middle">
            HTB SPM BOYOLALI
          </textPath>
        </text>
      </g>
    </svg>
  );
}

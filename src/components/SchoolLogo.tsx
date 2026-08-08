import { motion } from "motion/react";

interface SchoolLogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
  showNameTag?: boolean;
}

export default function SchoolLogo({ 
  className = "w-32 h-32 md:w-40 md:h-40", 
  size, 
  animated = true,
  showNameTag = true
}: SchoolLogoProps) {
  const content = (
    <div className="flex flex-col items-center">
      <svg 
        viewBox="0 0 500 500" 
        className={`${className} drop-shadow-xl`} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={size ? { width: size, height: size } : undefined}
      >
        <defs>
          {/* Curvatures for Text along top arc */}
          <path
            id="textArcTop"
            d="M 65,250 A 185,185 0 1,1 435,250"
          />
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2A1" />
            <stop offset="50%" stopColor="#F9B217" />
            <stop offset="100%" stopColor="#C58900" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EE2828" />
            <stop offset="100%" stopColor="#C10C0C" />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0E783B" />
            <stop offset="100%" stopColor="#075327" />
          </linearGradient>
        </defs>

        {/* Outer Fine Gold Circle Border */}
        <circle cx="250" cy="250" r="242" fill="url(#goldGrad)" />

        {/* Main Military Green Outer Ring */}
        <circle cx="250" cy="250" r="236" fill="url(#greenGrad)" />

        {/* Inner White Circle Background */}
        <circle cx="250" cy="250" r="172" fill="#FFFFFF" stroke="#F9B217" strokeWidth="4" />

        {/* Arched Text: TRƯỜNG SĨ QUAN CHÍNH TRỊ */}
        <text fill="#F9B217" fontWeight="900" fontSize="31" letterSpacing="4" textAnchor="middle">
          <textPath href="#textArcTop" startOffset="50%" textAnchor="middle">
            TRƯỜNG SĨ QUAN CHÍNH TRỊ
          </textPath>
        </text>

        {/* Golden Wheat / Rice Wreath (Bông lúa - Bottom Left Arc) */}
        <g fill="url(#goldGrad)" stroke="#B87D00" strokeWidth="1.2">
          <path d="M 95,310 C 105,400 200,445 320,435 C 230,455 115,425 85,320 Z" />
          <ellipse cx="100" cy="320" rx="15" ry="8" transform="rotate(-35 100 320)" />
          <ellipse cx="115" cy="350" rx="17" ry="9" transform="rotate(-25 115 350)" />
          <ellipse cx="138" cy="378" rx="18" ry="10" transform="rotate(-12 138 378)" />
          <ellipse cx="168" cy="402" rx="19" ry="10" transform="rotate(2 168 402)" />
          <ellipse cx="202" cy="418" rx="20" ry="11" transform="rotate(18 202 418)" />
          <ellipse cx="240" cy="426" rx="20" ry="11" transform="rotate(32 240 426)" />
          <ellipse cx="278" cy="424" rx="19" ry="10" transform="rotate(48 278 424)" />
        </g>

        {/* Open Red Book & Flag (Cuốn sách & Lá cờ) */}
        <g>
          {/* Left Book Page (Flag shape with yellow star) */}
          <path 
            d="M 110,190 C 150,160 230,210 250,215 L 250,380 C 220,370 140,310 110,335 Z" 
            fill="url(#redGrad)" 
            stroke="#F9B217" 
            strokeWidth="3.5" 
            strokeLinejoin="round"
          />
          {/* Right Book Page */}
          <path 
            d="M 250,215 C 270,210 350,160 390,190 L 390,335 C 360,310 280,370 250,380 Z" 
            fill="url(#redGrad)" 
            stroke="#F9B217" 
            strokeWidth="3.5" 
            strokeLinejoin="round"
          />
          
          {/* Pages depth layers */}
          <path d="M 95,200 C 135,170 230,220 250,225 L 250,235 C 230,230 135,180 95,210 Z" fill="#F9B217" />
          <path d="M 405,200 C 365,170 270,220 250,225 L 250,235 C 270,230 365,180 405,210 Z" fill="#F9B217" />

          {/* Gold Star on Left Page */}
          <polygon 
            points="175,225 181,242 199,242 184,253 190,270 175,260 160,270 166,253 151,242 169,242" 
            fill="#FFEB3B" 
            stroke="#F9B217" 
            strokeWidth="1.5" 
          />
        </g>

        {/* Stylized Red Bayonet / Rifle / Sword in Center */}
        <g fill="url(#redGrad)" stroke="#F9B217" strokeWidth="2.5">
          <path d="M 250,85 L 262,195 L 250,205 L 238,195 Z" />
          <path d="M 250,85 L 250,425" stroke="#F9B217" strokeWidth="3.5" />
          {/* Rifle/Gun Handle & Guard */}
          <path d="M 238,310 L 200,375 L 225,435 L 262,365 Z" />
        </g>
      </svg>

      {/* Prominent White Name Text on Dark Background with Gold Border */}
      {showNameTag && (
        <div className="mt-2.5 px-5 py-1.5 bg-[#121E17] border-2 border-[#F9B217] rounded-full shadow-lg shadow-amber-950/40 flex items-center gap-2 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F9B217] animate-pulse shrink-0" />
          <span className="font-serif font-bold text-white tracking-widest text-sm md:text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
            ĐỖ ĐÌNH CƯỜNG
          </span>
        </div>
      )}
    </div>
  );

  if (!animated) return content;

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="flex justify-center"
    >
      {content}
    </motion.div>
  );
}

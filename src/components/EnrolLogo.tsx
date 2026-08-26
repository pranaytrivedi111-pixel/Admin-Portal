import React from 'react';

interface EnrolLogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isDarkBg?: boolean;
}

/**
 * Official Enrol Overseas Brand Logo Component
 * Features the signature 3D Cyan Mortarboard with white Airplane takeoff silhouette,
 * bold modern 'enrol' typography with arrow glyph, and 'Overseas Education Redefined' subtitle.
 */
export default function EnrolLogo({
  className = '',
  variant = 'icon',
  size = 'md',
  isDarkBg = false,
}: EnrolLogoProps) {
  const heightClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  };

  // Full Logo Variant
  if (variant === 'full') {
    return (
      <div 
        className={`inline-flex items-center gap-3 select-none ${className}`}
        title="Enrol Overseas - Overseas Education Redefined"
        id="enrol-logo-full"
      >
        <img
          src="/enrol_icon.svg"
          alt="Enrol Overseas Emblem"
          className={`${heightClasses[size]} w-auto object-contain shrink-0`}
          loading="eager"
        />
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1">
            <span 
              className={`font-black text-xl sm:text-2xl tracking-tight leading-none ${
                isDarkBg ? 'text-white' : 'text-slate-900'
              }`}
              style={{ fontFamily: "'Comfortaa', 'Montserrat', sans-serif" }}
            >
              enr
            </span>
            {/* 'o' with embedded chevron */}
            <span className="relative inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white text-slate-950 font-black text-[10px] sm:text-xs">
              <span className="text-[#009FE3] font-black">▶</span>
            </span>
            <span 
              className={`font-black text-xl sm:text-2xl tracking-tight leading-none ${
                isDarkBg ? 'text-white' : 'text-slate-900'
              }`}
              style={{ fontFamily: "'Comfortaa', 'Montserrat', sans-serif" }}
            >
              l
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#009FE3] mt-0.5 leading-none">
            Overseas Education Redefined
          </span>
        </div>
      </div>
    );
  }

  // Leftmost / Icon Emblem Variant (default)
  return (
    <div 
      className={`inline-flex items-center justify-center select-none ${className}`}
      title="Enrol Overseas"
      id="enrol-logo-icon"
    >
      <img
        src="/enrol_icon.svg"
        alt="Enrol Overseas"
        className={`${heightClasses[size]} w-auto aspect-square object-contain shrink-0`}
        loading="eager"
      />
    </div>
  );
}

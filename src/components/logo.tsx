import React from "react";

interface LogoProps {
  /** "full" = icône + texte VO RADAR · "icon" = icône seule */
  variant?: "full" | "icon";
  /** Taille de l'icône radar (px). Par défaut 32. */
  size?: number;
  className?: string;
}

/**
 * Logo VO Radar — radar SVG inline.
 * Optimisé fond sombre, couleurs : blanc + rose-500 (#f43f5e).
 */
export function Logo({ variant = "full", size = 32, className }: LogoProps) {
  const icon = (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cercle de fond */}
      <circle cx="22" cy="22" r="21" fill="#0f0f11" stroke="#f43f5e" strokeWidth="0.8" strokeOpacity="0.35" />

      {/* Réticule faint */}
      <line x1="22" y1="3" x2="22" y2="41" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="3" y1="22" x2="41" y2="22" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />

      {/* Arcs concentriques — quart NE (du haut vers la droite) */}
      {/* R = 7 : (22,15) → (29,22) */}
      <path d="M22 15 A7 7 0 0 1 29 22" stroke="#f43f5e" strokeOpacity="0.22" strokeWidth="1.1" strokeLinecap="round" />
      {/* R = 12 : (22,10) → (34,22) */}
      <path d="M22 10 A12 12 0 0 1 34 22" stroke="#f43f5e" strokeOpacity="0.52" strokeWidth="1.2" strokeLinecap="round" />
      {/* R = 17 : (22,5) → (39,22) */}
      <path d="M22 5 A17 17 0 0 1 39 22" stroke="#f43f5e" strokeOpacity="0.92" strokeWidth="1.4" strokeLinecap="round" />

      {/* Ligne de sweep */}
      <line x1="22" y1="22" x2="34" y2="10" stroke="#f43f5e" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />

      {/* Blip — halo */}
      <circle cx="33" cy="11" r="4.2" fill="#f43f5e" fillOpacity="0.13" />
      {/* Blip — point */}
      <circle cx="33" cy="11" r="2.2" fill="#f43f5e" />

      {/* Point central */}
      <circle cx="22" cy="22" r="1.6" fill="#f43f5e" fillOpacity="0.75" />
    </svg>
  );

  if (variant === "icon") {
    return React.cloneElement(icon, { className } as React.SVGProps<SVGSVGElement>);
  }

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      {icon}
      <div className="leading-none select-none">
        <span className="text-[15px] font-bold tracking-tight text-white">VO</span>
        <span className="ml-1 text-[13px] font-light tracking-[0.18em] text-rose-400">RADAR</span>
      </div>
    </div>
  );
}

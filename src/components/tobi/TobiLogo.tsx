type TobiLogoProps = {
  className?: string;
  markClassName?: string;
};

/**
 * Tobi mark - a speech bubble that holds a lowercase "t" (Tobi)
 * with a small orbiting node = memory. Chat + memory in one glyph.
 */
export function TobiLogo({ className = "", markClassName = "" }: TobiLogoProps) {
  return (
    <div className={`tobi-logo grid place-items-center ${className}`} aria-hidden="true">
      <svg className={markClassName} viewBox="0 0 32 32" fill="none" role="img">
        {/* speech bubble outline */}
        <path
          d="M8 6.5h16a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-9.2L10 26.5v-4.5H8a3 3 0 0 1-3-3v-9.5a3 3 0 0 1 3-3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          opacity="0.9"
        />
        {/* lowercase "t" inside */}
        <path
          d="M12.5 10.5h6M15.4 10.5v6.6c0 .8.65 1.45 1.45 1.45h1.65"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* memory node - small orbit + dot */}
        <circle cx="23" cy="11" r="2.6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <circle cx="23" cy="11" r="1.2" fill="currentColor" />
      </svg>
    </div>
  );
}

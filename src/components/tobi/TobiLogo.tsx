type TobiLogoProps = {
  className?: string;
  markClassName?: string;
};

// Clean geometric mark: rounded square with a lowercase "t" cut + spark dot.
export function TobiLogo({ className = "", markClassName = "" }: TobiLogoProps) {
  return (
    <div className={`tobi-logo grid place-items-center ${className}`} aria-hidden="true">
      <svg className={markClassName} viewBox="0 0 32 32" fill="none" role="img">
        {/* the "t" stem + crossbar, knocked out of the gradient bg via currentColor */}
        <path
          d="M12.5 8.5h7M16 8.5v13.2c0 1.05.85 1.9 1.9 1.9h2.6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* spark */}
        <circle cx="23" cy="9.5" r="1.6" fill="currentColor" />
      </svg>
    </div>
  );
}

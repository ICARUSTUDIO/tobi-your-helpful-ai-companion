type TobiLogoProps = {
  className?: string;
  markClassName?: string;
};

export function TobiLogo({ className = "", markClassName = "" }: TobiLogoProps) {
  return (
    <div className={`tobi-logo grid place-items-center ${className}`} aria-hidden="true">
      <svg className={markClassName} viewBox="0 0 64 64" fill="none" role="img">
        <path className="tobi-logo-ring" d="M32 6c14.36 0 26 11.64 26 26S46.36 58 32 58 6 46.36 6 32 17.64 6 32 6Z" />
        <path className="tobi-logo-spark" d="M44.5 13.5 47 19l5.5 2.5L47 24l-2.5 5.5L42 24l-5.5-2.5L42 19l2.5-5.5Z" />
        <path className="tobi-logo-face" d="M18.5 25.5c3.9-6 9.05-9 15.45-9h7.55c2.75 0 5 2.25 5 5v3.1c0 2.75-2.25 5-5 5h-7.1v17.9c0 2.75-2.25 5-5 5h-4.3c-2.75 0-5-2.25-5-5V29.6h-1.6c-1.65 0-2.7-1.85-1.8-3.25l1.8-.85Z" />
        <path className="tobi-logo-cut" d="M29.7 24.1h10.1" />
        <path className="tobi-logo-smile" d="M23.5 39.5c2.4 2.25 5.25 3.35 8.5 3.35s6.1-1.1 8.5-3.35" />
      </svg>
    </div>
  );
}
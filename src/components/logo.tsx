type LogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function Logo({ compact = false, inverse = false }: LogoProps) {
  return (
    <div className={`brand ${inverse ? "brand--inverse" : ""}`}>
      <svg
        className="brand__mark"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="40" height="40" rx="12" fill="currentColor" opacity="0.12" />
        <path
          d="M11.5 13.5h8.75a6.25 6.25 0 0 1 0 12.5h-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.25"
          strokeLinecap="round"
        />
        <path
          d="m14 22-4 4 4 4M26 10l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span className="brand__wordmark">
          Concilia<span>Core</span>
        </span>
      )}
    </div>
  );
}

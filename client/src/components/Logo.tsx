export function LotusMark({ className, size = 28 }: { className?: string; size?: number }) {
  // A single continuous brush-stroke lotus/circle mark. Works mono via currentColor.
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Sadhana lotus mark"
      role="img"
    >
      {/* center petal */}
      <path d="M16 6c2.8 2.6 4.2 5.6 4.2 9 0 2.8-1.7 5.3-4.2 6.8-2.5-1.5-4.2-4-4.2-6.8 0-3.4 1.4-6.4 4.2-9Z" />
      {/* side petals as one flowing stroke each */}
      <path d="M16 21.8c-2.9 1.3-5.8 1.2-8.4-.4 1.2-2.8 3.5-4.6 6.5-5.2" />
      <path d="M16 21.8c2.9 1.3 5.8 1.2 8.4-.4-1.2-2.8-3.5-4.6-6.5-5.2" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`} data-testid="logo-sadhana">
      <span className="text-primary">
        <LotusMark size={26} />
      </span>
      <span className="font-serif text-xl font-semibold tracking-tight">Sadhana</span>
    </div>
  );
}

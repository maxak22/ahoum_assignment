export default function BrandMark({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="brand-mark-svg"
    >
      <rect width="32" height="32" rx="9" fill="url(#bm-g)" />
      <rect x="7" y="8.5" width="18" height="4.6" rx="2.3" fill="#fff" opacity="0.45" />
      <rect x="7" y="15.7" width="18" height="4.6" rx="2.3" fill="#fff" opacity="0.28" />
      <rect x="7" y="15.7" width="10.5" height="4.6" rx="2.3" fill="#fff" />
      <defs>
        <linearGradient id="bm-g" x1="2" y1="0" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Monoline mark — inherits currentColor so it adapts to wherever it sits.
// Two rules inside a rounded square; the shorter lower one nods at "one seat taken".
export default function BrandMark({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6" />
      <line x1="7" y1="9.6" x2="17" y2="9.6" strokeLinecap="round" />
      <line x1="7" y1="14.4" x2="12.6" y2="14.4" strokeLinecap="round" />
    </svg>
  )
}

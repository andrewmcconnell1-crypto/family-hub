// The Nest wordmark lockup: the lowercase name with a hand-drawn nest swoop
// and two eggs settling into it. Colours come from the theme tokens so it
// works in light and dark. Renders in Space Grotesk where it's loaded.
export default function Wordmark({ className = '' }) {
  return (
    <svg
      className={`wordmark ${className}`}
      viewBox="0 0 190 92"
      role="img"
      aria-label="Nest"
      fill="none"
    >
      <text
        x="6"
        y="58"
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontSize="58"
        fontWeight="700"
        letterSpacing="-2.5"
        fill="var(--ink)"
      >
        nest
      </text>
      <path
        d="M12 74 q44 15 88 1"
        stroke="var(--accent)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <ellipse cx="52" cy="77" rx="5.5" ry="6.5" fill="var(--pop)" stroke="var(--ink)" strokeWidth="2.5" />
      <ellipse cx="66" cy="76" rx="4.5" ry="5.5" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
    </svg>
  )
}

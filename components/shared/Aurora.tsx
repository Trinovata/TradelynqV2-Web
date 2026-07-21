/**
 * The living aurora (Caribbean Vivid signature).
 *
 * Three soft, blurred colour fields — teal, coral, warm sand — drifting behind
 * the hero. It is the one thing a visitor remembers: colour that MOVES, not a
 * flat gradient band. Pure CSS, no JavaScript, no image: it is a server
 * component, weighs nothing, and animates only `transform`, so it runs on the
 * GPU and never touches the main thread. Under reduced-motion it holds still and
 * becomes a calm gradient.
 *
 * Rendered behind content with a low opacity and a mask that fades it out toward
 * the edges, so text stays legible without a heavy scrim.
 */
export function Aurora({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div className="bg-aurora-1 absolute -top-1/3 left-[-10%] size-[65vw] rounded-full opacity-50 blur-[80px] will-change-transform motion-safe:animate-[tlAurora1_24s_ease-in-out_infinite] sm:blur-[120px]" />
      <div className="bg-aurora-2 absolute top-[-10%] right-[-15%] size-[60vw] rounded-full opacity-45 blur-[80px] will-change-transform motion-safe:animate-[tlAurora2_29s_ease-in-out_infinite] sm:blur-[120px]" />
      <div className="bg-aurora-3 absolute bottom-[-30%] left-[20%] size-[55vw] rounded-full opacity-40 blur-[80px] will-change-transform motion-safe:animate-[tlAurora3_31s_ease-in-out_infinite] sm:blur-[120px]" />
      {/* Fade the field out toward the bottom so it hands off cleanly to the page. */}
      <div className="from-background/0 to-background absolute inset-0 bg-gradient-to-b via-transparent" />
    </div>
  )
}

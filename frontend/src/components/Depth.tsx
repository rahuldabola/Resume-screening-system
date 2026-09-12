import type { CSSProperties, ReactNode } from 'react';
import { useInView, usePointerOffset, usePrefersReducedMotion, useScrollY } from '../lib/motion';

/**
 * The ambient background: three slow-drifting colour fields behind a fine grid.
 *
 * It sits at the very back on its own compositor layer and never takes pointer
 * events, so the depth it adds costs nothing in interaction. The layers move at
 * different rates as you scroll, which is what produces parallax — a flat page
 * and a deep one differ by exactly this.
 */
export function Aurora() {
  const reduced = usePrefersReducedMotion();
  const scrollY = useScrollY(!reduced);

  const layer = (rate: number): CSSProperties =>
    reduced ? {} : { transform: `translate3d(0, ${scrollY * rate}px, 0)` };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-400/25 blur-3xl motion-safe:animate-drift-slow"
        style={layer(0.14)}
      />
      <div
        className="absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-purple-400/20 blur-3xl motion-safe:animate-drift-medium"
        style={layer(0.08)}
      />
      <div
        className="absolute left-1/3 top-[28rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/20 blur-3xl motion-safe:animate-drift-fast"
        style={layer(0.2)}
      />
      <div className="absolute inset-0 bg-grid opacity-[0.35]" />
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/10 via-canvas/60 to-canvas" />
    </div>
  );
}

interface RevealProps {
  children: ReactNode;
  /** Milliseconds to hold back, so a list arrives in sequence rather than at once. */
  delay?: number;
  className?: string;
}

/** Content that rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translate3d(0, 18px, 0)',
        transition: `opacity 620ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 620ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface TiltProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees. Small on purpose. */
  max?: number;
}

/**
 * A card that turns very slightly toward the pointer.
 *
 * Capped at a few degrees: past roughly 8° the text starts to skew visibly and
 * the effect stops reading as depth and starts reading as a wobble. A moving
 * highlight follows the pointer across the surface, which is what sells the
 * tilt as a physical surface catching light rather than a CSS rotation.
 */
export function Tilt({ children, className = '', max = 5 }: TiltProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, offset } = usePointerOffset<HTMLDivElement>(!reduced);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className="[perspective:1200px]">
      <div
        className={`relative transition-transform duration-200 ease-out [transform-style:preserve-3d] ${className}`}
        style={{
          transform: offset.active
            ? `rotateX(${-offset.y * max * 2}deg) rotateY(${offset.x * max * 2}deg) translateZ(10px)`
            : 'none',
        }}
      >
        {children}
        {offset.active && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-70 transition-opacity"
            style={{
              background: `radial-gradient(420px circle at ${(offset.x + 0.5) * 100}% ${
                (offset.y + 0.5) * 100
              }%, rgba(99,102,241,0.10), transparent 45%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * A dark panel with a spotlight that tracks the pointer.
 *
 * Used for the hero. On a dark surface a moving light source is the cheapest
 * possible way to make a flat rectangle read as a lit object.
 */
export function Spotlight({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const { ref, offset } = usePointerOffset<HTMLDivElement>(!reduced);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {!reduced && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: offset.active ? 1 : 0.45,
            background: `radial-gradient(600px circle at ${(offset.x + 0.5) * 100}% ${
              (offset.y + 0.5) * 100
            }%, rgba(129,140,248,0.22), transparent 60%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

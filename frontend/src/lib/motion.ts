import { useEffect, useRef, useState } from 'react';

/**
 * Every animation in this app asks this first.
 *
 * Motion is decoration; for someone with a vestibular disorder it is a
 * symptom trigger, and the OS-level setting is how they say so. Honouring it
 * is not an accessibility checkbox here — the parallax, the tilt and the
 * count-ups all reduce to their finished state rather than being animated.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Fires once, when the element first scrolls into view.
 *
 * Once is deliberate: content that re-animates every time it re-enters the
 * viewport makes a page feel broken rather than alive.
 */
export function useInView<T extends HTMLElement>(rootMargin = '-40px') {
  const ref = useRef<T>(null);
  // Without IntersectionObserver everything is simply visible from the start,
  // decided here rather than in an effect so there is no flash of hidden text.
  const [inView, setInView] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // An observer with one target always reports at least one entry, but
        // the array type cannot promise that.
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

/** Ease-out cubic: fast first, settling at the end, which is what reads as
 *  "landing on a value" rather than "ticking up to one". */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts from 0 to `target` on a rAF loop.
 *
 * `decimals` keeps the width stable while counting, so a score of 71.6 does
 * not jitter between 1 and 3 characters on its way there.
 */
export function useCountUp(target: number, { duration = 900, decimals = 0, enabled = true } = {}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setAnimated(target * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled]);

  const factor = 10 ** decimals;
  const value = enabled ? animated : target;
  return Math.round(value * factor) / factor;
}

/**
 * Pointer position over an element, as -0.5…0.5 on each axis.
 *
 * Shared by the card tilt and the cursor spotlight so both read the pointer
 * the same way, and both stop reading it entirely under reduced motion.
 */
export function usePointerOffset<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      setOffset({
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
        active: true,
      });
    };
    const onLeave = () => setOffset({ x: 0, y: 0, active: false });

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  return { ref, offset };
}

/** Scroll position, throttled to one read per frame. */
export function useScrollY(enabled = true) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return scrollY;
}

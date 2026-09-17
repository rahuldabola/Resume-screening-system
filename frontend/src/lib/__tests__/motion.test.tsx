import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCountUp, useInView, usePrefersReducedMotion } from '../motion';
import { setPrefersReducedMotion } from '../../test/setup';

function CountUp({ target, decimals = 0, enabled = true }: {
  target: number;
  decimals?: number;
  enabled?: boolean;
}) {
  return <span data-testid="count">{useCountUp(target, { decimals, enabled }).toFixed(decimals)}</span>;
}

function Reduced() {
  return <span data-testid="reduced">{usePrefersReducedMotion() ? 'yes' : 'no'}</span>;
}

describe('usePrefersReducedMotion', () => {
  it('reports the OS preference', () => {
    render(<Reduced />);
    expect(screen.getByTestId('reduced')).toHaveTextContent('yes');
  });

  it('reports no preference when the OS asks for none', () => {
    setPrefersReducedMotion(false);
    render(<Reduced />);
    expect(screen.getByTestId('reduced')).toHaveTextContent('no');
  });
});

describe('useCountUp', () => {
  /**
   * The whole point of the `enabled` flag. Under reduced motion a count-up
   * must resolve to its target on the first render, not animate to it slowly
   * -- otherwise a stat tile shows 0 to exactly the people who opted out.
   */
  it('returns the target immediately when disabled', () => {
    render(<CountUp target={71.6} decimals={1} enabled={false} />);
    expect(screen.getByTestId('count')).toHaveTextContent('71.6');
  });

  it('starts from zero when it is going to animate', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    render(<CountUp target={80} />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('lands exactly on the target once the animation finishes', () => {
    let tick: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      tick = cb;
      return 1;
    });
    vi.spyOn(performance, 'now').mockReturnValue(0);

    render(<CountUp target={80} />);

    // Past the 900ms default duration, so progress clamps to 1.
    act(() => tick!(5000));

    expect(screen.getByTestId('count')).toHaveTextContent('80');
  });

  it('rounds to the requested precision while counting', () => {
    let tick: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      tick = cb;
      return 1;
    });
    vi.spyOn(performance, 'now').mockReturnValue(0);

    render(<CountUp target={71.63} decimals={1} />);
    act(() => tick!(5000));

    expect(screen.getByTestId('count')).toHaveTextContent('71.6');
  });

  it('cancels its frame on unmount rather than counting into a dead tree', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);

    const { unmount } = render(<CountUp target={80} />);
    unmount();

    expect(cancel).toHaveBeenCalledWith(7);
  });
});

function InViewProbe() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="target">
      {inView ? 'visible' : 'hidden'}
    </div>
  );
}

describe('useInView', () => {
  it('reveals the element once it intersects', () => {
    render(<InViewProbe />);
    // The stub observer in the test setup reports everything as intersecting
    // the moment it is observed.
    expect(screen.getByTestId('target')).toHaveTextContent('visible');
  });

  it('stays hidden while the element is out of view', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_cb: IntersectionObserverCallback) {}
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
        root = null;
        rootMargin = '';
        thresholds = [];
      }
    );

    render(<InViewProbe />);

    expect(screen.getByTestId('target')).toHaveTextContent('hidden');
  });

  /**
   * Content that re-animates every time it re-enters the viewport makes a page
   * feel broken rather than alive, so the observer disconnects on first sight.
   */
  it('disconnects after the first reveal rather than firing again', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        cb: IntersectionObserverCallback;
        constructor(cb: IntersectionObserverCallback) {
          this.cb = cb;
        }
        observe(target: Element) {
          this.cb(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        }
        unobserve() {}
        disconnect = disconnect;
        takeRecords() {
          return [];
        }
        root = null;
        rootMargin = '';
        thresholds = [];
      }
    );

    render(<InViewProbe />);

    expect(disconnect).toHaveBeenCalled();
  });

  /**
   * An older browser, or a jsdom without the API. Everything is simply visible
   * from the start -- content that never appears is far worse than content
   * that appears without its animation.
   */
  it('shows everything when the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<InViewProbe />);

    expect(screen.getByTestId('target')).toHaveTextContent('visible');
  });
});

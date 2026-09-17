import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillPills } from '../SkillPills';

describe('SkillPills', () => {
  it('renders every skill when there is no limit', () => {
    render(<SkillPills skills={['python', 'fastapi', 'docker']} />);

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('fastapi')).toBeInTheDocument();
    expect(screen.getByText('docker')).toBeInTheDocument();
  });

  /**
   * "none" rather than an empty row: a candidate with no missing skills and a
   * candidate whose skills failed to parse look identical if the area is blank.
   */
  it('says "none" instead of rendering nothing for an empty list', () => {
    render(<SkillPills skills={[]} />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('truncates to the limit and counts the rest', () => {
    render(<SkillPills skills={['a', 'b', 'c', 'd', 'e']} limit={3} />);

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.queryByText('d')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  /** The hidden skills are still reachable, just not on screen by default. */
  it('lists the hidden skills in the overflow pill title', () => {
    render(<SkillPills skills={['a', 'b', 'c', 'd', 'e']} limit={3} />);
    expect(screen.getByText('+2 more')).toHaveAttribute('title', 'd, e');
  });

  it('shows no overflow pill when the list fits inside the limit', () => {
    render(<SkillPills skills={['a', 'b']} limit={5} />);
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it('shows no overflow pill when the list is exactly the limit', () => {
    render(<SkillPills skills={['a', 'b', 'c']} limit={3} />);
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it('applies the tone a caller asks for', () => {
    const { rerender } = render(<SkillPills skills={['python']} tone="positive" />);
    expect(screen.getByText('python')).toHaveClass('tone-positive');

    rerender(<SkillPills skills={['python']} tone="negative" />);
    expect(screen.getByText('python')).toHaveClass('tone-negative');
  });

  /**
   * Past a dozen pills a per-item delay stops reading as sequence and starts
   * reading as lag, so the stagger is capped rather than growing forever.
   */
  it('caps the stagger delay so a long list does not crawl in', () => {
    const skills = Array.from({ length: 20 }, (_, i) => `skill-${i}`);
    render(<SkillPills skills={skills} stagger />);

    expect(screen.getByText('skill-5')).toHaveStyle({ animationDelay: '175ms' });
    expect(screen.getByText('skill-19')).toHaveStyle({ animationDelay: '420ms' });
  });

  it('sets no animation delay when not staggering', () => {
    render(<SkillPills skills={['python']} />);
    expect(screen.getByText('python').style.animationDelay).toBe('');
  });
});

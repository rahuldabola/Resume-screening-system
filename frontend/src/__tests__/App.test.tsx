import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as jobsApi from '../api/jobs';
import * as candidatesApi from '../api/candidates';

vi.mock('../api/jobs');
vi.mock('../api/candidates');

beforeEach(() => {
  vi.mocked(jobsApi.listJobs).mockResolvedValue([]);
  vi.mocked(candidatesApi.listCandidates).mockResolvedValue([]);
});

/**
 * One pass through the shell the whole app hangs off: the router, the nav, the
 * toast provider and the theme toggle. A unit test of any one of them would
 * still pass if they were never wired together here.
 */
describe('App', () => {
  it('lands on the jobs page', async () => {
    render(<App />);

    expect(await screen.findByText('No job postings yet')).toBeInTheDocument();
  });

  it('navigates to the candidates page and back', async () => {
    render(<App />);
    await screen.findByText('No job postings yet');

    await userEvent.click(screen.getByRole('link', { name: 'Candidates' }));
    expect(await screen.findByText('No candidates yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Jobs' }));
    expect(await screen.findByText('No job postings yet')).toBeInTheDocument();
  });

  /**
   * The label names the theme you would switch *to*, so it stays honest about
   * what the button does rather than describing the state you are already in.
   */
  it('toggles the theme from the navbar', async () => {
    render(<App />);
    await screen.findByText('No job postings yet');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement).toHaveClass('dark');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('renders each route inside a main landmark', async () => {
    render(<App />);
    await screen.findByText('No job postings yet');

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobDetailPage } from '../JobDetailPage';
import { makeJob, makeResult, renderWithProviders } from '../../test/utils';
import * as jobsApi from '../../api/jobs';

vi.mock('../../api/jobs');

const getJob = vi.mocked(jobsApi.getJob);
const getResults = vi.mocked(jobsApi.getResults);
const rankCandidates = vi.mocked(jobsApi.rankCandidates);

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/jobs/:id" element={<JobDetailPage />} />
    </Routes>,
    { route: '/jobs/7' }
  );
}

beforeEach(() => {
  getJob.mockResolvedValue(makeJob({ id: 7, title: 'Senior Backend Engineer' }));
  getResults.mockResolvedValue([]);
});

describe('JobDetailPage', () => {
  it('loads the job named in the URL', async () => {
    renderPage();

    expect(await screen.findByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(getJob).toHaveBeenCalledWith(7);
    expect(getResults).toHaveBeenCalledWith(7);
  });

  it('explains what to do when nothing has been ranked yet', async () => {
    renderPage();

    expect(await screen.findByText('Nothing ranked yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rank all candidates/ })).toBeInTheDocument();
  });

  it('offers a re-rank once results exist', async () => {
    getResults.mockResolvedValue([makeResult()]);
    renderPage();

    expect(await screen.findByRole('button', { name: /Re-rank candidates/ })).toBeInTheDocument();
  });

  it('lists candidates in the order the API returned them', async () => {
    getResults.mockResolvedValue([
      makeResult({ id: 1, candidate_name: 'Priya Sharma', match_score: 82 }),
      makeResult({ id: 2, candidate_name: 'Arjun Mehta', match_score: 64 }),
      makeResult({ id: 3, candidate_name: 'Sam Doe', match_score: 21 }),
    ]);
    renderPage();

    await screen.findByText('Priya Sharma');
    const names = screen.getAllByText(/Priya Sharma|Arjun Mehta|Sam Doe/).map((n) => n.textContent);
    expect(names).toEqual(['Priya Sharma', 'Arjun Mehta', 'Sam Doe']);
  });

  it('summarises the pool above the list', async () => {
    getResults.mockResolvedValue([
      makeResult({ id: 1, match_score: 82 }),
      makeResult({ id: 2, match_score: 72 }),
      makeResult({ id: 3, match_score: 20 }),
    ]);
    renderPage();

    await screen.findByText('Candidates');
    // Two of the three clear the 70 mark; the mean of 82, 72 and 20 is 58.
    expect(screen.getByText('Strong matches').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Average score').nextSibling).toHaveTextContent('58.0%');
    expect(screen.getByText('Top score').nextSibling).toHaveTextContent('82.0%');
  });

  it('shows no summary tiles before anything is ranked', async () => {
    renderPage();

    await screen.findByText('Nothing ranked yet');
    expect(screen.queryByText('Strong matches')).not.toBeInTheDocument();
  });

  describe('the breakdown', () => {
    beforeEach(() => {
      getResults.mockResolvedValue([makeResult({ id: 1, candidate_name: 'Priya Sharma' })]);
    });

    it('stays closed until asked', async () => {
      renderPage();

      await screen.findByText('Priya Sharma');
      expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    });

    it('opens on click and shows why the candidate scored', async () => {
      renderPage();
      await screen.findByText('Priya Sharma');

      await userEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText('Skill overlap')).toBeInTheDocument();
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    });

    it('closes again on a second click', async () => {
      renderPage();
      await screen.findByText('Priya Sharma');

      await userEvent.click(screen.getByRole('button', { expanded: false }));
      await userEvent.click(screen.getByRole('button', { expanded: true }));

      expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    });

    /** What every other expandable thing on the web does. */
    it('closes on Escape', async () => {
      renderPage();
      await screen.findByText('Priya Sharma');
      await userEvent.click(screen.getByRole('button', { expanded: false }));

      await userEvent.keyboard('{Escape}');

      expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
    });
  });

  describe('ranking', () => {
    it('replaces the list with the fresh ranking and says how many were scored', async () => {
      rankCandidates.mockResolvedValue([
        makeResult({ id: 10, candidate_name: 'Arjun Mehta' }),
        makeResult({ id: 11, candidate_name: 'Priya Sharma' }),
      ]);
      renderPage();
      await screen.findByText('Nothing ranked yet');

      await userEvent.click(screen.getByRole('button', { name: /Rank all candidates/ }));

      expect(await screen.findByText('Arjun Mehta')).toBeInTheDocument();
      expect(screen.getByText('Scored 2 candidates against this job.')).toBeInTheDocument();
    });

    it('counts a single candidate in the singular', async () => {
      rankCandidates.mockResolvedValue([makeResult({ id: 10 })]);
      renderPage();
      await screen.findByText('Nothing ranked yet');

      await userEvent.click(screen.getByRole('button', { name: /Rank all candidates/ }));

      expect(await screen.findByText('Scored 1 candidate against this job.')).toBeInTheDocument();
    });

    /**
     * Ranking writes fresh rows, so the ids change even for the same people.
     * Leaving the old expansion open would point it at a row that no longer
     * exists -- or, worse, at a different candidate that inherited the id.
     */
    it('collapses any open breakdown, whose row ids no longer exist', async () => {
      getResults.mockResolvedValue([makeResult({ id: 1, candidate_name: 'Priya Sharma' })]);
      rankCandidates.mockResolvedValue([makeResult({ id: 99, candidate_name: 'Priya Sharma' })]);
      renderPage();
      await screen.findByText('Priya Sharma');
      await userEvent.click(screen.getByRole('button', { expanded: false }));

      await userEvent.click(screen.getByRole('button', { name: /Re-rank candidates/ }));

      await waitFor(() => expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument());
    });

    it('reports a failure in both the page and a toast, and keeps the old list', async () => {
      getResults.mockResolvedValue([makeResult({ id: 1, candidate_name: 'Priya Sharma' })]);
      rankCandidates.mockRejectedValue(new Error('nope'));
      renderPage();
      await screen.findByText('Priya Sharma');

      await userEvent.click(screen.getByRole('button', { name: /Re-rank candidates/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    it('disables the button while the pool is being scored', async () => {
      let release: (value: never[]) => void = () => {};
      rankCandidates.mockReturnValue(new Promise((resolve) => { release = resolve; }));
      renderPage();
      await screen.findByText('Nothing ranked yet');

      await userEvent.click(screen.getByRole('button', { name: /Rank all candidates/ }));

      const button = screen.getByRole('button', { name: /Scoring the pool/ });
      expect(button).toBeDisabled();

      release([]);
      await waitFor(() => expect(button).not.toBeDisabled());
    });
  });

  it('offers a way back when the job cannot be loaded', async () => {
    getJob.mockRejectedValue(new Error('gone'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('link', { name: 'Back to job postings' })).toHaveAttribute('href', '/');
  });
});

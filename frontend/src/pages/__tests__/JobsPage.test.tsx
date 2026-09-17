import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsPage } from '../JobsPage';
import { makeCandidate, makeJob, renderWithProviders } from '../../test/utils';
import * as jobsApi from '../../api/jobs';
import * as candidatesApi from '../../api/candidates';

vi.mock('../../api/jobs');
vi.mock('../../api/candidates');

const listJobs = vi.mocked(jobsApi.listJobs);
const createJob = vi.mocked(jobsApi.createJob);
const deleteJob = vi.mocked(jobsApi.deleteJob);
const listCandidates = vi.mocked(candidatesApi.listCandidates);

beforeEach(() => {
  listJobs.mockResolvedValue([]);
  listCandidates.mockResolvedValue([]);
});

describe('JobsPage', () => {
  it('invites the first posting when there are none', async () => {
    renderWithProviders(<JobsPage />);

    expect(await screen.findByText('No job postings yet')).toBeInTheDocument();
  });

  it('lists jobs, each linking to its ranking', async () => {
    listJobs.mockResolvedValue([
      makeJob({ id: 7, title: 'Senior Backend Engineer' }),
      makeJob({ id: 8, title: 'Frontend Engineer' }),
    ]);
    renderWithProviders(<JobsPage />);

    expect(await screen.findByRole('link', { name: 'Senior Backend Engineer' })).toHaveAttribute(
      'href',
      '/jobs/7'
    );
    expect(screen.getByRole('link', { name: 'Frontend Engineer' })).toHaveAttribute('href', '/jobs/8');
  });

  /**
   * "3 jobs, 0 candidates" is the single most useful thing to know before
   * wondering why nothing ranks, which is why the pool size is on this page
   * at all rather than only on the candidates page.
   */
  it('shows the pool size next to the posting count', async () => {
    listJobs.mockResolvedValue([makeJob({ id: 1 }), makeJob({ id: 2 })]);
    listCandidates.mockResolvedValue([makeCandidate({ id: 1 }), makeCandidate({ id: 2 }), makeCandidate({ id: 3 })]);
    renderWithProviders(<JobsPage />);

    await screen.findByText('Job postings');
    expect(screen.getByText('Job postings').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('Candidates').previousSibling).toHaveTextContent('3');
  });

  it('formats the posting date from the API timestamp', async () => {
    listJobs.mockResolvedValue([makeJob({ created_at: '2026-01-15 09:30:00' })]);
    renderWithProviders(<JobsPage />);

    expect(await screen.findByText(/^Posted /)).toHaveTextContent(/2026/);
  });

  /** SQLite hands back whatever is in the column; a bad one must not render
   *  "Posted Invalid Date" across the list. */
  it('prints no date rather than "Invalid Date" for an unparseable timestamp', async () => {
    listJobs.mockResolvedValue([makeJob({ created_at: 'not-a-date' })]);
    renderWithProviders(<JobsPage />);

    await screen.findByRole('link', { name: 'Senior Backend Engineer' });
    expect(screen.getByText(/^Posted/)).toHaveTextContent('Posted');
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  describe('the new-job form', () => {
    it('stays out of the way until asked for', async () => {
      renderWithProviders(<JobsPage />);
      await screen.findByText('No job postings yet');

      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'New job posting' }));

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('closes again on Cancel', async () => {
      renderWithProviders(<JobsPage />);
      await screen.findByText('No job postings yet');

      await userEvent.click(screen.getByRole('button', { name: 'New job posting' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    });

    it('posts the job, then clears and closes the form', async () => {
      createJob.mockResolvedValue(makeJob({ title: 'Senior Backend Engineer' }));
      renderWithProviders(<JobsPage />);
      await screen.findByText('No job postings yet');

      await userEvent.click(screen.getByRole('button', { name: 'New job posting' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Senior Backend Engineer');
      await userEvent.type(screen.getByLabelText('Description'), 'Python and FastAPI.');
      await userEvent.click(screen.getByRole('button', { name: 'Post job' }));

      await waitFor(() =>
        expect(createJob).toHaveBeenCalledWith('Senior Backend Engineer', 'Python and FastAPI.')
      );
      expect(await screen.findByText('"Senior Backend Engineer" posted.')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText('Title')).not.toBeInTheDocument());
      expect(listJobs).toHaveBeenCalledTimes(2);
    });

    /**
     * Closing the form on failure would throw away everything typed, and the
     * failure is usually a validation message about that very text.
     */
    it('leaves the form open with its text when posting fails', async () => {
      createJob.mockRejectedValue(new Error('too short'));
      renderWithProviders(<JobsPage />);
      await screen.findByText('No job postings yet');

      await userEvent.click(screen.getByRole('button', { name: 'New job posting' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Ok');
      await userEvent.type(screen.getByLabelText('Description'), 'Short.');
      await userEvent.click(screen.getByRole('button', { name: 'Post job' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(screen.getByLabelText('Title')).toHaveValue('Ok');
    });
  });

  describe('deleting', () => {
    beforeEach(() => {
      listJobs.mockResolvedValue([makeJob({ id: 7, title: 'Senior Backend Engineer' })]);
    });

    /** Deleting a job takes its whole ranking with it, and says so. */
    it('takes two clicks and warns that the ranking goes too', async () => {
      deleteJob.mockResolvedValue();
      renderWithProviders(<JobsPage />);
      await screen.findByRole('link', { name: 'Senior Backend Engineer' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete Senior Backend Engineer' }));
      expect(deleteJob).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(deleteJob).toHaveBeenCalledWith(7));
      expect(
        await screen.findByText('"Senior Backend Engineer" and its ranking were deleted.')
      ).toBeInTheDocument();
    });

    it('surfaces a failed delete', async () => {
      deleteJob.mockRejectedValue(new Error('locked'));
      renderWithProviders(<JobsPage />);
      await screen.findByRole('link', { name: 'Senior Backend Engineer' });

      await userEvent.click(screen.getByRole('button', { name: 'Delete Senior Backend Engineer' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    });
  });

  it('reports a list that will not load', async () => {
    listJobs.mockRejectedValue(new Error('down'));
    renderWithProviders(<JobsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('can dismiss the error it reported', async () => {
    listJobs.mockRejectedValue(new Error('down'));
    renderWithProviders(<JobsPage />);
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

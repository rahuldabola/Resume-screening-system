import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidatesPage } from '../CandidatesPage';
import { makeCandidate, renderWithProviders } from '../../test/utils';
import * as candidatesApi from '../../api/candidates';

vi.mock('../../api/candidates');

const listCandidates = vi.mocked(candidatesApi.listCandidates);
const uploadCandidate = vi.mocked(candidatesApi.uploadCandidate);
const deleteCandidate = vi.mocked(candidatesApi.deleteCandidate);

function resume(name = 'priya.pdf') {
  return new File(['resume text'], name, { type: 'application/pdf' });
}

beforeEach(() => {
  listCandidates.mockResolvedValue([]);
});

describe('CandidatesPage', () => {
  it('invites the first upload when the pool is empty', async () => {
    renderWithProviders(<CandidatesPage />);

    expect(await screen.findByText('No candidates yet')).toBeInTheDocument();
  });

  it('lists a candidate with their file and extracted skills', async () => {
    listCandidates.mockResolvedValue([
      makeCandidate({ name: 'Priya Sharma', resume_filename: 'priya.pdf' }),
    ]);
    renderWithProviders(<CandidatesPage />);

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('priya.pdf')).toBeInTheDocument();
    expect(screen.getByText('Extracted skills · 3')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  describe('uploading', () => {
    it('refuses to submit without a file, before troubling the server', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.click(screen.getByRole('button', { name: 'Upload resume' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Choose a resume file first (.pdf, .docx or .txt).'
      );
      expect(uploadCandidate).not.toHaveBeenCalled();
    });

    it('sends the form and reports how many skills were found', async () => {
      uploadCandidate.mockResolvedValue(
        makeCandidate({ name: 'Priya Sharma', extracted_skills: JSON.stringify(['python', 'sql']) })
      );
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.type(screen.getByLabelText(/Email/), 'priya@example.com');
      await userEvent.upload(screen.getByLabelText('Resume file'), resume());
      await userEvent.click(screen.getByRole('button', { name: 'Upload resume' }));

      await waitFor(() =>
        expect(uploadCandidate).toHaveBeenCalledWith(
          'Priya Sharma',
          'priya@example.com',
          expect.objectContaining({ name: 'priya.pdf' }),
          expect.any(Function)
        )
      );
      expect(await screen.findByText('Priya Sharma added — 2 skills extracted.')).toBeInTheDocument();
    });

    it('counts a single extracted skill in the singular', async () => {
      uploadCandidate.mockResolvedValue(
        makeCandidate({ name: 'Priya Sharma', extracted_skills: JSON.stringify(['python']) })
      );
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.upload(screen.getByLabelText('Resume file'), resume());
      await userEvent.click(screen.getByRole('button', { name: 'Upload resume' }));

      expect(await screen.findByText('Priya Sharma added — 1 skill extracted.')).toBeInTheDocument();
    });

    it('clears the form and reloads the pool on success', async () => {
      uploadCandidate.mockResolvedValue(makeCandidate({ name: 'Priya Sharma' }));
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.upload(screen.getByLabelText('Resume file'), resume());
      await userEvent.click(screen.getByRole('button', { name: 'Upload resume' }));

      await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
      expect(screen.getByText(/Drag a resume here/)).toBeInTheDocument();
      expect(listCandidates).toHaveBeenCalledTimes(2);
    });

    it('keeps what was typed when the upload fails', async () => {
      uploadCandidate.mockRejectedValue(new Error('boom'));
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.upload(screen.getByLabelText('Resume file'), resume());
      await userEvent.click(screen.getByRole('button', { name: 'Upload resume' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(screen.getByLabelText('Name')).toHaveValue('Priya Sharma');
    });

    /**
     * Parsing happens after the bytes land, so a bar stuck at 100% would look
     * frozen. The label changes to name the step that is still running.
     */
    it('reports uploading and then extracting', async () => {
      let report: (percent: number) => void = () => {};
      uploadCandidate.mockImplementation((_name, _email, _file, onProgress) => {
        report = onProgress!;
        return new Promise(() => {});
      });
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('No candidates yet');

      await userEvent.type(screen.getByLabelText('Name'), 'Priya Sharma');
      await userEvent.upload(screen.getByLabelText('Resume file'), resume());
      await userEvent.click(screen.getByRole('button', { name: /Upload resume|Working/ }));

      await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());

      // `report` is axios's own progress callback, invoked from outside React,
      // so the act wrapper is what flushes the state it sets.
      await act(async () => report(40));
      expect(screen.getByRole('progressbar', { name: 'Uploading resume' })).toHaveAttribute(
        'aria-valuenow',
        '40'
      );

      await act(async () => report(100));
      expect(
        screen.getByRole('progressbar', { name: 'Extracting text and skills' })
      ).toBeInTheDocument();
    });
  });

  describe('searching', () => {
    beforeEach(() => {
      listCandidates.mockResolvedValue([
        makeCandidate({
          id: 1,
          name: 'Priya Sharma',
          email: 'priya@example.com',
          extracted_skills: JSON.stringify(['python', 'kubernetes']),
        }),
        makeCandidate({
          id: 2,
          name: 'Arjun Mehta',
          email: 'arjun@example.com',
          extracted_skills: JSON.stringify(['react', 'typescript']),
        }),
      ]);
    });

    it('filters by name', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), 'arjun');

      expect(screen.getByText('Arjun Mehta')).toBeInTheDocument();
      expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
    });

    /** "Who here knows Kubernetes" is the question a recruiter arrives with. */
    it('filters by an extracted skill, not just the name', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), 'kubernetes');

      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.queryByText('Arjun Mehta')).not.toBeInTheDocument();
    });

    it('filters by email', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), 'arjun@');

      expect(screen.getByText('Arjun Mehta')).toBeInTheDocument();
      expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
    });

    it('ignores case and surrounding space', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), '  PRIYA  ');

      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.queryByText('Arjun Mehta')).not.toBeInTheDocument();
    });

    it('says so, and quotes the query, when nothing matches', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), 'cobol');

      expect(screen.getByText('No match')).toBeInTheDocument();
      expect(screen.getByText('Nobody in the pool matches "cobol".')).toBeInTheDocument();
    });

    it('counts the matches alongside the pool size', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.type(screen.getByLabelText('Search candidates'), 'priya');

      expect(screen.getByText('· 1 matching')).toBeInTheDocument();
    });

    it('jumps to the search box on "/"', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.keyboard('/');

      expect(screen.getByLabelText('Search candidates')).toHaveFocus();
    });

    /**
     * Otherwise the shortcut would fight the keyboard: a slash belongs in a
     * job description or an email address more often than it opens a search.
     */
    it('leaves "/" alone while typing in a field', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      const nameField = screen.getByLabelText('Name');
      await userEvent.click(nameField);
      await userEvent.keyboard('a/b');

      expect(nameField).toHaveValue('a/b');
      expect(nameField).toHaveFocus();
    });

    it('clears and leaves the search on Escape', async () => {
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');
      const search = screen.getByLabelText('Search candidates');

      await userEvent.type(search, 'priya');
      await userEvent.keyboard('{Escape}');

      expect(search).toHaveValue('');
      expect(search).not.toHaveFocus();
    });
  });

  describe('deleting', () => {
    beforeEach(() => {
      listCandidates.mockResolvedValue([makeCandidate({ id: 1, name: 'Priya Sharma' })]);
    });

    it('takes two clicks, then removes and reloads', async () => {
      deleteCandidate.mockResolvedValue();
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
      expect(deleteCandidate).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(deleteCandidate).toHaveBeenCalledWith(1));
      expect(await screen.findByText('Priya Sharma removed from the pool.')).toBeInTheDocument();
      expect(listCandidates).toHaveBeenCalledTimes(2);
    });

    it('surfaces a failed delete rather than looking like it worked', async () => {
      deleteCandidate.mockRejectedValue(new Error('locked'));
      renderWithProviders(<CandidatesPage />);
      await screen.findByText('Priya Sharma');

      await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    });
  });

  it('reports a pool that will not load', async () => {
    listCandidates.mockRejectedValue(new Error('down'));
    renderWithProviders(<CandidatesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
  });
});

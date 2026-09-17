import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileDrop } from '../FileDrop';

function file(name: string, size = 2048) {
  const f = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

/** jsdom builds no DataTransfer, so a drop needs its files supplied directly. */
function dropOn(zone: HTMLElement, files: File[]) {
  fireEvent.drop(zone, { dataTransfer: { files } });
}

function dropZone() {
  return screen.getByText(/Drag a resume here/).closest('div')!;
}

describe('FileDrop', () => {
  it('prompts for a file and names the formats it takes', () => {
    render(<FileDrop file={null} onSelect={vi.fn()} accept=".pdf,.docx,.txt" />);

    expect(screen.getByText(/Drag a resume here/)).toBeInTheDocument();
    expect(screen.getByText('PDF, DOCX or TXT')).toBeInTheDocument();
  });

  /**
   * The drop zone is a div, which no keyboard can reach. The real input stays
   * in the DOM behind it with a label, so a screen-reader or keyboard user
   * gets the same control rather than a worse one.
   */
  it('keeps a labelled file input underneath for keyboard users', () => {
    render(<FileDrop file={null} onSelect={vi.fn()} accept=".pdf,.docx,.txt" />);

    const input = screen.getByLabelText('Resume file');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.pdf,.docx,.txt');
  });

  it('selects a file chosen through the input', async () => {
    const onSelect = vi.fn();
    render(<FileDrop file={null} onSelect={onSelect} accept=".pdf" />);

    await userEvent.upload(screen.getByLabelText('Resume file'), file('resume.pdf'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'resume.pdf' }));
  });

  it.each(['resume.pdf', 'resume.docx', 'resume.txt', 'RESUME.PDF'])(
    'accepts %s on drop',
    (name) => {
      const onSelect = vi.fn();
      render(<FileDrop file={null} onSelect={onSelect} accept=".pdf,.docx,.txt" />);

      dropOn(dropZone(), [file(name)]);

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name }));
    }
  );

  /**
   * Rejecting in the browser rather than at the server is the difference
   * between an instant "that is not a resume" and a round trip that ends in a
   * 400 after the bytes have already been uploaded.
   */
  it('rejects a file of the wrong type and says which file it was', () => {
    const onSelect = vi.fn();
    render(<FileDrop file={null} onSelect={onSelect} accept=".pdf,.docx,.txt" />);

    dropOn(dropZone(), [file('photo.png')]);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("photo.png isn't a PDF, DOCX or TXT file.")).toBeInTheDocument();
  });

  it('clears the rejection once an accepted file arrives', () => {
    const onSelect = vi.fn();
    render(<FileDrop file={null} onSelect={onSelect} accept=".pdf,.docx,.txt" />);

    dropOn(dropZone(), [file('photo.png')]);
    expect(screen.getByText(/isn't a PDF/)).toBeInTheDocument();

    dropOn(dropZone(), [file('resume.pdf')]);
    expect(screen.queryByText(/isn't a PDF/)).not.toBeInTheDocument();
  });

  it('ignores a drop that carries no file at all', () => {
    const onSelect = vi.fn();
    render(<FileDrop file={null} onSelect={onSelect} accept=".pdf" />);

    dropOn(dropZone(), []);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByText(/isn't a PDF/)).not.toBeInTheDocument();
  });

  it('highlights the zone while a file is dragged over it', () => {
    render(<FileDrop file={null} onSelect={vi.fn()} accept=".pdf" />);
    const zone = dropZone();

    fireEvent.dragOver(zone);
    expect(zone.className).toContain('border-brand-500');

    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('border-brand-500');
  });

  describe('once a file is chosen', () => {
    it('shows its name and a readable size', () => {
      render(<FileDrop file={file('resume.pdf', 245_760)} onSelect={vi.fn()} accept=".pdf" />);

      expect(screen.getByText('resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('240 KB')).toBeInTheDocument();
    });

    it('switches to megabytes for a large file', () => {
      render(<FileDrop file={file('resume.pdf', 3_355_443)} onSelect={vi.fn()} accept=".pdf" />);
      expect(screen.getByText('3.2 MB')).toBeInTheDocument();
    });

    it('clears the selection on Remove', async () => {
      const onSelect = vi.fn();
      render(<FileDrop file={file('resume.pdf')} onSelect={onSelect} accept=".pdf" />);

      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });
});

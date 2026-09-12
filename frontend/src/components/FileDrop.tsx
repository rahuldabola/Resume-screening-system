import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface FileDropProps {
  file: File | null;
  onSelect: (file: File | null) => void;
  accept: string;
}

const EXTENSIONS = ['.pdf', '.docx', '.txt'];

function isAccepted(file: File) {
  return EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

function readableSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Drag-and-drop resume upload, with the plain file input still underneath so
 * keyboard and screen-reader users get the same control rather than a worse one.
 */
export function FileDrop({ file, onSelect, accept }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!isAccepted(dropped)) {
      setRejected(`${dropped.name} isn't a PDF, DOCX or TXT file.`);
      return;
    }
    setRejected(null);
    onSelect(dropped);
  }

  if (file) {
    return (
      <div className="tone-brand flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset">
        <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5.9L16 5.6v11.9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5v-15Zm7.5 0V6H15l-3.5-3.5Z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs opacity-75">{readableSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-surface hover:text-ink-900"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-brand-500 bg-brand-500/10' : 'border-ink-900/12 bg-ink-900/[0.015] hover:border-ink-900/25'
        }`}
      >
        <svg viewBox="0 0 24 24" className="mx-auto h-6 w-6 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
        </svg>
        <p className="mt-2 text-sm text-ink-700">
          Drag a resume here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-ink-300">PDF, DOCX or TXT</p>
      </div>
      {rejected && <p className="mt-2 text-xs font-medium text-rose-600">{rejected}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="Resume file"
        onChange={(e) => {
          setRejected(null);
          onSelect(e.target.files?.[0] ?? null);
        }}
      />
    </div>
  );
}

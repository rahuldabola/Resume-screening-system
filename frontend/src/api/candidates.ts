import { apiClient } from './client';
import type { Candidate } from './types';

export async function listCandidates(): Promise<Candidate[]> {
  const res = await apiClient.get<Candidate[]>('/candidates');
  return res.data;
}

export async function uploadCandidate(
  name: string,
  email: string,
  file: File,
  // Upload is the one call here with a payload big enough to be worth a
  // progress bar. Parsing happens after the bytes land, so 100% means
  // "uploaded", not "done" — the caller says so in its label.
  onProgress?: (percent: number) => void
): Promise<Candidate> {
  const formData = new FormData();
  formData.append('name', name);
  if (email) formData.append('email', email);
  formData.append('resume', file);

  const res = await apiClient.post<Candidate>('/candidates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress((event.loaded / event.total) * 100);
    },
  });
  return res.data;
}

export async function deleteCandidate(id: number): Promise<void> {
  await apiClient.delete(`/candidates/${id}`);
}

import { apiClient } from './client';
import type { Candidate } from './types';

export async function listCandidates(): Promise<Candidate[]> {
  const res = await apiClient.get<Candidate[]>('/candidates');
  return res.data;
}

export async function uploadCandidate(name: string, email: string, file: File): Promise<Candidate> {
  const formData = new FormData();
  formData.append('name', name);
  if (email) formData.append('email', email);
  formData.append('resume', file);

  const res = await apiClient.post<Candidate>('/candidates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteCandidate(id: number): Promise<void> {
  await apiClient.delete(`/candidates/${id}`);
}

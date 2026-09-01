import { apiClient } from './client';
import type { AssessmentResult, Job } from './types';

export async function listJobs(): Promise<Job[]> {
  const res = await apiClient.get<Job[]>('/jobs');
  return res.data;
}

export async function getJob(id: number): Promise<Job> {
  const res = await apiClient.get<Job>(`/jobs/${id}`);
  return res.data;
}

export async function createJob(title: string, description: string): Promise<Job> {
  const res = await apiClient.post<Job>('/jobs', { title, description });
  return res.data;
}

export async function deleteJob(id: number): Promise<void> {
  await apiClient.delete(`/jobs/${id}`);
}

export async function rankCandidates(jobId: number): Promise<AssessmentResult[]> {
  const res = await apiClient.post<AssessmentResult[]>(`/jobs/${jobId}/rank`);
  return res.data;
}

export async function getResults(jobId: number): Promise<AssessmentResult[]> {
  const res = await apiClient.get<AssessmentResult[]>(`/jobs/${jobId}/results`);
  return res.data;
}

export interface Job {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

export interface Candidate {
  id: number;
  name: string;
  email: string | null;
  resume_filename: string;
  resume_text: string;
  extracted_skills: string; // JSON-encoded string[]
  created_at: string;
}

export interface AssessmentResult {
  id: number;
  job_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string | null;
  match_score: number;
  skill_overlap_score: number;
  tfidf_similarity: number;
  is_strong_match: number;
  matched_skills: string; // JSON-encoded string[]
  missing_skills: string; // JSON-encoded string[]
  created_at: string;
}

export function parseSkills(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

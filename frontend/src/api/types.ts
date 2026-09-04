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
  /** 1 when the score cleared the wrong-field floor. Not a quality bar --
   *  the UI's "Strong Match" band is a much higher bar than this flag. */
  clears_domain_floor: number;
  /** Fraction of the resume made of bare skill keywords. */
  keyword_coverage: number;
  /** Multiplier applied for keyword stuffing; 1 means untouched. */
  stuffing_factor: number;
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

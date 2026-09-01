import * as candidatesService from '../candidates.service';

describe('candidates.service', () => {
  it('creates and retrieves a candidate', () => {
    const candidate = candidatesService.createCandidate({
      name: 'Jane Doe',
      email: 'jane@example.com',
      resumeFilename: 'jane.pdf',
      resumeText: 'Experienced backend engineer.',
      extractedSkills: ['node.js', 'express'],
    });

    expect(candidate.id).toBeGreaterThan(0);
    expect(candidate.name).toBe('Jane Doe');
    expect(JSON.parse(candidate.extracted_skills)).toEqual(['node.js', 'express']);

    const fetched = candidatesService.getCandidateById(candidate.id);
    expect(fetched).toEqual(candidate);
  });

  it('allows a null email', () => {
    const candidate = candidatesService.createCandidate({
      name: 'No Email',
      email: null,
      resumeFilename: 'noemail.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });
    expect(candidate.email).toBeNull();
  });

  it('returns undefined for a non-existent candidate', () => {
    expect(candidatesService.getCandidateById(999999)).toBeUndefined();
  });

  it('lists candidates most-recent first', () => {
    const first = candidatesService.createCandidate({
      name: 'Candidate A',
      email: null,
      resumeFilename: 'a.txt',
      resumeText: 'a',
      extractedSkills: [],
    });
    const second = candidatesService.createCandidate({
      name: 'Candidate B',
      email: null,
      resumeFilename: 'b.txt',
      resumeText: 'b',
      extractedSkills: [],
    });

    const candidates = candidatesService.listCandidates();
    const indexA = candidates.findIndex((c) => c.id === first.id);
    const indexB = candidates.findIndex((c) => c.id === second.id);
    expect(indexB).toBeLessThan(indexA);
  });

  it('deletes a candidate', () => {
    const candidate = candidatesService.createCandidate({
      name: 'Temp Candidate',
      email: null,
      resumeFilename: 'temp.txt',
      resumeText: 'temp',
      extractedSkills: [],
    });
    candidatesService.deleteCandidate(candidate.id);
    expect(candidatesService.getCandidateById(candidate.id)).toBeUndefined();
  });
});

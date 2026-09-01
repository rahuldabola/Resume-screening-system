import { createJobSchema } from '../jobs.validation';

describe('createJobSchema', () => {
  it('accepts a valid job', () => {
    const result = createJobSchema.safeParse({
      title: 'Backend Engineer',
      description: 'Build and maintain REST APIs using Node.js and PostgreSQL.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a title that is too short', () => {
    const result = createJobSchema.safeParse({
      title: 'A',
      description: 'Build and maintain REST APIs using Node.js and PostgreSQL.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a description that is too short', () => {
    const result = createJobSchema.safeParse({
      title: 'Backend Engineer',
      description: 'Too short.',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from title and description', () => {
    const result = createJobSchema.parse({
      title: '  Backend Engineer  ',
      description: '  Build and maintain REST APIs using Node.js and PostgreSQL.  ',
    });
    expect(result.title).toBe('Backend Engineer');
    expect(result.description).toBe('Build and maintain REST APIs using Node.js and PostgreSQL.');
  });
});

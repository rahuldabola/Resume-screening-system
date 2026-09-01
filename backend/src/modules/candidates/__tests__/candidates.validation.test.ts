import { candidateMetaSchema } from '../candidates.validation';

describe('candidateMetaSchema', () => {
  it('accepts a valid name and email', () => {
    const result = candidateMetaSchema.safeParse({ name: 'Jane Doe', email: 'jane@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty email (optional field)', () => {
    const result = candidateMetaSchema.safeParse({ name: 'Jane Doe', email: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a missing email entirely', () => {
    const result = candidateMetaSchema.safeParse({ name: 'Jane Doe' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = candidateMetaSchema.safeParse({ name: '', email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = candidateMetaSchema.safeParse({ name: 'Jane Doe', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from the name', () => {
    const result = candidateMetaSchema.parse({ name: '  Jane Doe  ' });
    expect(result.name).toBe('Jane Doe');
  });

  it('rejects a name over 200 characters', () => {
    const result = candidateMetaSchema.safeParse({ name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

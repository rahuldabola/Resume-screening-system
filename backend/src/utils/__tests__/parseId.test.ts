import { ApiError } from '../ApiError';
import { parseId } from '../parseId';

describe('parseId', () => {
  it('accepts a positive integer', () => {
    expect(parseId('42')).toBe(42);
  });

  it.each(['abc', '', undefined, '1.5', '0', '-3', 'NaN', '1e3abc'])(
    'rejects %p',
    (value) => {
      expect(() => parseId(value)).toThrow(ApiError);
    }
  );

  it('rejects with a 400, not a 404', () => {
    // A malformed id is a client error. Letting NaN through would reach SQLite
    // as a lookup that matches nothing, reporting "not found" for a request
    // that was never well-formed.
    try {
      parseId('abc');
      throw new Error('expected parseId to throw');
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(400);
    }
  });

  it('names the parameter in the message', () => {
    expect(() => parseId('abc', 'candidate id')).toThrow(/Invalid candidate id/);
  });
});

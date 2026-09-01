import { ApiError } from '../ApiError';

describe('ApiError', () => {
  it('carries a status code and message', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('ApiError');
  });

  it('is a real Error instance', () => {
    const err = new ApiError(500, 'Boom');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof ApiError).toBe(true);
  });
});

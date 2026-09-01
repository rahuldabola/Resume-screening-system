import { Request, Response } from 'express';
import { asyncHandler } from '../asyncHandler';

describe('asyncHandler', () => {
  it('calls the wrapped handler with req, res, next', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();

    await wrapped(req, res, next);
    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a thrown/rejected error to next() instead of throwing', async () => {
    const error = new Error('something broke');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    const next = jest.fn();
    await wrapped({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

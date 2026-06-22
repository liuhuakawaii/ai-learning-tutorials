import { Response } from 'express';

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200) {
  const response: SuccessResponse<T> = { success: true, data };
  if (message) response.message = message;
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, code: string, message: string, statusCode = 500) {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number
) {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  return res.status(200).json(response);
}

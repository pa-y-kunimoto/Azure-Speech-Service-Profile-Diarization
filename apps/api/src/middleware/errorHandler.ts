/**
 * Global error handling middleware
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Application error with status code
 */
export class AppError extends Error {
	constructor(
		public statusCode: number,
		message: string,
		public code?: string
	) {
		super(message);
		this.name = 'AppError';
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Validation error for request data
 */
export class ValidationError extends AppError {
	constructor(
		message: string,
		public details?: Record<string, string>
	) {
		super(400, message, 'VALIDATION_ERROR');
		this.name = 'ValidationError';
	}
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(404, `${resource} not found`, 'NOT_FOUND');
		this.name = 'NotFoundError';
	}
}

/**
 * Azure service error
 */
export class AzureServiceError extends AppError {
	constructor(
		message: string,
		public azureErrorCode?: string
	) {
		super(502, message, 'AZURE_SERVICE_ERROR');
		this.name = 'AzureServiceError';
	}
}

/**
 * Error response format
 */
interface ErrorResponse {
	error: string;
	message: string;
	code?: string | undefined;
	details?: Record<string, string> | undefined;
	stack?: string | undefined;
}

/**
 * Express error handling middleware
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
	console.error('Error:', err);

	const isDevelopment = process.env.NODE_ENV === 'development';

	// Handle known application errors
	if (err instanceof AppError) {
		const response: ErrorResponse = {
			error: err.name,
			message: err.message,
			code: err.code,
		};

		if (err instanceof ValidationError && err.details) {
			response.details = err.details;
		}

		if (isDevelopment && err.stack) {
			response.stack = err.stack;
		}

		res.status(err.statusCode).json(response);
		return;
	}

	// Handle unexpected errors
	const response: ErrorResponse = {
		error: 'InternalServerError',
		message: isDevelopment ? err.message : 'An unexpected error occurred',
	};

	if (isDevelopment && err.stack) {
		response.stack = err.stack;
	}

	res.status(500).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
	fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}

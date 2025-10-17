import { ZodError } from 'zod';

function formatZodError(err) {
	return {
		errors: err.issues.map(i => ({
			path: i.path.join('.'),
			message: i.message,
			code: i.code,
		})),
	};
}

function validate(schemas = {}) {
	return (req, res, next) => {
		try {
			if (schemas.body) req.body = schemas.body.parse(req.body);
			if (schemas.params) req.params = schemas.params.parse(req.params);
			if (schemas.query) req.query = schemas.query.parse(req.query);
			return next();
		} catch (err) {
			if (err instanceof ZodError) {
				return res.status(400).json(formatZodError(err));
			}
			return next(err);
		}
	};
}

export function validateUpload(opts) {
	return (req, res, next) => {
		try {
			opts.body.parse(req.body ?? {});
			if (!req.file) throw new Error('No file uploaded');
			opts.file.parse(req.file);
			next();
		} catch (e) {
			return res.status(400).json(e.message || 'INVALID_UPLOAD');
		}
	};
}

export default validate;

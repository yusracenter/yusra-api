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

export function validateUpload({ body, file } = {}) {
	return (req, res, next) => {
		try {
			if (body) req.body = body.parse(req.body);
			if (file) {
				if (!req.file) {
					return res.status(400).json({ errors: [{ path: 'file', message: 'File is required' }] });
				}
				file.parse(req.file);
			}
			next();
		} catch (err) {
			if (err instanceof ZodError) {
				return res.status(400).json({
					errors: err.issues.map(i => ({
						path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
						message: i.message,
						code: i.code,
					})),
				});
			}
			next(err);
		}
	};
}

export default validate;

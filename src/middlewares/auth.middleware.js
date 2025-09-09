import { getAuth } from '@clerk/express';

const authMiddleware = (req, res, next) => {
	const auth = getAuth(req);

	if (!auth.userId) return res.status(401).send('Unauthorized');

	return next();
};

export default authMiddleware;

import { getAuth } from '@clerk/express';
import userModel from '../models/user.model.js';

const authMiddleware = async (req, res, next) => {
	const auth = getAuth(req);

	if (!auth.userId) return res.status(401).send('Unauthorized');

	const user = await userModel.findOne({ clerkId: auth.userId });

	if (!user) return res.status(401).send('Unauthorized');

	req.user = user;
	return next();
};

export default authMiddleware;

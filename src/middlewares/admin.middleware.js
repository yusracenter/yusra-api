import { getAuth } from '@clerk/express';
import userModel from '../models/user.model.js';
import { UserRole } from '../helpers/enum.js';

const adminMiddleware = async (req, res, next) => {
	const auth = getAuth(req);

	if (!auth.userId) return res.status(401).send('Unauthorized');

	const user = await userModel.findOne({ clerkId: auth.userId });
	const isAccess = [UserRole.ADMIN, UserRole.MODERATOR].includes(user.role);
	if (!user || !isAccess) return res.status(403).send('Forbidden');

	req.user = user;
	return next();
};

export default adminMiddleware;

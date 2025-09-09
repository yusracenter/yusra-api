import userModel from '../models/user.model.js';

async function getUser(req) {
	const auth = req.auth();
	const user = await userModel.findOne({ clerkId: auth.userId });
	return user;
}

export { getUser };

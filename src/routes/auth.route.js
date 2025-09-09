import express from 'express';
import catchAsync from '../utils/catchAsync.js';
import { clerkClient } from '@clerk/express';

const router = express.Router();

router.get(
	'/get-auth-token',
	catchAsync(async (req, res) => {
		const { userId } = req.query;
		if (!userId) {
			return res.status(400).json({ error: 'userId is required' });
		}

		const session = await clerkClient.sessions.createSession({
			userId,
		});

		const { jwt } = await clerkClient.sessions.getToken(session.id, '', 600000);

		res.json({ token: jwt });
	})
);

export default router;

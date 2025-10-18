import { requireAuth } from '@clerk/express';
import express from 'express';

import kidRoutes from './kid.routes.js';
import userRoutes from './user.routes.js';
import contactRoutes from './contact.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import paymentRoutes from './payment.routes.js';
import donationRoutes from './donation.routes.js';
import collaborationRoutes from './collaboration.routes.js';
import courseRoutes from './course.routes.js';
import adminRoutes from './admin.routes.js';

import authMiddleware from '../middlewares/auth.middleware.js';
import adminMiddleware from '../middlewares/admin.middleware.js';
import { readData } from '../utils/s3.js';

const router = express.Router();

router.use('/kids', requireAuth(), authMiddleware, kidRoutes);
router.use('/users', requireAuth(), authMiddleware, userRoutes);
router.use('/contacts', requireAuth(), authMiddleware, contactRoutes);
router.use('/enrollments', requireAuth(), authMiddleware, enrollmentRoutes);
router.use('/payments', requireAuth(), authMiddleware, paymentRoutes);
router.use('/collaborations', requireAuth(), authMiddleware, collaborationRoutes);
router.use('/online-courses', requireAuth(), authMiddleware, courseRoutes);
router.use('/donation', donationRoutes);
router.use('/health', (req, res) => res.send('OK'));
router.get('/data', async (req, res) => {
	const data = await readData();
	return res.json({ slides: data.slides, communities: data.communities });
});

router.use('/admin', requireAuth(), adminMiddleware, adminRoutes);

export default router;

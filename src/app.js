import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import cookieParser from 'cookie-parser';

import { clerkWebhookHandler } from './controllers/clerk.controller.js';

// Middlewares
import notFound from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';
import authMiddleware from './middlewares/auth.middleware.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import kidRoutes from './routes/kid.routes.js';
import userRoutes from './routes/user.routes.js';
import contactRoutes from './routes/contact.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import donationRoutes from './routes/donation.routes.js';

const app = express();

app.use(helmet());

app.post('/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhookHandler);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(
	clerkMiddleware({
		secretKey: process.env.CLERK_SECRET_KEY,
		publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
	})
);

app.use('/auth', authRoutes);
app.use('/kids', requireAuth(), authMiddleware, kidRoutes);
app.use('/users', requireAuth(), authMiddleware, userRoutes);
app.use('/contacts', requireAuth(), authMiddleware, contactRoutes);
app.use('/enrollments', requireAuth(), authMiddleware, enrollmentRoutes);
app.use('/payments', requireAuth(), authMiddleware, paymentRoutes);
app.use('/donation', donationRoutes);
app.use('/health', (req, res) => res.send('OK'));

app.use(notFound);
app.use(errorHandler);

export default app;

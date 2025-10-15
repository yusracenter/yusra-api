import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import cookieParser from 'cookie-parser';

import { clerkWebhookHandler } from './controllers/clerk.controller.js';

// Middlewares
import notFound from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';

// Routes
import appRoutes from './routes/app.routes.js';

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

app.use('/api', appRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

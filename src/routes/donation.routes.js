import express from 'express';
import catchAsync from '../utils/catchAsync.js';
import { stripe } from '../utils/stripe.js';

const router = express.Router();

router.post(
	'/session',
	catchAsync(async (req, res) => {
		const { amount } = req.body;

		if (!amount || isNaN(amount) || amount <= 0) {
			return res.status(400).json('Invalid donation amount');
		}

		const donation = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			mode: 'payment',
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: { name: 'Donation' },
						unit_amount: parseFloat(amount) * 100,
					},
					quantity: 1,
				},
			],
			success_url: `${process.env.CLIENT_URL}/donation/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.CLIENT_URL}/donation/cancel`,
			metadata: { programName: 'Donation' },
		});

		return res.status(200).json({ url: donation.url });
	})
);

export default router;

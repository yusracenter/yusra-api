import { Webhook } from 'svix';
import userModel from '../models/user.model.js';
import enrollmentModel from '../models/enrollment.model.js';
import programModel from '../models/program.model.js';
import { stripe } from '../utils/stripe.js';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const clerkWebhookHandler = async (req, res) => {
	const SIGNING_SECRET = process.env.SIGNING_SECRET;
	if (!SIGNING_SECRET) {
		return res.status(500).json({ message: 'Missing SIGNING_SECRET env' });
	}

	const svix_id = req.headers['svix-id'];
	const svix_timestamp = req.headers['svix-timestamp'];
	const svix_signature = req.headers['svix-signature'];
	if (!svix_id || !svix_timestamp || !svix_signature) {
		return res.status(400).send('Missing Svix headers');
	}

	const payload = req.body;
	const body = payload instanceof Buffer ? payload.toString('utf8') : String(payload);

	let evt;
	try {
		const wh = new Webhook(SIGNING_SECRET);
		evt = wh.verify(body, {
			'svix-id': svix_id,
			'svix-timestamp': svix_timestamp,
			'svix-signature': svix_signature,
		});
	} catch (err) {
		console.error('Webhook verify error:', err?.message);
		return res.status(400).send('Verification error');
	}

	const eventType = evt.type;
	const data = evt.data;

	try {
		if (eventType === 'user.created') {
			const { id, image_url, first_name, last_name, email_addresses } = data;
			const email = email_addresses?.[0]?.email_address || '';

			const user = await userModel.create({
				clerkId: id,
				avatar: image_url,
				firstName: first_name,
				lastName: last_name,
				email,
			});
			return res.status(201).json(user);
		}

		if (eventType === 'user.updated') {
			const { id, image_url, first_name, last_name } = data;

			const user = await userModel.findOneAndUpdate(
				{ clerkId: id },
				{ avatar: image_url, firstName: first_name, lastName: last_name }
			);
			if (!user) return res.status(404).json({ message: 'User not found' });
			return res.status(200).json(user);
		}

		if (eventType === 'user.deleted') {
			const { id } = data;
			const user = await userModel.findOneAndDelete({ clerkId: id });
			if (!user) return res.status(404).json({ message: 'User not found' });
			return res.status(204).send();
		}

		return res.status(200).json({ ok: true, received: eventType });
	} catch (err) {
		console.error('DB error:', err?.message);
		return res.status(500).json({ message: 'DB error' });
	}
};

export const stripeWebhookHandler = async (req, res) => {
	const sig = req.headers['stripe-signature'];

	if (!sig || !STRIPE_WEBHOOK_SECRET) {
		return res.status(400).json({ error: 'Missing signature or secret' });
	}

	let event;

	try {
		event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('❌ Webhook signature verification failed:', err.message);
		return res.status(400).json({ error: `Webhook Error: ${err.message}` });
	}

	try {
		switch (event.type) {
			case 'customer.subscription.deleted': {
				const subscription = event.data.object;
				await markSubscriptionCanceled(subscription.id);
				break;
			}

			case 'customer.subscription.updated': {
				const subscription = event.data.object;
				if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
					await markSubscriptionCanceled(subscription.id);
				} else if (subscription.status === 'active' || subscription.status === 'trialing') {
					await markSubscriptionActive(subscription.id);
				}
				break;
			}

			default:
				console.log(`Unhandled event type: ${event.type}`);
				break;
		}

		res.status(200).json({ received: true });
	} catch (err) {
		console.error('❌ Webhook handler error:', err);
		res.status(500).json({ error: 'Handler error' });
	}
};

async function markSubscriptionCanceled(subscriptionId) {
	const enrollment = await enrollmentModel.findOne({ subscriptionId });
	if (!enrollment) {
		console.warn('⚠️ Enrollment not found for subscription:', subscriptionId);
		return;
	}

	await programModel.updateOne({ _id: enrollment.program }, { $inc: { enrollments: -1 } });

	await enrollmentModel.updateOne({ _id: enrollment._id }, { status: 'canceled' });

	console.log(`🔻 Subscription ${subscriptionId} canceled.`);
}

async function markSubscriptionActive(subscriptionId) {
	const enrollment = await enrollmentModel.findOne({ subscriptionId });
	if (!enrollment) return;

	await enrollmentModel.updateOne({ _id: enrollment._id }, { status: 'active' });

	console.log(`✅ Subscription ${subscriptionId} active/trialing.`);
}

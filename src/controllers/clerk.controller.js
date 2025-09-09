import { Webhook } from 'svix';
import userModel from '../models/user.model.js';

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

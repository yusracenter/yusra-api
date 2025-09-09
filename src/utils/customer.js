import userModel from '../models/user.model.js';
import { stripe } from './stripe.js';

export const createCustomer = async userId => {
	const user = await userModel.findById(userId).lean();

	if (!user) {
		throw new Error('User not found');
	}

	const customer = await stripe.customers.create({
		email: user.email,
		name: user.fullName,
		metadata: { userId: user._id.toString() },
	});

	await userModel.findByIdAndUpdate(userId, { customerId: customer.id });

	return customer;
};

export const getCustomer = async userId => {
	const user = await userModel.findById(userId).lean();

	if (!user) {
		throw new Error('User not found');
	}

	if (!user.customerId) {
		return createCustomer(userId);
	}

	const customer = await stripe.customers.retrieve(user.customerId);

	return customer;
};

export const attachPaymentMethod = async (customerId, incomingPmId) => {
	const incoming = await stripe.paymentMethods.retrieve(incomingPmId);

	const list = await stripe.paymentMethods.list({
		customer: customerId,
		type: 'card',
		limit: 100,
	});

	const same = list.data.find(
		pm => pm.card && incoming.card && pm.card.fingerprint === incoming.card.fingerprint
	);

	if (same) {
		return same;
	}

	const newPm = await stripe.paymentMethods.attach(
		incomingPmId,
		{ customer: customerId },
		{ idempotencyKey: `attach-${customerId}-${incomingPmId}` }
	);
	return newPm;
};

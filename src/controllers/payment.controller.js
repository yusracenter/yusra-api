import { getUser } from '../utils/auth.js';
import catchAsync from '../utils/catchAsync.js';
import { getCustomer } from '../utils/customer.js';
import { stripe } from '../utils/stripe.js';

export const getPaymentMethods = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const paymentMethods = await stripe.paymentMethods.list({
		customer: customer.id,
		type: 'card',
		limit: 10,
	});

	const filteredPaymentMethods = paymentMethods.data.map(pm => ({
		name: `${pm.billing_details.name}`,
		card: `${pm.card?.brand}  ${pm.card?.last4}`,
		expiration: `${pm.card?.exp_month}/${pm.card?.exp_year}`,
		id: pm.id,
	}));

	return res.status(200).json({ paymentMethods: filteredPaymentMethods });
});

export const getPaymentHistory = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const invoices = await stripe.invoices.list({
		customer: customer.id,
		limit: 100,
	});
	const paymentIntents = await stripe.paymentIntents.list({
		customer: customer.id,
		limit: 100,
		expand: ['data.latest_charge.payment_intent'],
	});

	const fltrd = paymentIntents.data
		.filter(c => c.metadata.programName === 'Donation')
		.map(pi => ({
			created: pi.created,
			total: pi.amount,
			status: pi.status,
			paymentMethod: pi.metadata.brand,
			programName: pi.metadata.programName,
			invoicePdf: `${pi.latest_charge?.receipt_url}`,
		}));

	const filteredInvoices = invoices.data.map(invoice => ({
		created: invoice.created,
		total: invoice.total,
		status: `${invoice.status}`,
		paymentMethod: `${invoice.parent?.subscription_details?.metadata?.brand}`,
		programName: `${invoice.parent?.subscription_details?.metadata?.programName}`,
		invoicePdf: `${invoice.invoice_pdf}`,
	}));

	return res.status(200).json({
		paymentHistory: [...filteredInvoices, ...fltrd]
			.filter(c => c.total !== 0)
			.sort((a, b) => b.created - a.created),
	});
});

export const getPaymentIntent = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const { id } = req.params;

	const pi = await stripe.paymentIntents.retrieve(id, {
		expand: ['payment_method', 'latest_charge'],
	});

	if (pi.customer !== customer.id) {
		return res.status(400).json('This payment intent does not belong to you.');
	}

	return res.status(200).json({ pi });
});

export const addPaymentMethod = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const { paymentMethodId } = req.body;

	const incoming = await stripe.paymentMethods.retrieve(paymentMethodId);

	const list = await stripe.paymentMethods.list({
		customer: customer.id,
		type: 'card',
		limit: 100,
	});

	const same = list.data.find(
		pm => pm.card && incoming.card && pm.card.fingerprint === incoming.card.fingerprint
	);

	if (same) {
		return res.status(400).json('This card is already added.');
	}

	await stripe.paymentMethods.attach(
		paymentMethodId,
		{ customer: customer.id },
		{ idempotencyKey: `attach-${customer.id}-${paymentMethodId}` }
	);

	return res.status(200).json({ success: true, message: 'Payment method added successfully.' });
});

export const donate = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const { amount, paymentMethodId, isSave, brand, last4 } = req.body;

	if (isSave) {
		const incoming = await stripe.paymentMethods.retrieve(paymentMethodId);

		const list = await stripe.paymentMethods.list({
			customer: customer.id,
			type: 'card',
			limit: 100,
		});

		const same = list.data.find(
			pm => pm.card && incoming.card && pm.card.fingerprint === incoming.card.fingerprint
		);

		if (!same) {
			await stripe.paymentMethods.attach(
				paymentMethodId,
				{ customer: customer.id },
				{ idempotencyKey: `attach-${customer.id}-${paymentMethodId}` }
			);
		}
	}

	const pi = await stripe.paymentIntents.create({
		amount: parseFloat(amount) * 100,
		currency: 'usd',
		customer: customer.id,
		metadata: { userId: user._id.toString(), brand: `${brand} ${last4}`, programName: 'Donation' },
		payment_method: paymentMethodId,
	});

	return res.status(200).json({ clientSecret: pi.client_secret });
});

export const validateCoupon = catchAsync(async (req, res) => {
	const { couponId } = req.body;

	const list = await stripe.promotionCodes.list({
		code: couponId,
		active: true,
		limit: 1,
		expand: ['data.coupon'],
	});

	const promo = list.data[0];
	if (!promo) {
		return res.status(404).json('Coupon not found');
	}

	const coupon = promo.coupon;

	const summary = coupon.percent_off
		? { type: 'percent', value: coupon.percent_off }
		: { type: 'amount', value: coupon.amount_off, currency: coupon.currency?.toUpperCase() };

	return res.status(200).json({
		success: true,
		summary,
		promotionCodeId: promo.id,
		firstTimeTxnOnly: promo.restrictions?.first_time_transaction,
		expiresAt: promo.expires_at ? new Date(promo.expires_at * 1000).toISOString() : null,
	});
});

export const removePaymentMethod = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const { id } = req.params;

	const pm = await stripe.paymentMethods.retrieve(id);
	if (pm.customer !== customer.id) {
		return res.status(400).json('This payment method does not belong to you.');
	}

	const subs = await stripe.subscriptions.list({
		customer: customer.id,
		status: 'active',
		limit: 100,
	});

	const isUsed = subs.data.find(s => s.default_payment_method === id);

	if (isUsed) {
		return res
			.status(400)
			.json('This payment method is linked to an active subscription and cannot be removed.');
	}

	await stripe.paymentMethods.detach(id);

	return res.status(200).json({ message: 'Payment method removed successfully.', id });
});

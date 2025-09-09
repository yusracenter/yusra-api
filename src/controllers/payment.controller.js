import { getUser } from '../utils/auth.js';
import catchAsync from '../utils/catchAsync.js';
import { getCustomer } from '../utils/customer.js';
import { stripe } from '../utils/stripe.js';

export const getPaymentMethods = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json({ error: 'Customer not found' });
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

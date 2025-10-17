import { UserStatus } from '../helpers/enum.js';
import enrollmentModel from '../models/enrollment.model.js';
import userModel from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';
import programModel from '../models/program.model.js';
import { stripe } from '../utils/stripe.js';
import { getGender } from '../utils/index.js';
import { attachPaymentMethod, getCustomer } from '../utils/customer.js';

export const getEnrollmentProgram = catchAsync(async (req, res) => {
	const user = req.user;

	if (!user) {
		return res.status(404).json('User not found');
	}

	const users = await userModel
		.find({ parent: user._id, status: UserStatus.ACTIVE })
		.select('avatar firstName lastName enrollments birthday gender role')
		.populate({
			path: 'enrollments',
			model: enrollmentModel,
			select: 'program subscriptionId status',
			populate: { path: 'program', model: programModel, select: 'name type' },
		})
		.lean();

	const result = await Promise.all(
		(users ?? []).map(async kid => {
			const enroll = kid?.enrollments;

			if (!enroll || !enroll.subscriptionId) {
				return kid;
			}

			let stripeSub;

			try {
				stripeSub = await stripe.subscriptions.retrieve(enroll.subscriptionId, {
					expand: [
						'default_payment_method',
						'latest_invoice.payment_intent.payment_method',
						'latest_invoice.discounts',
					],
				});
			} catch (err) {}

			return { ...kid, enrollments: { ...enroll, stripe: stripeSub } };
		})
	);

	const programs = await programModel.find({ type: { $nin: ['All'] } });

	return res.status(200).json({ enrollments: result, programs });
});

export const getPrograms = catchAsync(async (req, res) => {
	const programs = await programModel.find().select('').lean();

	return res.status(200).json({ programs });
});

export const getProgramById = catchAsync(async (req, res) => {
	const { id } = req.params;

	const program = await programModel.findById(id);

	if (!program) {
		return res.status(404).json('Program not found');
	}

	return res.status(200).json({ program });
});

export const createSubscription = catchAsync(async (req, res) => {
	const { programId, paymentMethodId, kidId, coupon } = req.body;

	const user = req.user;
	if (!user) {
		return res.status(404).json('User not found');
	}

	const kid = await userModel.findOne({ _id: kidId, parent: user._id, status: UserStatus.ACTIVE });
	if (!kid) {
		return res.status(404).json('Kid not found');
	}

	const program = await programModel.findById(programId);
	if (!program) {
		return res.status(404).json('Program not found');
	}

	if (kid.gender !== getGender(program.type)) {
		return res.status(400).json('Kid gender does not match program type');
	}

	const existEnrollment = await enrollmentModel.findOne({
		kid: kidId,
		program: program._id.toString(),
		status: 'active',
	});
	if (existEnrollment) {
		return res.status(400).json('Kid is already enrolled in this program');
	}

	if (program.enrollments >= program.maxStudents) {
		return res
			.status(400)
			.json(
				'Sorry, this program is full. Please choose another program or contact support for more information.'
			);
	}

	const customer = await getCustomer(user._id);
	const customerCard = await attachPaymentMethod(customer.id, paymentMethodId);

	const subscription = await stripe.subscriptions.create({
		customer: customer.id,
		items: [{ price: program.priceId }],
		default_payment_method: customerCard.id,
		cancel_at_period_end: false,
		metadata: {
			userId: user._id.toString(),
			programId: program._id.toString(),
			brand: `${customerCard.card?.brand} ${customerCard.card?.last4}`,
			programName: program.name,
		},
		payment_behavior: 'default_incomplete',
		expand: ['latest_invoice.confirmation_secret'],
		discounts: coupon ? [{ promotion_code: coupon.id }] : undefined,
	});

	const clientSecret = subscription.latest_invoice.confirmation_secret.client_secret;

	return res.status(200).json({
		success: true,
		clientSecret,
		subscriptionId: subscription.id,
		status: subscription.status,
	});
});

export const enrollProgram = catchAsync(async (req, res) => {
	const {
		kidId,
		contactId,
		paymentMethodId,
		programId,
		subscriptionId,
		programPrice,
		paymentMethod,
	} = req.body;

	const user = req.user;
	if (!user) {
		return res.status(404).json('User not found');
	}

	const enrollment = await enrollmentModel.create({
		user: user._id,
		program: programId,
		contact: contactId,
		kid: kidId,
		subscriptionId,
		paymentMethodId,
		programPrice,
		paymentMethod,
		status: 'active',
	});

	await programModel.findByIdAndUpdate(programId, {
		$inc: { enrollments: 1 },
	});

	await userModel.findByIdAndUpdate(kidId, { enrollments: enrollment._id });

	return res.status(200).json({ message: 'Enrollment successful', success: true });
});

export const createFreeSubscription = catchAsync(async (req, res) => {
	const { kidId, programId, couponId } = req.body;

	const user = req.user;
	if (!user) {
		return res.status(404).json('User not found');
	}

	const kid = await userModel.findOne({ _id: kidId, parent: user._id, status: UserStatus.ACTIVE });
	if (!kid) {
		return res.status(404).json('Kid not found');
	}

	const program = await programModel.findById(programId);
	if (!program) {
		return res.status(404).json('Program not found');
	}

	if (kid.gender !== getGender(program.type)) {
		return res.status(400).json('Kid gender does not match program type');
	}

	const existEnrollment = await enrollmentModel.findOne({
		kid: kidId,
		program: program._id.toString(),
		status: 'active',
	});

	if (existEnrollment) {
		return res.status(400).json('Kid is already enrolled in this program');
	}

	if (program.enrollments >= program.maxStudents) {
		return res
			.status(400)
			.json(
				'Sorry, this program is full. Please choose another program or contact support for more information.'
			);
	}

	const customer = await getCustomer(user._id);

	const subscription = await stripe.subscriptions.create({
		customer: customer.id,
		items: [{ price: program.priceId }],
		metadata: {
			userId: user._id.toString(),
			programId: program._id.toString(),
			brand: `FREE2025`,
			programName: program.name,
		},
		discounts: [{ promotion_code: couponId }],
	});

	return res
		.status(200)
		.json({ subscriptionId: subscription.id, status: subscription.status, success: true });
});

export const renewSubscription = catchAsync(async (req, res) => {
	const { enrollmentId } = req.params;

	const enrollment = await enrollmentModel.findById(enrollmentId);
	if (!enrollment) {
		return res.status(404).json('Enrollment not found');
	}

	if (enrollment.status === 'active') {
		return res.status(400).json('Enrollment is already active');
	}

	await stripe.subscriptions.update(enrollment.subscriptionId, { cancel_at_period_end: false });

	await enrollmentModel.findByIdAndUpdate(enrollmentId, { status: 'active' });

	return res.status(200).json({ message: 'Subscription renewed successfully' });
});

export const toggleAutoRenew = catchAsync(async (req, res) => {
	const user = req.user;
	if (!user) {
		return res.status(404).json('User not found');
	}

	const { enrollmentId } = req.params;

	const enrollment = await enrollmentModel.findById(enrollmentId);
	if (!enrollment) {
		return res.status(404).json('No enrollment found');
	}

	const { toggleRenew } = req.body;

	await stripe.subscriptions.update(enrollment.subscriptionId, {
		cancel_at_period_end: toggleRenew,
	});

	await enrollmentModel.findByIdAndUpdate(enrollmentId, { status: 'active' });

	return res.status(200).json({ message: 'Auto-renew status updated successfully' });
});

export const updatePaymentMethod = catchAsync(async (req, res) => {
	const user = req.user;
	if (!user) {
		return res.status(404).json('User not found');
	}

	const { subscriptionId } = req.params;
	const { paymentMethodId } = req.body;

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found');
	}

	const sub = await stripe.subscriptions.retrieve(subscriptionId);
	if (!sub || sub.customer !== customer.id) {
		return res.status(404).json('Subscription not found');
	}

	if (sub.default_payment_method === paymentMethodId) {
		return res.status(400).json('This payment method is already set as default');
	}
	await attachPaymentMethod(customer.id, paymentMethodId);

	await stripe.subscriptions.update(subscriptionId, {
		default_payment_method: paymentMethodId,
	});

	return res.status(200).json({ message: 'Payment method updated successfully' });
});

export const cancelSubscription = catchAsync(async (req, res) => {
	const { enrollmentId } = req.params;

	const enrollment = await enrollmentModel.findById(enrollmentId);
	if (!enrollment) {
		return res.status(404).json('Enrollment not found');
	}

	if (enrollment.status === 'canceled') {
		return res.status(400).json('Enrollment is already canceled');
	}

	await stripe.subscriptions.cancel(enrollment.subscriptionId);
	await programModel.findOneAndUpdate(
		{ _id: enrollment.program, enrollments: { $gt: 0 } },
		{ $inc: { enrollments: -1 } }
	);
	await userModel.findByIdAndUpdate(enrollment.kid, { enrollments: null });
	await enrollmentModel.findByIdAndUpdate(enrollmentId, { status: 'canceled' });

	return res.status(200).json({ message: 'Subscription canceled successfully' });
});

import { UserRole, UserStatus } from '../helpers/enum.js';
import enrollmentModel from '../models/enrollment.model.js';
import programModel from '../models/program.model.js';
import userModel from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';
import { attachPaymentMethod, getCustomer } from '../utils/customer.js';
import { stripe } from '../utils/stripe.js';

export const getCollaborationStatus = catchAsync(async (req, res) => {
	const user = req.user;

	const collaboration = await programModel.find({ type: 'All', active: true });

	const enrollments = await enrollmentModel
		.find({ contact: user._id, $nor: [{ status: 'removed' }] })
		.populate({ path: 'program', model: programModel })
		.populate({ path: 'kid', model: userModel })
		.populate({ path: 'contact', model: userModel })
		.lean();

	const result = await Promise.all(
		enrollments.map(async e => {
			if (!e || !e.subscriptionId) return e;

			const sub = await stripe.subscriptions.retrieve(e.subscriptionId, {
				expand: [
					'default_payment_method',
					'latest_invoice.payment_intent.payment_method',
					'latest_invoice.discounts',
				],
			});

			return { ...e, stripe: sub };
		})
	);

	return res.status(200).json({ enrollments: result, collaboration });
});

export const getKidsByProgram = catchAsync(async (req, res) => {
	const { programId } = req.params;
	const user = req.user;

	const kids = await userModel.find({
		parent: user._id,
		role: UserRole.KID,
		status: UserStatus.ACTIVE,
	});

	const enrollments = await enrollmentModel
		.find({ program: programId, contact: user._id })
		.distinct('kid');

	const enrolledIds = new Set(enrollments.map(id => id.toString()));

	const filteredKids = kids.map(kid => ({
		...kid.toObject(),
		isEnrolled: enrolledIds.has(kid._id.toString()),
	}));

	return res.status(200).json({ kids: filteredKids });
});

export const meIsEnrolled = catchAsync(async (req, res) => {
	const { programId } = req.params;
	const user = req.user;
	const enrollments = await enrollmentModel
		.find({ kid: user._id, program: programId })
		.select('_id');

	return res.status(200).json({ isEnrolled: enrollments.length > 0 ? true : false });
});

export const getCollaborationById = catchAsync(async (req, res) => {
	const { programId } = req.params;
	const user = req.user;

	const program = await programModel.findById(programId);
	if (!program) {
		return res.status(404).json('Program not found.');
	}

	const kids = await userModel.find({
		parent: user._id,
		role: UserRole.KID,
		status: UserStatus.ACTIVE,
	});

	const enrollments = await enrollmentModel
		.find({ program: programId, contact: user._id, status: 'active' })
		.distinct('kid');

	const enrolledIds = new Set(enrollments.map(id => id.toString()));

	const filteredKids = kids.map(kid => ({
		...kid.toObject(),
		isEnrolled: enrolledIds.has(kid._id.toString()),
	}));

	const userEnrollment = await enrollmentModel
		.find({ kid: user._id, program: programId, status: 'active' })
		.select('_id');

	return res.status(200).json({
		collaboration: program,
		kids: filteredKids,
		isEnrolled: userEnrollment.length > 0 ? true : false,
	});
});

export const createSubscription = catchAsync(async (req, res) => {
	const { programId } = req.params;
	const { userId, pmId, save, coupon } = req.body;
	const user = req.user;

	const program = await programModel.findById(programId);
	if (!program) {
		return res.status(404).json('Program not found.');
	}

	if (program.type !== 'All') {
		return res.status(400).json('This program is not for collaboration.');
	}

	if (program.maxStudents && program.enrollments >= program.maxStudents) {
		return res.status(400).json('Maximum students limit reached for this program.');
	}

	const customer = await getCustomer(user._id);
	if (!customer) {
		return res.status(404).json('Customer not found.');
	}

	let paymentMethod;
	if (save) {
		paymentMethod = await attachPaymentMethod(customer.id, pmId);
	} else {
		paymentMethod = await stripe.paymentMethods.retrieve(pmId);
	}

	const subscription = await stripe.subscriptions.create({
		customer: customer.id,
		items: [{ price: program.priceId, quantity: 1 }],
		default_payment_method: paymentMethod.id,
		payment_behavior: 'default_incomplete',
		expand: ['latest_invoice.confirmation_secret'],
		discounts: coupon ? [{ promotion_code: coupon }] : [],
		metadata: {
			programId: String(program._id),
			userId: String(userId),
			programName: program.name,
			brand: `${paymentMethod.card?.brand} ${paymentMethod.card?.last4}`,
		},
	});

	return res.status(200).json({
		success: true,
		clientSecret: subscription.latest_invoice.confirmation_secret,
		subscriptionId: subscription.id,
	});
});

export const confirmSubscription = catchAsync(async (req, res) => {
	const { programId } = req.params;
	const { subId, userId } = req.body;
	const user = req.user;

	const subs = await stripe.subscriptions.retrieve(subId);
	const program = await programModel.findById(programId);

	await programModel.findByIdAndUpdate(programId, { $inc: { enrollments: 1 } });
	await enrollmentModel.create({
		kid: userId,
		program: programId,
		subscriptionId: subId,
		status: 'active',
		paymentMethodId: subs.default_payment_method,
		programPrice: program.price,
		contact: user._id,
	});

	return res.status(200).json({ success: true });
});

export const removeFromProfile = catchAsync(async (req, res) => {
	const { enrollmentId } = req.params;

	const enrollment = await enrollmentModel.findById(enrollmentId);
	if (!enrollment) {
		return res.status(404).json('Enrollment not found.');
	}

	if (enrollment.status === 'removed') {
		return res.status(400).json('Enrollment already removed.');
	}

	await enrollmentModel.findByIdAndUpdate(enrollmentId, { status: 'removed' });
	return res.status(200).json({ message: 'Enrollment removed from profile.' });
});

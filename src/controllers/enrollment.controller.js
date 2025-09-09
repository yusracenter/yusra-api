import { UserRole, UserStatus } from '../helpers/enum.js';
import enrollmentModel from '../models/enrollment.model.js';
import userModel from '../models/user.model.js';
import { getUser } from '../utils/auth.js';
import catchAsync from '../utils/catchAsync.js';
import programModel from '../models/program.model.js';
import { stripe } from '../utils/stripe.js';
import { getGender } from '../utils/index.js';
import { attachPaymentMethod, getCustomer } from '../utils/customer.js';

export const createSubscription = catchAsync(async (req, res) => {
	const { programId, paymentMethodId, kidId, coupon } = req.body;

	const user = await getUser(req);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}

	const kid = await userModel.findOne({ _id: kidId, parent: user._id, status: UserStatus.ACTIVE });
	if (!kid) {
		return res.status(404).json({ error: 'Kid not found' });
	}

	const program = await programModel.findById(programId);
	if (!program) {
		return res.status(404).json({ error: 'Program not found' });
	}

	if (kid.gender !== getGender(program.type)) {
		return res.status(400).json({ error: 'Kid gender does not match program type' });
	}

	const existEnrollment = await enrollmentModel.findOne({
		kid: kidId,
		program: program._id.toString(),
		status: 'active',
	});
	if (existEnrollment) {
		return res.status(400).json({ error: 'Kid is already enrolled in this program' });
	}

	if (program.enrollments >= program.maxStudents) {
		return res.status(400).json({
			error:
				'Sorry, this program is full. Please choose another program or contact support for more information.',
		});
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

	const user = await getUser(req);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
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

export const getEnrollmentProgram = catchAsync(async (req, res) => {
	const user = await getUser(req);

	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}

	let users;

	if (user.role === UserRole.STUDENT) {
		const student = await userModel
			.findById(user._id)
			.populate({
				path: 'enrollments',
				model: enrollmentModel,
				populate: { path: 'program', model: programModel },
			})
			.lean();

		users = [student];
	} else {
		users = await userModel
			.find({ parent: user._id, status: UserStatus.ACTIVE })
			.select('avatar firstName lastName enrollments birthday gender')
			.populate({
				path: 'enrollments',
				model: enrollmentModel,
				select: 'program subscriptionId status',
				populate: { path: 'program', model: programModel, select: 'name type' },
			})
			.lean();
	}

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

			return {
				...kid,
				enrollments: {
					...enroll,
					stripe: {
						cancel_at_period_end: stripeSub?.cancel_at_period_end,
						status: stripeSub?.status,
						start_date: stripeSub?.start_date,
						canceled_at: stripeSub?.canceled_at,
						trial_end: stripeSub?.trial_end,
						plan: { amount: stripeSub.plan.amount },
						latest_invoice: {
							discounts: [
								{
									coupon: {
										name: stripeSub?.latest_invoice?.discounts?.[0]?.coupon?.name,
										amount_off: stripeSub?.latest_invoice?.discounts?.[0]?.coupon?.amount_off,
									},
								},
							],
							created: stripeSub?.latest_invoice?.created,
							invoice_pdf: stripeSub?.latest_invoice?.invoice_pdf,
						},
						default_payment_method: {
							card: {
								brand: stripeSub?.default_payment_method?.card?.brand,
								last4: stripeSub?.default_payment_method?.card?.last4,
							},
						},
					},
				},
			};
		})
	);

	return res.status(200).json({ enrollments: result });
});

export const getPrograms = catchAsync(async (req, res) => {
	const programs = await programModel.find().select('').lean();

	return res.status(200).json({ programs });
});

export const getProgramById = catchAsync(async (req, res) => {
	const { id } = req.params;

	const program = await programModel.findById(id).lean();

	if (!program) {
		return res.status(404).json({ error: 'Program not found' });
	}

	return res.status(200).json({ program });
});

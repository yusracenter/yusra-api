import { UserRole, UserStatus } from '../helpers/enum.js';
import enrollmentModel from '../models/enrollment.model.js';
import programModel from '../models/program.model.js';
import userModel from '../models/user.model.js';
import attendanceModel from '../models/attendance.model.js';
import courseModel from '../models/course.model.js';
import catchAsync from '../utils/catchAsync.js';
import { stripe } from '../utils/stripe.js';
import qrCodeModel from '../models/qr-code.model.js';
import { getDateKey } from '../utils/index.js';
import lessonModel from '../models/lesson.model.js';
import purchaseModel from '../models/purchase.model.js';

export const getAllPrograms = catchAsync(async (req, res) => {
	const { type } = req.query;

	const query = {};

	switch (type) {
		case 'Girls':
			query.type = 'Girls';
			break;
		case 'Boys':
			query.type = 'Boys';
			break;
		case 'Collaborations':
			query.type = 'All';
			break;
		case 'All':
			break;
	}

	const programs = await programModel.find(query).sort({ createdAt: -1 });

	const enrolledCounts = await enrollmentModel.aggregate([
		{ $match: { status: 'active' } },
		{ $group: { _id: '$program', count: { $sum: 1 } } },
	]);

	const enrolledMap = new Map();
	enrolledCounts.forEach(ec => {
		enrolledMap.set(ec._id.toString(), ec.count);
	});

	programs.forEach(p => {
		const count = enrolledMap.get(p._id.toString()) || 0;
		p.enrollments = count;
	});

	return res.status(200).json({ programs });
});
export const getProgramById = catchAsync(async (req, res) => {
	const { id } = req.params;

	const program = await programModel.findById(id);
	if (!program) {
		return res.status(404).json('Program not found');
	}

	const totalStudents = await enrollmentModel.countDocuments({ program: id });
	const activeStudents = await enrollmentModel.countDocuments({ program: id, status: 'active' });
	const cancelededStudents = await enrollmentModel.countDocuments({
		program: id,
		status: { $in: ['canceled', 'removed'] },
	});

	return res.status(200).json({ program, totalStudents, activeStudents, cancelededStudents });
});
export const getProgramEnrollments = catchAsync(async (req, res) => {
	const { id } = req.params;

	const enrollments = await enrollmentModel
		.find({ program: id })
		.populate({
			path: 'program',
			model: programModel,
			select: 'name startDate endDate maxStudents type maxAge priceId productId enrollments',
		})
		.populate({
			path: 'contact',
			model: userModel,
			select: 'email address phone firstName lastName birthday',
		})
		.populate({
			path: 'kid',
			model: userModel,
			select: 'birthday allergies firstName lastName notes gender status qrCode',
			populate: {
				path: 'parent',
				model: userModel,
				select: 'email phone firstName lastName address',
			},
		})
		.select('subscriptionId program contact kid createdAt invoice_pdf')
		.sort({ createdAt: -1 })
		.lean();

	const ids = Array.from(new Set(enrollments.map(e => e.subscriptionId).filter(Boolean)));

	const stripeSubsArr = await Promise.all(
		ids.map(async id => {
			try {
				const sub = await stripe.subscriptions.retrieve(id, {
					expand: [
						'default_payment_method',
						'latest_invoice.payment_intent.payment_method',
						'latest_invoice.discounts',
					],
				});
				return sub;
			} catch {
				return null;
			}
		})
	);

	const subsMap = new Map();
	stripeSubsArr.forEach((s, i) => {
		if (s) subsMap.set(ids[i], s);
	});

	const result = enrollments.map(e => {
		const stripeSubs = e.subscriptionId ? subsMap.get(e.subscriptionId) ?? null : null;
		return { ...e, subscription: stripeSubs };
	});

	return res.status(200).json({ enrollments: result });
});
export const getAllUsers = catchAsync(async (req, res) => {
	const { searchQuery: q, role, gender, enrollment, status, page = 1, pageSize = 20 } = req.query;
	const skipAmount = (page - 1) * pageSize;

	const query = {};

	if (q) {
		const escapedSearchQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		query.$or = [
			{ firstName: { $regex: new RegExp(escapedSearchQuery, 'i') } },
			{ lastName: { $regex: new RegExp(escapedSearchQuery, 'i') } },
			{ email: { $regex: new RegExp(escapedSearchQuery, 'i') } },
			{ phone: { $regex: new RegExp(escapedSearchQuery, 'i') } },
		];
	}

	switch (role) {
		case UserRole.CONTACT:
			query.role = UserRole.CONTACT;
			break;
		case UserRole.KID:
			query.role = UserRole.KID;
			break;
		case UserRole.USER:
			query.role = UserRole.USER;
			break;
		case UserRole.ADMIN:
			query.role = UserRole.ADMIN;
			break;
		case UserRole.MODERATOR:
			query.role = UserRole.MODERATOR;
			break;
	}

	switch (gender) {
		case 'Male':
			query.gender = 'Male';
			break;
		case 'Female':
			query.gender = 'Female';
			break;
	}

	switch (enrollment) {
		case 'enrolled':
			query.enrollments = { $ne: null };
			query.role = UserRole.KID;
			break;
		case 'watchlist':
			query.enrollments = null;
			query.role = UserRole.KID;
			break;
	}

	switch (status) {
		case 'active':
			query.status = 'active';
			break;
		case 'inactive':
			query.status = 'inactive';
			break;
	}

	const users = await userModel
		.find(query)
		.populate({
			path: 'enrollments',
			model: enrollmentModel,
			select: 'program',
			populate: { path: 'program', model: programModel, select: 'name type' },
		})
		.skip(skipAmount)
		.limit(pageSize);

	const totalUsers = await userModel.countDocuments(query);
	const isNext = totalUsers > skipAmount + users.length;

	return res.status(200).json({ users, isNext });
});
export const getUserStats = catchAsync(async (req, res) => {
	const totalUsers = await userModel.countDocuments();
	const totalStudents = await userModel.countDocuments({ role: UserRole.KID });
	const totalContacts = await userModel.countDocuments({ role: UserRole.CONTACT });
	const totalEnrolled = await userModel.countDocuments({ enrollments: { $ne: null } });

	return res.status(200).json({
		totalUsers,
		totalStudents,
		totalContacts,
		totalEnrolled,
	});
});
export const getAttendanceKids = catchAsync(async (req, res) => {
	const { id } = req.params;

	const kid = await userModel.findById(id);
	if (!kid) return res.status(404).json('Kid not found');
	if (kid.role !== UserRole.KID) return res.status(400).json({ failure: 'User is not a kid' });

	const kids = await userModel
		.find({ parent: kid.parent, role: UserRole.KID, status: UserStatus.ACTIVE })
		.select('firstName lastName enrollments')
		.populate({
			path: 'enrollments',
			model: enrollmentModel,
			select: 'program status',
			populate: { path: 'program', model: programModel, select: 'name type' },
		});

	return res.status(200).json({ kids });
});
export const getAllCourses = catchAsync(async (req, res) => {
	const courses = await courseModel.find().sort({ createdAt: -1 });
	return res.status(200).json({ courses });
});
export const getCourseById = catchAsync(async (req, res) => {
	const { id } = req.params;

	const course = await courseModel.findById(id);
	if (!course) {
		return res.status(404).json('Course not found');
	}

	return res.status(200).json({ course });
});
export const getCourseLessons = catchAsync(async (req, res) => {
	const { id } = req.params;

	const course = await courseModel.findById(id);
	if (!course) {
		return res.status(404).json('Course not found');
	}

	const lessons = await lessonModel.find({ course: id }).sort({ position: 1 });

	return res.status(200).json({ lessons });
});
export const getCoursePurchases = catchAsync(async (req, res) => {
	const { id } = req.params;
	const { page, pageSize, searchQuery } = req.query;

	const course = await courseModel.findById(id).select('_id');
	if (!course) return { failure: 'Course not found' };

	const skipAmount = (Math.max(1, page) - 1) * pageSize;

	const purchaseQuery = { course: course._id };

	if (searchQuery && String(searchQuery).trim().length > 0) {
		const escaped = String(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(escaped, 'i');

		const matchedUsers = await userModel
			.find({
				$or: [
					{ firstName: { $regex: regex } },
					{ lastName: { $regex: regex } },
					{ email: { $regex: regex } },
				],
			})
			.select('_id')
			.limit(1000)
			.lean();

		const matchedIds = matchedUsers.map(u => u._id);
		if (matchedIds.length === 0) {
			return { purchases: [], isNext: false, total: 0 };
		}
		purchaseQuery.user = { $in: matchedIds };
	}

	const total = await purchaseModel.countDocuments(purchaseQuery);

	const purchases = await purchaseModel
		.find(purchaseQuery)
		.sort({ createdAt: -1 })
		.skip(skipAmount)
		.limit(pageSize)
		.populate({ path: 'user', model: userModel, select: 'firstName lastName avatar email' })
		.populate({ path: 'course', model: courseModel, select: 'title slug previewImage' })
		.lean()
		.exec();

	const isNext = total > skipAmount + purchases.length;

	return res.status(200).json({ purchases, isNext, total });
});

export const createProgram = catchAsync(async (req, res) => {
	const parsedInput = req.body;

	const product = await stripe.products.create({ name: parsedInput.name });
	if (!product) {
		return res.status(500).json('Failed to create product in Stripe');
	}

	const price = await stripe.prices.create({
		currency: 'usd',
		product: product.id,
		nickname: product.name,
		unit_amount: +parsedInput.price * 100,
		recurring: { interval: 'month' },
	});
	if (!price) {
		await stripe.products.update(product.id, { active: false });
		return res.status(500).json('Failed to create price in Stripe');
	}

	const newProgram = new programModel({
		...parsedInput,
		productId: product.id,
		priceId: price.id,
	});

	await newProgram.save();

	return res.status(201).json({ message: 'Program created successfully' });
});
export const transferProgram = catchAsync(async (req, res) => {
	const parsedInput = req.body;
	const {
		currentProductId,
		newProductId,
		userId,
		currentSubscriptionId,
		enrollmentId,
		invoice_pdf,
		trialPeriodDays,
	} = parsedInput;

	const program = await programModel.findById(currentProductId);
	if (!program) {
		return res.status(404).json('Current program not found');
	}

	const user = await userModel.findById(userId);
	if (!user) {
		return res.status(404).json('User not found');
	}

	const currentSubscription = await stripe.subscriptions.retrieve(currentSubscriptionId);
	if (!currentSubscription) {
		return res.status(404).json('Current subscription not found');
	}

	const newProgram = await programModel.findById(newProductId);
	if (!newProgram) {
		return res.status(404).json('New program not found');
	}

	const pm = await stripe.paymentMethods.retrieve(currentSubscription.default_payment_method);

	const newSub = await stripe.subscriptions.create({
		customer: user.customerId,
		items: [{ price: newProgram.priceId }],
		default_payment_method: currentSubscription.default_payment_method,
		collection_method: 'charge_automatically',
		trial_period_days: trialPeriodDays,
		cancel_at_period_end: false,
		metadata: {
			userId: user._id.toString(),
			programId: program._id.toString(),
			brand: `${pm.card?.brand} ${pm.card?.last4}`,
			programName: program.name,
		},
	});

	await stripe.subscriptions.cancel(currentSubscriptionId);
	await programModel.findByIdAndUpdate(currentProductId, { $inc: { enrollments: -1 } });

	await programModel.findByIdAndUpdate(newProductId, { $inc: { enrollments: 1 } });
	await enrollmentModel.findOneAndUpdate(
		{ _id: enrollmentId },
		{ program: newProgram._id, subscriptionId: newSub.id, invoice_pdf }
	);

	await stripe.subscriptions.update(newSub.id, {});

	return res.status(200).json({ message: 'Program transferred successfully' });
});
export const atendanceUsers = catchAsync(async (req, res) => {
	const { id } = req.body;

	const attendances = await attendanceModel.find({ dateKey: id }).populate({
		path: 'kid',
		model: userModel,
		populate: {
			path: 'enrollments',
			model: enrollmentModel,
			select: 'program',
			populate: { path: 'program', model: programModel, select: 'name type' },
		},
	});

	return res.status(200).json({ attendances });
});
export const toggleAttendance = catchAsync(async (req, res) => {
	const TEN_MIN = 10 * 60 * 1000;

	const { code } = req.body;
	if (!code) {
		return res.status(400).json('QR code is required');
	}

	const qr = await qrCodeModel.findOne({ code });

	if (!qr) {
		return res.status(404).json('QR code not found');
	}

	const kidId = qr.kid;
	if (!kidId) {
		return res.status(404).json('QR code is not linked to any kid.');
	}

	const user = await userModel.findById(kidId).populate({
		path: 'enrollments',
		model: enrollmentModel,
		select: 'subscriptionId',
	});
	if (!user) {
		return res.status(404).json('User not found.');
	}

	if (!user.enrollments) {
		return res.status(404).json('User is not enrolled in any program.');
	}

	if (user.enrollments) {
		const sub = await stripe.subscriptions.retrieve(user.enrollments.subscriptionId);
		if (!['active', 'trialing', 'past_due'].includes(sub.status)) {
			return res.status(400).json('User subscription is not active.');
		}
	}

	const now = new Date();
	const dateKey = getDateKey(now);

	let att = await attendanceModel.findOne({ kid: kidId, dateKey });

	if (!att) {
		att = await attendanceModel.create({ kid: kidId, dateKey, checkedInAt: now });

		return res.status(200).json({
			success: true,
			action: 'checkin',
			message: `${user.firstName + (user.lastName ? ` ${user.lastName}` : '')} Checked in.`,
			waitMinutesBeforeCheckout: 10,
		});
	}

	if (!att.checkedInAt) {
		att.checkedInAt = now;
		await att.save();
		return res.status(200).json({
			success: true,
			action: 'checkin',
			message: ` ${user.firstName + (user.lastName ? ` ${user.lastName}` : '')} Checked in.`,
			waitMinutesBeforeCheckout: 10,
		});
	}

	if (att.checkedOutAt) {
		return res.status(400).json('Already checked out today.');
	}

	const elapsed = now.getTime() - new Date(att.checkedInAt).getTime();
	if (elapsed < TEN_MIN) {
		const remainMs = TEN_MIN - elapsed;
		const remainMin = Math.ceil(remainMs / 60000);
		return res
			.status(400)
			.json(`Checkout is allowed after 10 minutes. Please wait ~${remainMin} minute(s).`);
	}

	att.checkedOutAt = now;
	await att.save();

	return res.status(200).json({
		success: true,
		action: 'checkout',
		message: ` ${user.firstName + (user.lastName ? ` ${user.lastName}` : '')} Checked out.`,
	});
});
export const createCourse = catchAsync(async (req, res) => {
	await courseModel.create(req.body);
	return res.status(201).json({ message: 'Course created successfully' });
});
export const createCourseLesson = catchAsync(async (req, res) => {
	const { id, ...payload } = req.body;

	const lastLesson = await lessonModel.findOne({ course: id }).sort({ position: -1 });
	const position = lastLesson ? lastLesson.position + 1 : 1;
	await lessonModel.create({ ...payload, course: id, position });

	return res.status(201).json({ message: 'Lesson created successfully' });
});

export const updateProgram = catchAsync(async (req, res) => {
	const parsedInput = req.body;

	const program = await programModel.findById(parsedInput.id).select('_id productId price');
	if (!program) {
		return res.status(404).json('Program not found');
	}

	const product = await stripe.products.update(program.productId, {
		name: parsedInput.name,
	});
	if (!product) {
		return res.status(500).json('Failed to update product in Stripe');
	}

	if (parsedInput.price !== program.price) {
		const price = await stripe.prices.create({
			currency: 'usd',
			product: product.id,
			nickname: product.name,
			unit_amount: +parsedInput.price * 100,
			recurring: { interval: 'month' },
		});

		if (!price) {
			return res.status(500).json('Failed to create new price in Stripe');
		}
		program.priceId = price.id;
	}

	const updatedProgram = await Program.findByIdAndUpdate(parsedInput.id, {
		...parsedInput,
		priceId: program.priceId,
	});

	return res.status(200).json({ message: 'Program updated successfully' });
});
export const renewEnrollmentOff = catchAsync(async (req, res) => {
	const { id } = req.params;
	const enrollments = await enrollmentModel.find({
		program: id,
		status: { $in: ['active', 'trialing'] },
	});

	const subIds = enrollments.map(e => e.subscriptionId);
	if (subIds.length === 0) {
		return res.status(400).json('No active or trialing enrollments found for this program');
	}

	const activeTrialingSubs = [];
	for (const subId of subIds) {
		const sub = await stripe.subscriptions.retrieve(subId);
		if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
			activeTrialingSubs.push(subId);
		}
	}

	if (activeTrialingSubs.length === 0) {
		return res.status(400).json('No active or trialing subscriptions found to renew off');
	}

	for (const subId of activeTrialingSubs) {
		await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
	}

	await programModel.findByIdAndUpdate(id, { active: false });
	return res
		.status(200)
		.json({ message: 'Program set to not renew for all active and trialing enrollments' });
});
export const updateUserRole = catchAsync(async (req, res) => {
	const { id } = req.params;

	const user = await userModel.findById(id);
	if (!user) return res.status(404).json('User not found');

	const isAccess = [UserRole.USER, UserRole.MODERATOR].includes(user.role);
	if (!isAccess) return res.status(403).json('Only users and moderators can perform this action');

	if (user.role === UserRole.USER) {
		await userModel.findByIdAndUpdate(id, { role: UserRole.MODERATOR });
	}

	if (user.role === UserRole.MODERATOR) {
		await userModel.findByIdAndUpdate(id, { role: UserRole.USER });
	}

	return res.status(200).json({ message: 'User role updated successfully' });
});
export const updateKidAttendance = catchAsync(async (req, res) => {
	const { kidId, attendanceId, qrCode } = req.body;

	const attendance = await attendanceModel.findById(attendanceId);
	if (!attendance) return res.status(404).json('Attendance record not found');

	const kid = await userModel.findById(kidId);
	if (!kid) return res.status(404).json('Kid not found');
	if (kid.role !== UserRole.KID) return res.status(403).json('User is not a kid');
	if (!kid.enrollments) return res.status(400).json('Kid is not enrolled in any program');

	await attendanceModel.findByIdAndUpdate(attendanceId, { kid: kid._id });

	if (!kid.qrCodeModel) {
		let id = qrCode;
		const existingCode = await qrCodeModel.findOne({ code: id });
		if (existingCode) {
			id = qrCode;
		}

		const scanUrl = `${process.env.CLIENT_URL}/admin/static-scan?token=${id}`;

		const createdQRCode = await qrCodeModel.create({
			kid: kid._id,
			code: id,
			scanUrl,
		});

		kid.qrCodeModel = createdQRCode._id;
		kid.qrCode = id;
		await kid.save();
	}

	return res.status(200).json({ message: 'Attendance updated successfully' });
});
export const updateKidAttendanceManual = catchAsync(async (req, res) => {
	const { attendanceId, checkedInAt, checkedOutAt } = req.body;

	await attendanceModel.findByIdAndUpdate(attendanceId, {
		checkedInAt: checkedInAt ? new Date(checkedInAt) : null,
		checkedOutAt: checkedOutAt ? new Date(checkedOutAt) : null,
	});

	return res.status(200).json({ message: 'Attendance updated successfully' });
});
export const updateCourse = catchAsync(async (req, res) => {
	const { id } = req.params;

	const course = await courseModel.findById(id);
	if (!course) {
		return res.status(404).json('Course not found');
	}

	await courseModel.findByIdAndUpdate(id, req.body);

	return res.status(200).json({ message: 'Course updated successfully' });
});
export const updateCourseLesson = catchAsync(async (req, res) => {
	const { id } = req.params;

	const lesson = await lessonModel.findById(id);
	if (!lesson) {
		return res.status(404).json('Lesson not found');
	}

	await lessonModel.findByIdAndUpdate(id, req.body);

	return res.status(200).json({ message: 'Lesson updated successfully' });
});
export const grantCourseAccess = catchAsync(async (req, res) => {
	const { id } = req.body;

	const purchase = await purchaseModel.findById(id);
	if (!purchase) {
		return res.status(404).json('Purchase record not found');
	}

	purchase.access = !purchase.access;
	await purchase.save();
	return res.status(200).json({ message: 'Course access updated successfully' });
});
export const updateCourseReview = catchAsync(async (req, res) => {
	const { id } = req.params;
	const { isSpam } = req.body;

	const review = await purchaseModel.findById(id);
	if (!review) {
		return res.status(404).json('Review not found');
	}

	review.isSpam = isSpam;
	await review.save();

	return res.status(200).json({ message: 'Review updated successfully' });
});

export const deleteProgram = catchAsync(async (req, res) => {
	const { id } = req.params;

	const program = await programModel.findById(id);
	if (!program) {
		return res.status(404).json('Program not found');
	}

	await programModel.findByIdAndDelete(id);

	await stripe.products.update(program.productId, { active: false });
	return res.status(200).json({ message: 'Program deleted successfully' });
});
export const deleteEnrollment = catchAsync(async (req, res) => {
	const { id } = req.params;

	const enrollment = await enrollmentModel.findById(id);
	if (!enrollment) {
		return res.status(404).json('Enrollment not found');
	}

	await userModel.findByIdAndUpdate(enrollment.user, { enrollments: null });
	await programModel.findOneAndUpdate(
		{ _id: enrollment.program, enrollments: { $gt: 0 } },
		{ $inc: { enrollments: -1 } }
	);
	await enrollmentModel.findByIdAndDelete(id);

	const stripeSub = await stripe.subscriptions.retrieve(enrollment.subscriptionId);
	if (stripeSub.status !== 'canceled') {
		await stripe.subscriptions.cancel(enrollment.subscriptionId);
	}

	return res.status(200).json({ message: 'Enrollment deleted successfully' });
});
export const deleteUser = catchAsync(async (req, res) => {
	const { id } = req.params;

	const user = await userModel.findById(id);
	if (!user) return res.status(404).json('User not found');
	if (user.role === UserRole.ADMIN) return res.status(403).json('Cannot delete admin user');

	if (user.role == UserRole.KID && user.enrollments) {
		return res.status(400).json('Cannot delete a kid with active enrollments');
	}

	if (user.role === UserRole.CONTACT) {
		const embedContact = await enrollmentModel.find({ contact: user._id }).select('_id');
		if (embedContact.length > 0) {
			return res
				.status(400)
				.json('This emergency contact cannot be deleted, as it is embedded in an enrollment.');
		}
	}

	if (user.role === UserRole.USER) {
		return res.status(400).json('Cannot delete user with USER role');
	}

	if (user.role === UserRole.MODERATOR) {
		return res.status(400).json('Cannot delete user with MODERATOR role');
	}

	await userModel.findByIdAndDelete(id);
	return res.status(200).json({ message: 'User deleted successfully' });
});
export const deleteCourse = catchAsync(async (req, res) => {
	const { id } = req.params;

	const course = await courseModel.findById(id);
	if (!course) {
		return res.status(404).json('Course not found');
	}

	await courseModel.findByIdAndDelete(id);
	await lessonModel.deleteMany({ course: id });

	return res.status(200).json({ message: 'Course deleted successfully' });
});
export const deleteCourseLesson = catchAsync(async (req, res) => {
	const { id } = req.params;

	const lesson = await lessonModel.findById(id);
	if (!lesson) {
		return res.status(404).json('Lesson not found');
	}

	await lessonModel.findByIdAndDelete(id);

	return res.status(200).json({ message: 'Lesson deleted successfully' });
});

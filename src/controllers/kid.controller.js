import { UserRole, UserStatus } from '../helpers/enum.js';
import qrCodeModel from '../models/qr-code.model.js';
import userModel from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';
import enrollmentModel from '../models/enrollment.model.js';
import programModel from '../models/program.model.js';
import { monthKeysUS } from '../utils/index.js';
import attendanceModel from '../models/attendance.model.js';

export const getKids = catchAsync(async (req, res) => {
	const user = req.user;

	const kids = await userModel
		.find({
			parent: user._id,
			role: UserRole.KID,
			status: UserStatus.ACTIVE,
		})
		.select('_id firstName lastName birthday gender qrCode qrCodeModel enrollments allergies notes')
		.populate({
			path: 'qrCodeModel',
			model: qrCodeModel,
			select: 'code eyeColor bgColor fgColor qrStyle logoWidth eyeRadius scanUrl',
		});

	return res.status(200).json({ kids });
});

export const getKidsAttendance = catchAsync(async (req, res) => {
	const { kidId } = req.params;
	const { month } = req.query;

	const kid = await userModel
		.findById(kidId)
		.select('firstName lastName program birthday gender')
		.populate({
			path: 'enrollments',
			select: 'program',
			model: enrollmentModel,
			populate: { path: 'program', select: 'name', model: programModel },
			options: { sort: { createdAt: -1 }, limit: 1 },
		});

	if (!kid?.enrollments) {
		return res.status(404).json('Kid not found or has no enrollments');
	}

	if (!kid) {
		return res.status(404).json('Kid not found');
	}

	const now = new Date();
	const [yStr, mStr] = (
		month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
	).split('-');
	const year = Number(yStr);
	const month0 = Number(mStr) - 1;

	const keys = monthKeysUS(year, month0);

	const rows = await attendanceModel
		.find({ kid: kidId, dateKey: { $in: keys } })
		.select('dateKey checkedInAt checkedOutAt')
		.lean();

	const records = rows.map(r => ({
		dateKey: r.dateKey,
		checkedInAt: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : null,
		checkedOutAt: r.checkedOutAt ? new Date(r.checkedOutAt).toISOString() : null,
	}));

	return res.status(200).json({ kid, records, year, month: month0 + 1 });
});

export const createKid = catchAsync(async (req, res) => {
	const user = req.user;
	const data = { role: UserRole.KID, parent: user._id, ...req.body };
	await userModel.create(data);
	return res.status(201).json({ message: 'Kid created successfully' });
});

export const generateQRCode = catchAsync(async (req, res) => {
	const { kidId, value, ...data } = req.body;

	const kid = await userModel.findById(kidId);
	if (!kid) {
		return res.status(404).json('Kid not found');
	}

	if (!kid.enrollments) {
		return res.status(400).json('Kid has no enrollments');
	}

	if (kid.enrollments) {
		const subs = await stripe.subscriptions.retrieve(kid.enrollments.subscriptionId);
		if (!subs || subs.status !== 'active') {
			return res.status(400).json('Kid has no active subscriptions');
		}
	}

	const existingQRCode = await qrCodeModel.findById(kid.qrCodeModel);
	if (existingQRCode) {
		return res.status(400).json('QR Code already exists.');
	}

	kid.qrCode = value;

	const scanUrl = `${process.env.CLIENT_URL}/admin/static-scan?token=${kid.qrCode}`;

	if (kid.qrCodeModel) {
		await qrCodeModel.findByIdAndDelete(kid.qrCodeModel);
	}

	const createdQRCode = await qrCodeModel.create({
		kid: kid._id,
		code: value.toUpperCase(),
		scanUrl,
		...data,
	});

	kid.qrCodeModel = createdQRCode._id;
	await kid.save();

	return res
		.status(201)
		.json({ message: 'QR Code generated successfully', scanUrl, code: kid.qrCode });
});

export const updateKid = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	await userModel.findByIdAndUpdate(id, data, { new: true });
	return res.status(200).json({ message: 'Kid updated successfully' });
});

export const updateQRCode = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	const kid = await userModel.findById(id);
	if (!kid) {
		return res.status(404).json('Kid not found');
	}

	if (!kid.qrCodeModel) {
		return res.status(400).json('Kid has no QR Code. Please generate one first.');
	}

	const codeValue = data.value.toUpperCase();

	const existingQRCode = await qrCodeModel.findOne({ code: codeValue });
	if (existingQRCode) {
		return res.status(400).json('QR Code value already exists. Please choose a different value.');
	}

	const scanUrl = `${process.env.CLIENT_URL}/admin/static-scan?token=${codeValue}`;

	const updatedQRCode = await qrCodeModel.findByIdAndUpdate(
		kid.qrCodeModel,
		{ ...data, value: codeValue, scanUrl, code: codeValue },
		{ new: true, runValidators: true }
	);

	const updatedKid = await userModel.findByIdAndUpdate(
		kid._id,
		{ qrCode: codeValue },
		{ new: true }
	);

	return res.status(200).json({ message: 'QR Code updated successfully' });
});

export const deleteKid = catchAsync(async (req, res) => {
	const { id } = req.params;

	const user = await userModel.findById(id);
	if (!user) {
		return res.status(404).json('Kid not found');
	}

	const enrollment = await enrollmentModel.findById(user.enrollments);

	if (enrollment) {
		const subs = await stripe.subscriptions.retrieve(enrollment.subscriptionId);
		if (subs && subs.status === 'active') {
			return res.status(400).json('Cannot delete kid with active subscriptions');
		}
	}

	await qrCodeModel.findByIdAndDelete(user.qrCodeModel);
	await userModel.findByIdAndUpdate(user._id, { status: UserStatus.INACTIVE });

	return res.status(200).json({ message: 'Kid deleted successfully' });
});

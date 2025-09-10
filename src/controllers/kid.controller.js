import { UserRole, UserStatus } from '../helpers/enum.js';
import qrCodeModel from '../models/qr-code.model.js';
import userModel from '../models/user.model.js';
import { getUser } from '../utils/auth.js';
import catchAsync from '../utils/catchAsync.js';
import enrollmentModel from '../models/enrollment.model.js';
import { stripe } from '../utils/stripe.js';

export const getKids = catchAsync(async (req, res) => {
	const user = await getUser(req);

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

export const createKid = catchAsync(async (req, res) => {
	const user = await getUser(req);
	const data = { role: UserRole.KID, parent: user._id, ...req.body };
	const createdUser = await userModel.create(data);
	return res.status(201).json({ user: createdUser });
});

export const generateQRCode = catchAsync(async (req, res) => {
	const { kidId, value, ...data } = req.body;

	const kid = await userModel.findById(kidId);
	if (!kid) {
		return res.status(404).json({ message: 'Kid not found' });
	}

	if (!kid.enrollments) {
		return res.status(400).json({ message: 'Kid has no enrollments' });
	}

	const existingQRCode = await qrCodeModel.findById(kid.qrCodeModel);
	if (existingQRCode) {
		return res.status(400).json({ message: 'QR Code already exists.' });
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

	return res.status(201).json({ qrCode: createdQRCode });
});

export const updateKid = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	const updatedUser = await userModel.findByIdAndUpdate(id, data, { new: true });
	return res.status(200).json({ user: updatedUser });
});

export const updateQRCode = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	const kid = await userModel.findById(id);
	if (!kid) {
		return res.status(404).json({ message: 'Kid not found' });
	}

	if (!kid.qrCodeModel) {
		return res.status(400).json({ message: 'Kid has no QR Code. Please generate one first.' });
	}

	const codeValue = data.value.toUpperCase();

	const existingQRCode = await qrCodeModel.findOne({ code: codeValue });
	if (existingQRCode) {
		return res
			.status(400)
			.json({ message: 'QR Code value already exists. Please choose a different value.' });
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

	return res.status(200).json({ kid: updatedKid, qrCode: updatedQRCode });
});

export const deleteKid = catchAsync(async (req, res) => {
	const { id } = req.params;

	const user = await userModel.findById(id);
	if (!user) {
		return res.status(404).json({ message: 'Kid not found' });
	}

	const enrollment = await enrollmentModel.find({ kid: user._id, status: 'active' });
	const subsIds = enrollment.map(sub => sub.subscriptionId);

	for (const subId of subsIds) {
		const sub = await stripe.subscriptions.retrieve(subId);
		if (sub && ['active', 'trialing'].includes(sub.status)) {
			return res.status(400).json({ message: 'Cannot delete kid with active subscriptions' });
		}
	}

	await qrCodeModel.findByIdAndDelete(user.qrCodeModel);
	await userModel.findByIdAndUpdate(user._id, { status: UserStatus.INACTIVE });

	return res.status(200).json({ message: 'Kid deleted successfully', id: user._id });
});

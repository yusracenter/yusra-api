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

export const updateKid = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	const updatedUser = await userModel.findByIdAndUpdate(id, data, { new: true });
	return res.status(200).json({ user: updatedUser });
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

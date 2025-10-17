import { UserRole, UserStatus } from '../helpers/enum.js';
import userModel from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';

export const getContacts = catchAsync(async (req, res) => {
	const user = req.user;

	const contacts = await userModel
		.find({
			user: user._id,
			role: UserRole.CONTACT,
			status: UserStatus.ACTIVE,
		})
		.select('_id firstName lastName email birthday phone address');

	return res.status(200).json({ contacts });
});

export const createContact = catchAsync(async (req, res) => {
	const user = req.user;
	const data = { role: UserRole.CONTACT, user: user._id, ...req.body };
	const createdUser = await userModel.create(data);
	return res.status(201).json({ message: 'Contact created successfully' });
});

export const updateContact = catchAsync(async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	const updatedUser = await userModel.findByIdAndUpdate(id, data, { new: true });
	return res.status(200).json({ message: 'Contact updated successfully' });
});

export const deleteContact = catchAsync(async (req, res) => {
	const { id } = req.params;

	const user = await userModel.findById(id);
	if (!user) {
		return res.status(404).json('Contact not found');
	}

	await userModel.findByIdAndUpdate(user._id, { status: UserStatus.INACTIVE });

	return res.status(200).json({ message: 'Contact deleted successfully' });
});

import { clerkClient } from '@clerk/express';
import { getUser } from '../utils/auth.js';
import catchAsync from '../utils/catchAsync.js';
import userModel from '../models/user.model.js';

export const getCurrentUser = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) return res.status(404).json('User not found');

	return res.status(200).json({ user });
});

export const updateProfileImage = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) return res.status(404).json('User not found');
	if (!req.file) return res.status(400).json('No file uploaded');

	const { buffer, mimetype, originalname } = req.file;

	let fileParam;
	if (typeof File !== 'undefined') {
		fileParam = new File([buffer], originalname || 'avatar.jpg', { type: mimetype });
	} else if (typeof Blob !== 'undefined') {
		fileParam = new Blob([buffer], { type: mimetype });
	} else {
		fileParam = `data:${mimetype};base64,${buffer.toString('base64')}`;
	}

	await clerkClient.users.updateUserProfileImage(user.clerkId, { file: fileParam });
	return res.status(200).json({ message: 'Profile image updated successfully' });
});

export const updateFullName = catchAsync(async (req, res) => {
	const { firstName, lastName } = req.body;
	const user = await getUser(req);
	if (!user) return res.status(404).json('User not found');

	await clerkClient.users.updateUser(user.clerkId, { firstName, lastName });
	return res.status(200).json({ message: 'Fullname updated successfully' });
});

export const updateAddress = catchAsync(async (req, res) => {
	const { address } = req.body;
	const user = await getUser(req);
	if (!user) return res.status(404).json({ message: 'User not found' });

	const updated = await userModel.findByIdAndUpdate(user._id, { address }, { new: true });
	if (!updated) return res.status(500).json({ message: 'Failed to update address' });

	return res.status(200).json({ message: 'Address updated successfully', id: user._id });
});

export const deleteProfileImage = catchAsync(async (req, res) => {
	const user = await getUser(req);
	if (!user) return res.status(404).json('User not found');

	await clerkClient.users.deleteUserProfileImage(user.clerkId);
	return res.status(200).json({ message: 'Profile image deleted successfully' });
});

export const updatePhone = catchAsync(async (req, res) => {
	const { phone } = req.body;
	const user = await getUser(req);
	if (!user) return res.status(404).json({ message: 'User not found' });

	const updated = await userModel.findByIdAndUpdate(user._id, { phone }, { new: true });
	if (!updated) return res.status(500).json({ message: 'Failed to update phone' });

	return res.status(200).json({ message: 'Phone updated successfully', id: user._id });
});

export const completeProfile = catchAsync(async (req, res) => {
	const { address, phone } = req.body;
	const user = await getUser(req);
	if (!user) return res.status(404).json('User not found');

	const updated = await userModel.findByIdAndUpdate(
		user._id,
		{ address, phone, isCompleted: true },
		{ new: true }
	);

	if (!updated) return res.status(500).json('Failed to complete profile');

	return res.status(200).json({ message: 'Profile completed successfully' });
});

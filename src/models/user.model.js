import mongoose from 'mongoose';
import { UserRole, UserStatus } from '../helpers/enum.js';

const userSchema = new mongoose.Schema(
	{
		clerkId: { type: String },
		customerId: { type: String },

		avatar: { type: String },
		email: { type: String },
		gender: { type: String },
		birthday: { type: Date },
		allergies: { type: String },
		phone: { type: String },
		address: { type: String },
		firstName: { type: String },
		lastName: { type: String },
		notes: { type: String },
		isCompleted: { type: Boolean, default: false },

		status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },

		role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },

		enrollments: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },

		qrCode: { type: String, unique: true },
		qrCodeModel: { type: mongoose.Schema.Types.ObjectId, ref: 'QRCode' },

		parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		kid: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	},
	{ timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);

import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
		course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
		isCompleted: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

export default mongoose.models.UserProgress || mongoose.model('UserProgress', UserProgressSchema);

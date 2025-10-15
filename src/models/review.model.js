import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
		rating: { type: Number },
		comment: { type: String },
		isSpam: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

export default mongoose.models.Review || mongoose.model('Review', ReviewSchema);

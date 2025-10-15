import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		slug: { type: String, required: true, unique: true },
		previewImage: { type: String },
		previewImageKey: { type: String },
		previewVideoId: { type: String },
		level: { type: String },
		category: { type: String },
		isPublished: { type: Boolean, default: false },
		excerpt: { type: String },
		forWhom: { type: String },
		whatYouWillLearn: { type: String },
		keywords: { type: String },
		enrollments: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

export default mongoose.models.Course || mongoose.model('Course', CourseSchema);

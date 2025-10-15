import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		position: { type: Number },
		content: { type: String, default: '' },
		videoId: { type: String, required: true },
		minutes: { type: Number, required: true },
		seconds: { type: Number, required: true },
		hours: { type: Number, required: true },
		course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
	},
	{ timestamps: true }
);

export default mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);

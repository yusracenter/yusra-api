import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
		note: { type: String, required: true },
	},
	{ timestamps: true }
);

export default mongoose.models.Note || mongoose.model('Note', NoteSchema);

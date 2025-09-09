import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema(
	{
		kid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		dateKey: { type: String, required: true },
		checkedInAt: Date,
		checkedOutAt: Date,
	},
	{ timestamps: true }
);

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

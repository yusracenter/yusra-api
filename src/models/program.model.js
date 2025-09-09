import mongoose from 'mongoose';

const ProgramSchema = new mongoose.Schema(
	{
		name: String,
		description: String,
		startDate: String,
		endDate: String,
		maxStudents: String,
		price: String,
		type: String,
		maxAge: String,

		priceId: String,
		productId: String,

		enrollments: { type: Number, default: 0, min: 0 },
	},
	{ timestamps: true }
);

export default mongoose.models.Program || mongoose.model('Program', ProgramSchema);

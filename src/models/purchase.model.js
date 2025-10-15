import mongoose from 'mongoose';

const PurchaseSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
		access: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

export default mongoose.models.Purchase || mongoose.model('Purchase', PurchaseSchema);

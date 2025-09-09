import mongoose from 'mongoose';

const EnrollmentSchema = new mongoose.Schema(
	{
		program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },

		contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		kid: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

		subscriptionId: String,
		paymentMethodId: String,

		nextBilling: String,
		programPrice: String,
		paymentMethod: String,
		status: String,

		invoice_pdf: String,
	},
	{ timestamps: true }
);

export default mongoose.models.Enrollment || mongoose.model('Enrollment', EnrollmentSchema);

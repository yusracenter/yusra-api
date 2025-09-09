import mongoose from 'mongoose';

const QRCodeSchema = new mongoose.Schema(
	{
		kid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
		code: { type: String, required: true, unique: true },
		scanUrl: { type: String, required: true, unique: true },
		eyeColor: String,
		bgColor: String,
		fgColor: String,
		qrStyle: String,
		logoWidth: Number,
		eyeRadius: Number,
	},
	{ timestamps: true }
);

export default mongoose.models.QRCode || mongoose.model('QRCode', QRCodeSchema);

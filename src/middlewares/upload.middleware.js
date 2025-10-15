import multer from 'multer';

const MAX_SIZE = 5 * 1024 * 1024;

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_SIZE },
	fileFilter: (req, file, cb) => {
		const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
		if (!ok) return cb(new Error('Only JPG/PNG/WEBP allowed'));
		cb(null, true);
	},
});

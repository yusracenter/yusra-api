import multer from 'multer';

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
		if (ok) cb(null, true);
		else cb(new Error('Only JPG/PNG/WEBP allowed'));
	},
});

export default upload;

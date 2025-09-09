import express from 'express';
import * as userController from '../controllers/user.controller.js';
import validate, { validateUpload } from '../middlewares/validate.middleware.js';
import {
	completeProfileSchema,
	updateAddressSchema,
	updateFullnameSchema,
	updateImageBodySchema,
	updatePhoneSchema,
	uploadedFileSchema,
} from '../utils/validation.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

router.put(
	'/profile-image',
	upload.single('file'),
	validateUpload({ body: updateImageBodySchema, file: uploadedFileSchema }),
	userController.updateProfileImage
);
router.put(
	'/update-fullname',
	validate({ body: updateFullnameSchema }),
	userController.updateFullName
);
router.put(
	'/update-address',
	validate({ body: updateAddressSchema }),
	userController.updateAddress
);
router.put('/update-phone', validate({ body: updatePhoneSchema }), userController.updatePhone);
router.put(
	'/complete-profile',
	validate({ body: completeProfileSchema }),
	userController.completeProfile
);

router.delete('/profile-image', userController.deleteProfileImage);

export default router;

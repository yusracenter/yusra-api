import express from 'express';
import * as enrollmentController from '../controllers/enrollment.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { createSubSchema, enrollProgramSchema, idParamSchema } from '../utils/validation.js';

const router = express.Router();

router.get('/enrollment-program', enrollmentController.getEnrollmentProgram);
router.get('/get-programs', enrollmentController.getPrograms);
router.get(
	'/get-program/:id',
	validate({ params: idParamSchema }),
	enrollmentController.getProgramById
);

router.post(
	'/create-subscription',
	validate({ body: createSubSchema }),
	enrollmentController.createSubscription
);
router.post(
	'/enroll-program',
	validate({ body: enrollProgramSchema }),
	enrollmentController.enrollProgram
);

export default router;

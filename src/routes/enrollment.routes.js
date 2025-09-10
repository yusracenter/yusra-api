import express from 'express';
import * as enrollmentController from '../controllers/enrollment.controller.js';
import validate from '../middlewares/validate.middleware.js';
import {
	autoRenewSchema,
	createSubSchema,
	enrollmentIdParamSchema,
	enrollProgramSchema,
	freeSubscriptionSchema,
	idParamSchema,
} from '../utils/validation.js';

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
router.post(
	'/create-free-subscription',
	validate({ body: freeSubscriptionSchema }),
	enrollmentController.createFreeSubscription
);

router.put(
	'/renew-subscription/:enrollmentId',
	validate({ params: enrollmentIdParamSchema }),
	enrollmentController.renewSubscription
);
router.put(
	'/toggle-auto-renew/:enrollmentId',
	validate({ body: autoRenewSchema, params: enrollmentIdParamSchema }),
	enrollmentController.toggleAutoRenew
);

router.delete(
	'/cancel-subscription/:enrollmentId',
	validate({ params: enrollmentIdParamSchema }),
	enrollmentController.cancelSubscription
);

export default router;

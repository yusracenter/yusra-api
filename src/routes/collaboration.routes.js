import express from 'express';
import * as collaborationController from '../controllers/collaboration.controller.js';
import validate from '../middlewares/validate.middleware.js';
import {
	confirmSubsCollabSchema,
	createSubsCollabSchema,
	enrollmentIdParamSchema,
	programIdParamSchema,
} from '../utils/validation.js';

const router = express.Router();

router.get('/collaboration-status', collaborationController.getCollaborationStatus);
router.get(
	'/get-kids/by-program/:programId',
	validate({ params: programIdParamSchema }),
	collaborationController.getKidsByProgram
);
router.get(
	'/me-is-enrolled/:programId',
	validate({ params: programIdParamSchema }),
	collaborationController.meIsEnrolled
);
router.get(
	'/collaboration/:programId',
	validate({ params: programIdParamSchema }),
	collaborationController.getCollaborationById
);

router.post(
	'/create-subscription/:programId',
	validate({ params: programIdParamSchema, body: createSubsCollabSchema }),
	collaborationController.createSubscription
);
router.post(
	'/confirm-subscription/:programId',
	validate({ params: programIdParamSchema, body: confirmSubsCollabSchema }),
	collaborationController.confirmSubscription
);

router.delete(
	'/remove/from-profile/:enrollmentId',
	validate({ params: enrollmentIdParamSchema }),
	collaborationController.removeFromProfile
);

export default router;

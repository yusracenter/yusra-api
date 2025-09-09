import express from 'express';
import * as userController from '../controllers/user.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { idParamSchema, kidSchema } from '../utils/validation.js';

const router = express.Router();

router.get('/kids', userController.getKids);
router.post('/kids', validate({ body: kidSchema }), userController.createKid);
router.put(
	'/kids/:id',
	validate({ body: kidSchema, params: idParamSchema }),
	userController.updateKid
);
router.delete('/kids/:id', validate({ params: idParamSchema }), userController.deleteKid);

export default router;

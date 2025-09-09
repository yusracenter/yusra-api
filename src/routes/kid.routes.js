import express from 'express';
import * as kidController from '../controllers/kid.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { idParamSchema, kidSchema } from '../utils/validation.js';

const router = express.Router();

router.get('/', kidController.getKids);
router.post('/', validate({ body: kidSchema }), kidController.createKid);
router.put('/:id', validate({ body: kidSchema, params: idParamSchema }), kidController.updateKid);
router.delete('/:id', validate({ params: idParamSchema }), kidController.deleteKid);

export default router;

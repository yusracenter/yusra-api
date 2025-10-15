import express from 'express';
import * as kidController from '../controllers/kid.controller.js';
import validate from '../middlewares/validate.middleware.js';
import {
	idParamSchema,
	kidSchema,
	qrCodeIdParamSchema,
	qrCodeSchema,
	updateQrCodeSchema,
} from '../utils/validation.js';

const router = express.Router();

router.get('/', kidController.getKids);
router.get('/attendance/:kidId', kidController.getKidsAttendance);

router.post('/', validate({ body: kidSchema }), kidController.createKid);
router.post('/generate-qrcode', validate({ body: qrCodeSchema }), kidController.generateQRCode);

router.put('/:id', validate({ body: kidSchema, params: idParamSchema }), kidController.updateKid);
router.put(
	'/update-qrcode/:id',
	validate({ body: updateQrCodeSchema, params: qrCodeIdParamSchema }),
	kidController.updateQRCode
);

router.delete('/:id', validate({ params: idParamSchema }), kidController.deleteKid);

export default router;

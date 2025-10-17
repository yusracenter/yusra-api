import express from 'express';
import * as contactController from '../controllers/contact.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { contactSchema, idParamSchema } from '../utils/validation.js';

const router = express.Router();

router.get('/', contactController.getContacts);
router.post('/', validate({ body: contactSchema }), contactController.createContact);
router.put(
	'/:id',
	validate({ body: contactSchema, params: idParamSchema }),
	contactController.updateContact
);
router.delete('/:id', validate({ params: idParamSchema }), contactController.deleteContact);

export default router;

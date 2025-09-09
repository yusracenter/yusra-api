import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import validate from '../middlewares/validate.middleware.js';
import { idParamSchema, kidSchema } from '../utils/validation.js';

const router = express.Router();

router.get('/payment-methods', paymentController.getPaymentMethods);

export default router;

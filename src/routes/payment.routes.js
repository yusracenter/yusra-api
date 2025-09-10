import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import validate from '../middlewares/validate.middleware.js';
import {
	donateSchema,
	idParamSchema,
	paymentMethodSchema,
	validateCouponSchema,
} from '../utils/validation.js';

const router = express.Router();

router.get('/payment-methods', paymentController.getPaymentMethods);
router.get('/payment-history', paymentController.getPaymentHistory);
router.get(
	'/payment-intent/:id',
	validate({ params: idParamSchema }),
	paymentController.getPaymentIntent
);

router.post(
	'/add-payment-method',
	validate({ body: paymentMethodSchema }),
	paymentController.addPaymentMethod
);
router.post('/donate', validate({ body: donateSchema }), paymentController.donate);
router.post(
	'/validate-coupon',
	validate({ body: validateCouponSchema }),
	paymentController.validateCoupon
);

router.delete(
	'/remove-payment-method/:id',
	validate({ params: idParamSchema }),
	paymentController.removePaymentMethod
);

export default router;

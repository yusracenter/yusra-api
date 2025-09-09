import { z } from 'zod';
import { calcAge } from './index.js';

const usPhoneE164 = z
	.string({ required_error: 'Phone is required.' })
	.trim()
	.transform(s => s.replace(/[^\d]/g, ''))
	.transform(d => (d.length === 11 && d.startsWith('1') ? d.slice(1) : d))
	.refine(d => d.length === 10, {
		message: 'US phone must have 10 digits (after country code).',
	})
	.refine(d => /^[2-9]\d{2}[2-9]\d{6}$/.test(d), {
		message: 'Invalid US area or central office code.',
	})
	.refine(d => !(d[1] === '1' && d[2] === '1'), {
		message: 'Area code cannot be N11.',
	})
	.refine(d => !(d[4] === '1' && d[5] === '1'), {
		message: 'Central office code cannot be N11.',
	})
	.transform(d => `+1${d}`);

export const kidSchema = z
	.object({
		firstName: z
			.string()
			.trim()
			.min(1, { message: 'Firstname is required.' })
			.regex(/^[A-Za-z]+$/, { message: 'Firstname must contain only letters.' }),
		lastName: z
			.string()
			.trim()
			.min(1, { message: 'Lastname is required.' })
			.regex(/^[A-Za-z]+$/, { message: 'Lastname must contain only letters.' }),
		birthday: z.coerce
			.date({ required_error: 'Birthday is required.' })
			.max(new Date(), { message: 'Birthday cannot be in the future.' }),
		gender: z.enum(['Male', 'Female']),
		allergies: z.enum(['yes', 'no']),
		notes: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.allergies === 'yes' && (!data.notes || data.notes.trim() === '')) {
			ctx.addIssue({
				code: 'custom',
				message: 'Notes are required when allergies = yes',
				path: ['notes'],
			});
		}

		if (data.birthday) {
			const age = calcAge(`${data.birthday}`, new Date(), 1);
			if (age < 7 || age > 25) {
				ctx.addIssue({
					code: 'custom',
					message: 'Date must be between 7 and 25 age.',
					path: ['birthday'],
				});
			}
		}
	})
	.strict();

export const contactSchema = z
	.object({
		firstName: z
			.string()
			.trim()
			.min(1, { message: 'Firstname is required.' })
			.regex(/^[A-Za-z]+$/, { message: 'Firstname must contain only letters.' }),
		lastName: z
			.string()
			.trim()
			.min(1, { message: 'Lastname is required.' })
			.regex(/^[A-Za-z]+$/, { message: 'Lastname must contain only letters.' }),
		birthday: z.coerce
			.date({ required_error: 'Birthday is required.' })
			.max(new Date(), { message: 'Birthday cannot be in the future.' }),
		phone: usPhoneE164,
		address: z.string().min(1, { message: 'Address is required.' }),
		email: z
			.string()
			.min(1, { message: 'Email is required.' })
			.email({ message: 'Email is invalid.' }),
	})
	.superRefine((data, ctx) => {
		if (data.birthday) {
			const age = calcAge(`${data.birthday}`);
			if (age < 18) {
				ctx.addIssue({
					code: 'custom',
					message: 'Contact must be at least 18 years old.',
					path: ['birthday'],
				});
			}
		}
	})
	.strict();

export const idParamSchema = z.object({
	id: z.string({ error: 'ID is required' }),
});

export const updateImageBodySchema = z.object({}).strict();

export const uploadedFileSchema = z.object({
	fieldname: z.literal('file'),
	originalname: z.string().min(1),
	mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp']),
	size: z.number().max(5 * 1024 * 1024, { message: 'Max 5MB' }),
	buffer: z.instanceof(Buffer),
});

export const updateFullnameSchema = z.object({
	firstName: z
		.string()
		.trim()
		.min(1, { message: 'Firstname is required.' })
		.regex(/^[A-Za-z]+$/, { message: 'Firstname must contain only letters.' }),
	lastName: z
		.string()
		.trim()
		.min(1, { message: 'Lastname is required.' })
		.regex(/^[A-Za-z]+$/, { message: 'Lastname must contain only letters.' }),
});

export const updateAddressSchema = z.object({
	address: z.string().min(1, { message: 'Address is required.' }),
});

export const updatePhoneSchema = z.object({
	phone: usPhoneE164,
});

export const completeProfileSchema = z.object({
	address: z.string().min(1, { message: 'Address is required.' }),
	phone: usPhoneE164,
});

export const createSubSchema = z.object({
	programId: z.string({ required_error: 'Program ID is required.' }),
	paymentMethodId: z.string({ required_error: 'Payment Method ID is required.' }),
	kidId: z.string({ required_error: 'Kid ID is required.' }),
	coupon: z.object({ id: z.string().optional() }).optional(),
});

export const enrollProgramSchema = z.object({
	kidId: z.string({ required_error: 'Kid ID is required.' }),
	contactId: z.string({ required_error: 'Contact ID is required.' }),
	paymentMethodId: z.string({ required_error: 'Payment Method ID is required.' }),
	programId: z.string({ required_error: 'Program ID is required.' }),
	subscriptionId: z.string({ required_error: 'Subscription ID is required.' }),
	programPrice: z.string({ required_error: 'Program Price is required.' }),
	paymentMethod: z.string({ required_error: 'Payment Method is required.' }),
});

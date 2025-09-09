import { z } from 'zod';
import { calcAge } from './index.js';

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

export const updatePhoneSchema = z.object({
	phone: usPhoneE164,
});

export const completeProfileSchema = z.object({
	address: z.string().min(1, { message: 'Address is required.' }),
	phone: usPhoneE164,
});

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

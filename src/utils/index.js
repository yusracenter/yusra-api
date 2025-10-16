import { formatInTimeZone } from 'date-fns-tz';

export function calcAge(birthdayISO, onDate = new Date(), graceMonths = 0) {
	const b = new Date(birthdayISO);
	if (Number.isNaN(b.getTime())) return NaN;

	const ref = new Date(onDate);
	ref.setHours(12, 0, 0, 0);
	ref.setMonth(ref.getMonth() + graceMonths);

	let age = ref.getFullYear() - b.getFullYear();
	const m = ref.getMonth() - b.getMonth();
	if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) {
		age--;
	}
	return age;
}

export const getGender = type => {
	switch (type) {
		case 'Boys':
			return 'Male';
		case 'Girls':
			return 'Female';
		default:
			return 'Other';
	}
};

export function formatDateKeyUS(d = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(d);

	const mm = parts.find(p => p.type === 'month')?.value ?? '01';
	const dd = parts.find(p => p.type === 'day')?.value ?? '01';
	const yyyy = parts.find(p => p.type === 'year')?.value ?? '1970';

	return `${mm}-${dd}-${yyyy}`;
}

export function monthKeysUS(year, monthIndex0) {
	const keys = [];
	const d = new Date(Date.UTC(year, monthIndex0, 1));
	while (d.getUTCMonth() === monthIndex0) {
		keys.push(formatDateKeyUS(new Date(d), 'America/New_York'));
		d.setUTCDate(d.getUTCDate() + 1);
	}
	return keys;
}

export function getDuration(lessons) {
	const totalMinutes = lessons.reduce(
		(acc, lesson) => acc + parseInt(lesson.hours) * 60 + parseInt(lesson.minutes),
		0
	);

	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	const hoursDisplay = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : '';
	const minutesDisplay = minutes > 0 ? `${minutes} min${minutes > 1 ? 's' : ''}` : '';

	return `${hoursDisplay}${hours > 0 && minutes > 0 ? ' ' : ''}${minutesDisplay}`;
}

export function getDateKey(d = new Date()) {
	return formatInTimeZone(d, 'UTC', 'MM-dd-yyyy');
}

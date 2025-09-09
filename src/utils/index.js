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

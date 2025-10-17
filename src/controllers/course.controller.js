import catchAsync from '../utils/catchAsync.js';
import courseModel from '../models/course.model.js';
import userProgressModel from '../models/user-progress.model.js';
import lessonModel from '../models/lesson.model.js';
import purchaseModel from '../models/purchase.model.js';
import { getDuration } from '../utils/index.js';
import userModel from '../models/user.model.js';
import { UserRole, UserStatus } from '../helpers/enum.js';
import enrollmentModel from '../models/enrollment.model.js';
import reviewModel from '../models/review.model.js';
import noteModel from '../models/note.model.js';

export const getCourses = catchAsync(async (req, res) => {
	const user = req.user;
	const courses = await courseModel.find({ isPublished: true });

	const coursesWithProgress = await Promise.all(
		courses.map(async course => {
			const lessonsCount = await lessonModel.countDocuments({ course: course._id });

			const completedLessons = await userProgressModel.distinct('lesson', {
				user: user._id,
				course: course._id,
				isCompleted: true,
			});
			const completedCount = Array.isArray(completedLessons) ? completedLessons.length : 0;

			const progress = lessonsCount > 0 ? Math.min(100, (completedCount / lessonsCount) * 100) : 0;

			const purchased = await purchaseModel.exists({
				user: user._id,
				course: course._id,
			});

			return { ...course.toObject(), completed: progress, purchased: Boolean(purchased) };
		})
	);

	return res.status(200).json({ courses: coursesWithProgress });
});

export const getCourseBySlug = catchAsync(async (req, res) => {
	const { slug } = req.params;
	const user = req.user;

	const courseData = await courseModel.findOne({ slug: slug, isPublished: true }).lean();
	const lessons = await lessonModel.find({ course: courseData._id });
	const duration = getDuration(lessons);

	const reviews = await reviewModel.find({ course: courseData._id }).select('rating');
	const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
	const averageRating = totalRating / reviews.length || 0;

	const purchased = await purchaseModel.exists({ user: user._id, course: courseData._id });

	const data = {
		...courseData,
		duration,
		lessonCount: lessons.length,
		rating: averageRating.toFixed(0),
		reviewsCount: reviews.length,
		purchased: Boolean(purchased),
	};

	return res.status(200).json({ course: data });
});

export const getLessonsByCourseId = catchAsync(async (req, res) => {
	const { courseId } = req.params;
	const lessons = await lessonModel.find({ course: courseId }).sort({
		position: 1,
	});
	return res.status(200).json({ lessons });
});

export const getLessonDashboard = catchAsync(async (req, res) => {
	const user = req.user;
	const { slug } = req.params;

	const course = await courseModel.findOne({ slug, isPublished: true }).select('_id title');
	if (!course) return res.status(404).json('Course not found');

	const lessons = await lessonModel.find({ course: course._id }).sort({ position: 1 });
	const userProgress = await userProgressModel
		.find({ user: user._id, course: course._id, isCompleted: true })
		.select('lesson isCompleted');

	const progress = (userProgress.length / lessons.length) * 100;

	const lessonsWithProgress = lessons.map(lesson => {
		const p = userProgress.find(c => String(c.lesson) === String(lesson._id));
		return { ...lesson.toObject(), isCompleted: !!p };
	});

	res.json({ course, progress: +progress.toFixed(0), lessons: lessonsWithProgress });
});

export const getLesson = catchAsync(async (req, res) => {
	const { id } = req.params;
	const lesson = await lessonModel.findById(id);
	if (!lesson) return res.json({ failure: 'Lesson not found' });
	res.json({ lesson });
});

export const getNotes = catchAsync(async (req, res) => {
	const user = req.user;
	const { id } = req.params;

	const notes = await noteModel.find({ user: user._id, lesson: id });
	res.json({ notes });
});

export const getReview = catchAsync(async (req, res) => {
	const user = req.user;
	const { slug } = req.params;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const review = await reviewModel
		.findOne({ user: user._id, course: course._id })
		.select('comment rating');

	res.json({ review: review || null });
});

export const getReviews = catchAsync(async (req, res) => {
	const { slug } = req.params;
	const limit = Number(req.query.limit) || 10;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const reviews = await reviewModel
		.find({ course: course._id, isSpam: false })
		.select('comment rating user createdAt')
		.sort({ createdAt: -1 })
		.populate({ path: 'user', model: userModel, select: 'firstName lastName avatar' })
		.limit(limit);

	const allReviews = await reviewModel.find({ course: course._id }).select('rating');
	const totalRating = allReviews.reduce((a, r) => a + r.rating, 0);
	const averageRating = totalRating / allReviews.length || 0;

	res.json({
		reviews: reviews || [],
		averageRating: averageRating.toFixed(0),
		reviewsCount: allReviews.length,
	});
});

export const checkAccessToCourse = catchAsync(async (req, res) => {
	const user = req.user;
	const { slug } = req.params;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const purchase = await purchaseModel.findOne({ user: user._id, course: course._id });
	if (!purchase)
		return res.json({ failure: 'Purchase not found. Please purchase the course to access it.' });
	if (!purchase.access)
		return res.json({
			failure: 'You have previously purchased this course but do not have access.',
		});

	res.json({ message: 'Access granted' });
});

export const getLessonData = catchAsync(async (req, res) => {
	const user = req.user;
	const { slug } = req.params;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const purchase = await purchaseModel.findOne({ user: user._id, course: course._id });
	if (!purchase)
		return res.json({ failure: 'Purchase not found. Please purchase the course to access it.' });
	if (!purchase.access)
		return res.json({
			failure: 'You have purchased this course but access is restricted. Contact support.',
		});

	const lessons = await lessonModel
		.find({ course: course._id })
		.select('_id')
		.sort({ position: 1 });
	const lastProgress = await userProgressModel
		.findOne({
			user: user._id,
			course: course._id,
			isCompleted: true,
		})
		.sort({ updatedAt: -1 });

	res.json({ lessonId: lastProgress ? lastProgress.lesson : lessons[0]._id });
});

export const purchaseFreeCourse = catchAsync(async (req, res) => {
	const user = req.user;
	const { id } = req.params;

	const course = await courseModel.findOne({ _id: id, isPublished: true });
	if (!course) return res.status(404).json('Course not found');
	if (course.price > 0) return res.status(400).json('Course is not free');

	const kidsId = await userModel
		.find({ parent: user._id, role: UserRole.KID, status: UserStatus.ACTIVE })
		.distinct('_id');

	const enrollments = await enrollmentModel.find({ kid: { $in: kidsId }, status: 'active' });
	if (!enrollments.length) return res.status(400).json('You need to enroll in a program first');

	const existingPurchase = await purchaseModel.findOne({ user: user._id, course: course._id });
	if (existingPurchase && !existingPurchase.access)
		return res
			.status(400)
			.json(
				'You have previously purchased this course but do not have access. Please contact support'
			);
	if (existingPurchase) return res.json({ exist: true });

	await purchaseModel.create({ user: user._id, course: course._id });
	await courseModel.findByIdAndUpdate(course._id, { $inc: { enrollments: 1 } });

	return res.json({ message: 'Course purchased successfully' });
});

export const createNote = catchAsync(async (req, res) => {
	const user = req.user;
	const { lessonId, note } = req.body;

	await noteModel.create({ user: user._id, lesson: lessonId, note });
	res.json({ message: 'Note added successfully' });
});

export const createReview = catchAsync(async (req, res) => {
	const user = req.user;
	const { comment, rating, slug } = req.body;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const review = await reviewModel.findOne({ user: user._id, course: course._id });
	if (review) {
		await reviewModel.findByIdAndUpdate(review._id, { comment, rating });
		return res.json({ message: 'Review updated successfully' });
	}

	await reviewModel.create({ user: user._id, course: course._id, comment, rating });
	res.json({ message: 'Review created successfully' });
});

export const nextCourseLesson = catchAsync(async (req, res) => {
	const user = req.user;
	const { lessonId, slug } = req.body;

	const course = await courseModel.findOne({ slug }).select('_id');
	if (!course) return res.status(404).json('Course not found');

	const currentLesson = await lessonModel
		.findOne({ _id: lessonId, course: course._id })
		.select('_id position');
	if (!currentLesson) return res.status(404).json('Lesson not found');

	const nextLesson = await lessonModel
		.findOne({
			course: course._id,
			position: { $gt: currentLesson.position },
		})
		.sort({ position: 1 })
		.select('_id');

	let existingProgress = await userProgressModel.findOne({
		user: user._id,
		lesson: lessonId,
		course: course._id,
	});

	if (existingProgress) {
		if (!existingProgress.isCompleted) {
			existingProgress.isCompleted = true;
			await existingProgress.save();
		}
	} else {
		await userProgressModel.create({
			user: user._id,
			lesson: lessonId,
			course: course._id,
			isCompleted: true,
		});
	}

	if (!nextLesson) {
		return res.json({ message: 'You have successfully completed the course!', end: true });
	}

	return res.json({ lessonId: String(nextLesson._id), success: true });
});

export const updatePurchaseAccess = catchAsync(async (req, res) => {
	const { id } = req.params;
	const purchase = await purchaseModel.findById(id);

	if (!purchase) return res.status(404).json('Purchase not found');

	purchase.access = !purchase.access;
	await purchase.save();

	res.json({ message: 'Purchase access updated successfully' });
});

export const deleteNote = catchAsync(async (req, res) => {
	const { id } = req.params;
	req.user;

	await noteModel.findByIdAndDelete(id);
	res.json({ message: 'Note deleted successfully' });
});

export const resetProgress = catchAsync(async (req, res) => {
	const user = req.user;
	const { id } = req.params;

	const course = await courseModel.findById(id).select('_id slug');
	if (!course) return res.status(404).json('Course not found');

	await userProgressModel.deleteMany({ user: user._id, course: course._id });
	res.json({ message: 'Progress reset successfully' });
});

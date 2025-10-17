import express from 'express';
import * as courseController from '../controllers/course.controller.js';

const router = express.Router();

router.get('/courses', courseController.getCourses);
router.get('/courses/:slug', courseController.getCourseBySlug);
router.get('/courses/:courseId/lessons', courseController.getLessonsByCourseId);
router.get('/courses/:slug/dashboard', courseController.getLessonDashboard);
router.get('/lessons/:id', courseController.getLesson);
router.get('/lessons/:id/notes', courseController.getNotes);
router.get('/courses/:slug/data', courseController.getLessonData);
router.get('/review/:slug', courseController.getReview);
router.get('/courses/:slug/reviews', courseController.getReviews);
router.get('/courses/:slug/check-access', courseController.checkAccessToCourse);
router.get('/s3/get-url', courseController.getS3PresignedUrl);

router.post('/courses/:id/enroll/free', courseController.purchaseFreeCourse);
router.post('/lessons/notes', courseController.createNote);
router.post('/lessons/next', courseController.nextCourseLesson);
router.post('/review', courseController.createReview);

router.patch('/purchases/:id/access', courseController.updatePurchaseAccess);

router.delete('/notes/:id', courseController.deleteNote);
router.delete('/courses/:id/reset', courseController.resetProgress);

export default router;

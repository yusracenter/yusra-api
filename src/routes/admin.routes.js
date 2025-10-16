import express from 'express';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

router.get('/programs', adminController.getAllPrograms);
router.get('/program/:id', adminController.getProgramById);
router.get('/program/enrollments/:id', adminController.getProgramEnrollments);
router.get('/users', adminController.getAllUsers);
router.get('/users/stats', adminController.getUserStats);
router.get('/attendance/kids/:id', adminController.getAttendanceKids);
router.get('/courses', adminController.getAllCourses);
router.get('/course/:id', adminController.getCourseById);
router.get('/course/lessons/:id', adminController.getCourseLessons);
router.get('/course/purchases/:id', adminController.getCoursePurchases);

router.post('/programs', adminController.createProgram);
router.post('/program/transfer', adminController.transferProgram);
router.post('/attendance/users', adminController.atendanceUsers);
router.post('/attendance/scan', adminController.toggleAttendance);
router.post('/course', adminController.createCourse);
router.post('/course/lesson', adminController.createCourseLesson);

router.put('/programs', adminController.updateProgram);
router.put('/program/enrollment/:id/renew-off', adminController.renewEnrollmentOff);
router.put('/user/role/:id', adminController.updateUserRole);
router.put('/attendance/kid', adminController.updateKidAttendance);
router.put('/attendance/kid/manual', adminController.updateKidAttendanceManual);
router.put('/course/:id', adminController.updateCourse);
router.put('/course/lesson/:id', adminController.updateCourseLesson);
router.put('/course/purchase/access', adminController.grantCourseAccess);
router.put('/course/review/:id', adminController.updateCourseReview);

router.delete('/programs/:id', adminController.deleteProgram);
router.delete('/program/enrollment/:id', adminController.deleteEnrollment);
router.delete('/user/:id', adminController.deleteUser);
router.delete('/course/:id', adminController.deleteCourse);
router.delete('/course/lesson/:id', adminController.deleteCourseLesson);

export default router;

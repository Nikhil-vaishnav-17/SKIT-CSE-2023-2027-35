const express = require('express');
const classesController = require('./classes.controller');
const { verifyToken, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

// All class routes require a valid authenticated session
router.use(verifyToken);

/**
 * @route   POST /api/classes
 * @desc    Create a new class
 * @access  Private (Admin, Teacher)
 */
router.post('/', requireRole('admin', 'teacher'), classesController.createClass);

/**
 * @route   GET /api/classes
 * @desc    List accessible classes for current user
 * @access  Private (Admin, Teacher, Student)
 */
router.get('/', classesController.getAllClasses);

/**
 * @route   GET /api/classes/:id
 * @desc    Get detailed class info
 * @access  Private (Admin, Teacher assigned, Student enrolled)
 */
router.get('/:id', classesController.getClassById);

/**
 * @route   PUT /api/classes/:id
 * @desc    Update class information
 * @access  Private (Admin, Teacher assigned)
 */
router.put('/:id', requireRole('admin', 'teacher'), classesController.updateClass);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete a class and related associations
 * @access  Private (Admin)
 */
router.delete('/:id', requireRole('admin'), classesController.deleteClass);

/**
 * @route   POST /api/classes/:id/teachers
 * @desc    Assign a teacher to a class
 * @access  Private (Admin)
 */
router.post('/:id/teachers', requireRole('admin'), classesController.assignTeacher);

/**
 * @route   DELETE /api/classes/:id/teachers/:teacherId
 * @desc    Remove a teacher assignment from a class
 * @access  Private (Admin)
 */
router.delete('/:id/teachers/:teacherId', requireRole('admin'), classesController.removeTeacher);

module.exports = router;


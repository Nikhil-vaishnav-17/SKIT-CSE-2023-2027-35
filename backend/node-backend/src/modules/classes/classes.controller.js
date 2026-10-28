const classesService = require('./classes.service');
const { 
  createClassSchema, 
  updateClassSchema, 
  classIdParamSchema, 
  assignTeacherSchema, 
  teacherParamSchema 
} = require('./classes.validation');
const { sendSuccess } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

/**
 * Handle new class creation
 */
const createClass = async (req, res, next) => {
  try {
    const { error, value } = createClassSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const newClass = await classesService.createClass(value, req.user);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Class created successfully',
      data: { class: newClass },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List classes accessible by current user
 */
const getAllClasses = async (req, res, next) => {
  try {
    const classes = await classesService.getAllClasses(req.user);

    return sendSuccess(res, {
      message: 'Classes retrieved successfully',
      data: { classes },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get class details by ID
 */
const getClassById = async (req, res, next) => {
  try {
    const { error, value } = classIdParamSchema.validate(req.params);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const classData = await classesService.getClassById(value.id, req.user);

    return sendSuccess(res, {
      message: 'Class retrieved successfully',
      data: { class: classData },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update class information
 */
const updateClass = async (req, res, next) => {
  try {
    const paramValidation = classIdParamSchema.validate(req.params);
    if (paramValidation.error) {
      throw new ValidationError(paramValidation.error.details[0].message);
    }

    const bodyValidation = updateClassSchema.validate(req.body);
    if (bodyValidation.error) {
      throw new ValidationError(bodyValidation.error.details[0].message);
    }

    const updatedClass = await classesService.updateClass(
      paramValidation.value.id,
      bodyValidation.value,
      req.user
    );

    return sendSuccess(res, {
      message: 'Class updated successfully',
      data: { class: updatedClass },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a class
 */
const deleteClass = async (req, res, next) => {
  try {
    const { error, value } = classIdParamSchema.validate(req.params);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    await classesService.deleteClass(value.id);

    return sendSuccess(res, {
      message: 'Class deleted successfully',
      data: { id: value.id },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Assign a teacher to a class
 */
const assignTeacher = async (req, res, next) => {
  try {
    const paramValidation = classIdParamSchema.validate(req.params);
    if (paramValidation.error) {
      throw new ValidationError(paramValidation.error.details[0].message);
    }

    const bodyValidation = assignTeacherSchema.validate(req.body);
    if (bodyValidation.error) {
      throw new ValidationError(bodyValidation.error.details[0].message);
    }

    const assignment = await classesService.assignTeacher(
      paramValidation.value.id,
      bodyValidation.value.teacher_id
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Teacher assigned to class successfully',
      data: { assignment },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove a teacher from a class
 */
const removeTeacher = async (req, res, next) => {
  try {
    const { error, value } = teacherParamSchema.validate(req.params);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    await classesService.removeTeacher(value.id, value.teacherId);

    return sendSuccess(res, {
      message: 'Teacher removed from class successfully',
      data: { class_id: value.id, teacher_id: value.teacherId },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignTeacher,
  removeTeacher,
};


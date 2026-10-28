const Joi = require('joi');

const createClassSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Class name is required',
    'string.min': 'Class name must be at least 2 characters long',
    'string.max': 'Class name cannot exceed 150 characters',
    'any.required': 'Class name is required',
  }),
  section: Joi.string().trim().max(20).allow('', null).optional(),
  semester: Joi.string().trim().max(20).allow('', null).optional(),
});

const updateClassSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).optional(),
  section: Joi.string().trim().max(20).allow('', null).optional(),
  semester: Joi.string().trim().max(20).allow('', null).optional(),
}).min(1).messages({
  'object.min': 'At least one field (name, section, or semester) must be provided for update',
});

const classIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid class ID format (must be a valid UUID)',
    'any.required': 'Class ID is required',
  }),
});

const assignTeacherSchema = Joi.object({
  teacher_id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid teacher ID format (must be a valid UUID)',
    'any.required': 'teacher_id is required',
  }),
});

const teacherParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid class ID format (must be a valid UUID)',
  }),
  teacherId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid teacher ID format (must be a valid UUID)',
  }),
});

module.exports = {
  createClassSchema,
  updateClassSchema,
  classIdParamSchema,
  assignTeacherSchema,
  teacherParamSchema,
};


const { query } = require('../../db/pool');
const { 
  NotFoundError, 
  ForbiddenError, 
  BadRequestError, 
  ConflictError 
} = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Create a new class.
 * Admins can create classes. Teachers can also create classes and are automatically assigned.
 */
const createClass = async ({ name, section, semester }, user) => {
  const insertQuery = `
    INSERT INTO classes (name, section, semester)
    VALUES ($1, $2, $3)
    RETURNING id, name, section, semester, created_at, updated_at
  `;
  const result = await query(insertQuery, [
    name.trim(),
    section ? section.trim() : null,
    semester ? semester.trim() : null,
  ]);

  const newClass = result.rows[0];

  // If created by a teacher, automatically assign the teacher
  if (user.role === 'teacher') {
    await query(
      'INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2)',
      [newClass.id, user.id]
    );
    logger.info(`Teacher ${user.id} automatically assigned to new class ${newClass.id}`);
  }

  logger.info(`Class created: ${newClass.name} (${newClass.id}) by user ${user.id}`);
  return newClass;
};

/**
 * List all classes filtered by user role.
 * - Admin: sees all classes with teachers and student count.
 * - Teacher: sees classes assigned to them.
 * - Student: sees classes they are enrolled in.
 */
const getAllClasses = async (user) => {
  let sql;
  let params = [];

  if (user.role === 'admin') {
    sql = `
      SELECT 
        c.id, c.name, c.section, c.semester, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
          ) FILTER (WHERE u.id IS NOT NULL), '[]'
        ) AS teachers,
        COUNT(DISTINCT e.id)::int AS enrolled_students_count
      FROM classes c
      LEFT JOIN class_teachers ct ON c.id = ct.class_id
      LEFT JOIN users u ON ct.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.class_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
  } else if (user.role === 'teacher') {
    sql = `
      SELECT 
        c.id, c.name, c.section, c.semester, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
          ) FILTER (WHERE u.id IS NOT NULL), '[]'
        ) AS teachers,
        COUNT(DISTINCT e.id)::int AS enrolled_students_count
      FROM classes c
      INNER JOIN class_teachers my_ct ON c.id = my_ct.class_id AND my_ct.teacher_id = $1
      LEFT JOIN class_teachers ct ON c.id = ct.class_id
      LEFT JOIN users u ON ct.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.class_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    params = [user.id];
  } else if (user.role === 'student') {
    sql = `
      SELECT 
        c.id, c.name, c.section, c.semester, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
          ) FILTER (WHERE u.id IS NOT NULL), '[]'
        ) AS teachers
      FROM classes c
      INNER JOIN enrollments my_e ON c.id = my_e.class_id AND my_e.student_id = $1
      LEFT JOIN class_teachers ct ON c.id = ct.class_id
      LEFT JOIN users u ON ct.teacher_id = u.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    params = [user.id];
  }

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Retrieve a single class by ID with access control checks.
 */
const getClassById = async (classId, user) => {
  const sql = `
    SELECT 
      c.id, c.name, c.section, c.semester, c.created_at, c.updated_at,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
        ) FILTER (WHERE u.id IS NOT NULL), '[]'
      ) AS teachers,
      COUNT(DISTINCT e.id)::int AS enrolled_students_count
    FROM classes c
    LEFT JOIN class_teachers ct ON c.id = ct.class_id
    LEFT JOIN users u ON ct.teacher_id = u.id
    LEFT JOIN enrollments e ON c.id = e.class_id
    WHERE c.id = $1
    GROUP BY c.id
  `;

  const result = await query(sql, [classId]);
  const classItem = result.rows[0];

  if (!classItem) {
    throw new NotFoundError('Class not found');
  }

  // Enforce access control for non-admin users
  if (user.role === 'teacher') {
    const isAssigned = classItem.teachers.some((t) => t.id === user.id);
    if (!isAssigned) {
      throw new ForbiddenError('You do not have permission to access this class');
    }
  } else if (user.role === 'student') {
    const enrollmentCheck = await query(
      'SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2',
      [classId, user.id]
    );
    if (enrollmentCheck.rows.length === 0) {
      throw new ForbiddenError('You are not enrolled in this class');
    }
  }

  return classItem;
};

/**
 * Update class details.
 * Allowed for Admin, or a Teacher assigned to the class.
 */
const updateClass = async (classId, { name, section, semester }, user) => {
  // Check existence
  const existing = await query('SELECT id FROM classes WHERE id = $1', [classId]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Class not found');
  }

  // Teacher permission check
  if (user.role === 'teacher') {
    const assignment = await query(
      'SELECT 1 FROM class_teachers WHERE class_id = $1 AND teacher_id = $2',
      [classId, user.id]
    );
    if (assignment.rows.length === 0) {
      throw new ForbiddenError('You are not authorized to update this class');
    }
  }

  const updateQuery = `
    UPDATE classes
    SET
      name = COALESCE($1, name),
      section = COALESCE($2, section),
      semester = COALESCE($3, semester)
    WHERE id = $4
    RETURNING id, name, section, semester, created_at, updated_at
  `;

  const result = await query(updateQuery, [
    name !== undefined ? name.trim() : null,
    section !== undefined ? (section ? section.trim() : null) : null,
    semester !== undefined ? (semester ? semester.trim() : null) : null,
    classId,
  ]);

  logger.info(`Class updated: ${classId} by user ${user.id}`);
  return result.rows[0];
};

/**
 * Delete a class.
 * Admin only.
 */
const deleteClass = async (classId) => {
  const result = await query('DELETE FROM classes WHERE id = $1 RETURNING id', [classId]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Class not found');
  }

  logger.info(`Class deleted: ${classId}`);
  return { id: classId };
};

/**
 * Assign a teacher to a class.
 * Admin only.
 */
const assignTeacher = async (classId, teacherId) => {
  // 1. Verify class exists
  const classResult = await query('SELECT id FROM classes WHERE id = $1', [classId]);
  if (classResult.rows.length === 0) {
    throw new NotFoundError('Class not found');
  }

  // 2. Verify teacher exists and has 'teacher' role
  const teacherResult = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [teacherId]
  );
  const teacher = teacherResult.rows[0];
  if (!teacher) {
    throw new NotFoundError('Teacher not found');
  }
  if (teacher.role !== 'teacher') {
    throw new BadRequestError('User must have teacher role to be assigned to a class');
  }

  // 3. Check for duplicate assignment
  const existingAssignment = await query(
    'SELECT id FROM class_teachers WHERE class_id = $1 AND teacher_id = $2',
    [classId, teacherId]
  );
  if (existingAssignment.rows.length > 0) {
    throw new ConflictError('Teacher is already assigned to this class');
  }

  // 4. Insert assignment
  const insertResult = await query(
    'INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2) RETURNING id, class_id, teacher_id, assigned_at',
    [classId, teacherId]
  );

  logger.info(`Teacher ${teacherId} assigned to class ${classId}`);
  return {
    ...insertResult.rows[0],
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
    },
  };
};

/**
 * Remove a teacher from a class.
 * Admin only.
 */
const removeTeacher = async (classId, teacherId) => {
  // Verify class exists
  const classResult = await query('SELECT id FROM classes WHERE id = $1', [classId]);
  if (classResult.rows.length === 0) {
    throw new NotFoundError('Class not found');
  }

  const result = await query(
    'DELETE FROM class_teachers WHERE class_id = $1 AND teacher_id = $2 RETURNING id',
    [classId, teacherId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Teacher assignment not found for this class');
  }

  logger.info(`Teacher ${teacherId} removed from class ${classId}`);
  return { class_id: classId, teacher_id: teacherId };
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


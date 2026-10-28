const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/db/pool');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

// Mock database pool
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
}));

describe('Classes Endpoints', () => {
  const adminUser = {
    id: '11111111-1111-1111-1111-111111111111',
    role: 'admin',
  };

  const teacherUser = {
    id: '22222222-2222-2222-2222-222222222222',
    role: 'teacher',
  };

  const studentUser = {
    id: '33333333-3333-3333-3333-333333333333',
    role: 'student',
  };

  const generateToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, {
      expiresIn: '1h',
    });
  };

  const adminToken = generateToken(adminUser);
  const teacherToken = generateToken(teacherUser);
  const studentToken = generateToken(studentUser);

  const mockClassId = '44444444-4444-4444-4444-444444444444';
  const mockClass = {
    id: mockClassId,
    name: 'CS401 - Database Systems',
    section: 'A',
    semester: '7th',
    created_at: new Date(),
    updated_at: new Date(),
    teachers: [{ id: teacherUser.id, name: 'Prof. Sharma', email: 'teacher@attendai.com' }],
    enrolled_students_count: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization Guards', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/api/classes');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 403 if student attempts to create a class', async () => {
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'CS500 - Advanced AI' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should return 403 if student attempts to delete a class', async () => {
      const res = await request(app)
        .delete(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should return 403 if teacher attempts to delete a class', async () => {
      const res = await request(app)
        .delete(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/classes', () => {
    it('should return 422 if class name is missing', async () => {
      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ section: 'B' });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should successfully create a class as Admin', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: mockClassId,
          name: 'CS401 - Database Systems',
          section: 'A',
          semester: '7th',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CS401 - Database Systems',
          section: 'A',
          semester: '7th',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.class.id).toBe(mockClassId);
    });

    it('should create class and auto-assign teacher when created by Teacher', async () => {
      // 1. Insert class
      query.mockResolvedValueOnce({
        rows: [{
          id: mockClassId,
          name: 'CS402 - Computer Networks',
          section: 'B',
          semester: '7th',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });
      // 2. Insert class_teachers
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'CS402 - Computer Networks', section: 'B' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/classes', () => {
    it('should return all classes for Admin', async () => {
      query.mockResolvedValueOnce({ rows: [mockClass] });

      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.classes).toHaveLength(1);
    });

    it('should return assigned classes for Teacher', async () => {
      query.mockResolvedValueOnce({ rows: [mockClass] });

      const res = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.classes).toHaveLength(1);
    });
  });

  describe('GET /api/classes/:id', () => {
    it('should return 422 for invalid UUID param', async () => {
      const res = await request(app)
        .get('/api/classes/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if class does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('should return class details for Admin', async () => {
      query.mockResolvedValueOnce({ rows: [mockClass] });

      const res = await request(app)
        .get(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.class.id).toBe(mockClassId);
    });
  });

  describe('PUT /api/classes/:id', () => {
    it('should return 422 if update payload is empty', async () => {
      const res = await request(app)
        .put(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should update class details as Admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] }); // Existence check
      query.mockResolvedValueOnce({
        rows: [{
          ...mockClass,
          name: 'CS401 - Database Systems (Updated)',
        }],
      }); // Update query

      const res = await request(app)
        .put(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'CS401 - Database Systems (Updated)' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.class.name).toContain('(Updated)');
    });
  });

  describe('DELETE /api/classes/:id', () => {
    it('should delete class as Admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] });

      const res = await request(app)
        .delete(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockClassId);
    });

    it('should return 404 if class to delete does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete(`/api/classes/${mockClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
  });

  describe('Teacher Assignment Endpoints', () => {
    const newTeacherId = '55555555-5555-5555-5555-555555555555';

    it('should assign a teacher to a class as Admin', async () => {
      // 1. Class exists
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] });
      // 2. User exists & is teacher
      query.mockResolvedValueOnce({
        rows: [{ id: newTeacherId, name: 'Prof. Verma', email: 'verma@attendai.com', role: 'teacher' }],
      });
      // 3. Not already assigned
      query.mockResolvedValueOnce({ rows: [] });
      // 4. Insert assignment
      query.mockResolvedValueOnce({
        rows: [{
          id: '66666666-6666-6666-6666-666666666666',
          class_id: mockClassId,
          teacher_id: newTeacherId,
          assigned_at: new Date(),
        }],
      });

      const res = await request(app)
        .post(`/api/classes/${mockClassId}/teachers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ teacher_id: newTeacherId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment.teacher_id).toBe(newTeacherId);
    });

    it('should return 409 if teacher is already assigned to class', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] });
      query.mockResolvedValueOnce({
        rows: [{ id: newTeacherId, name: 'Prof. Verma', email: 'verma@attendai.com', role: 'teacher' }],
      });
      query.mockResolvedValueOnce({ rows: [{ id: 'existing-assignment-id' }] }); // Already assigned

      const res = await request(app)
        .post(`/api/classes/${mockClassId}/teachers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ teacher_id: newTeacherId });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('CONFLICT');
    });

    it('should return 400 if assigned user is not a teacher', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] });
      query.mockResolvedValueOnce({
        rows: [{ id: studentUser.id, name: 'Rohan Student', email: 'rohan@attendai.com', role: 'student' }],
      });

      const res = await request(app)
        .post(`/api/classes/${mockClassId}/teachers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ teacher_id: studentUser.id });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('BAD_REQUEST');
    });

    it('should remove teacher assignment as Admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: mockClassId }] }); // Class exists
      query.mockResolvedValueOnce({ rows: [{ id: 'deleted-record-id' }] }); // Delete rowCount > 0

      const res = await request(app)
        .delete(`/api/classes/${mockClassId}/teachers/${newTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});


const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/db/pool');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

// Mock the database pool to avoid needing a live DB during tests
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
}));

describe('Auth Endpoints', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Admin',
    email: 'admin@attendai.com',
    role: 'admin',
    password_hash: '$2b$12$somehashedpasswordstringhere', // dummy hash
    created_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 422 if validation fails (missing fields)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@attendai.com' }); // missing password

      expect(res.statusCode).toEqual(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      // Mock DB to return no user
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@attendai.com', password: 'password123' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should return a token and user data on successful login', async () => {
      // Mock DB to return our mock user
      query.mockResolvedValueOnce({ rows: [mockUser] });
      
      // Mock bcrypt to always return true for this test
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@attendai.com', password: 'CorrectPassword123' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe(mockUser.email);
      expect(res.body.data.user).not.toHaveProperty('password_hash'); // Ensure hash isn't leaked
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 if no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should return user profile if valid token is provided', async () => {
      // Generate a valid token using our config secret
      const validToken = jwt.sign(
        { id: mockUser.id, role: mockUser.role },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Mock DB to return user profile
      query.mockResolvedValueOnce({
        rows: [{
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          created_at: mockUser.created_at
        }]
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(mockUser.email);
    });
  });
});

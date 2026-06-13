import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prismaMock } from '../../test/setup';
import bcrypt from 'bcryptjs';

describe('Auth Routes', () => {
  describe('GET /api/health', () => {
    it('should return 200 and status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'CureQ API',
        })
      );
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 if missing email, password, or name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Please provide email, password, and name.');
    });

    it('should register a new Clinic Admin user successfully', async () => {
      // Mock that user doesn't already exist
      prismaMock.user.findFirst.mockResolvedValue(null);
      
      // Mock user creation
      const mockCreatedUser = {
        id: 'user_123',
        email: 'newadmin@example.com',
        name: 'New Admin',
        phone: '9876543210',
        role: 'CLINIC_ADMIN',
        password: 'hashed_password',
      };
      // @ts-ignore
      prismaMock.user.create.mockResolvedValue(mockCreatedUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newadmin@example.com',
          password: 'securePassword123',
          name: 'New Admin',
          phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toEqual({
        id: 'user_123',
        email: 'newadmin@example.com',
        role: 'CLINIC_ADMIN',
        name: 'New Admin',
      });
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it('should return 400 if user with email/phone already exists', async () => {
      // Mock user already exists
      const existingUser = {
        id: 'user_123',
        email: 'newadmin@example.com',
        name: 'Existing Admin',
        role: 'CLINIC_ADMIN',
        password: 'hashed_password',
      };
      // @ts-ignore
      prismaMock.user.findFirst.mockResolvedValue(existingUser);

      // Mock bcrypt compare to fail so we don't login
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newadmin@example.com',
          password: 'differentPassword',
          name: 'New Admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('User with this email or phone already exists.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('myPassword123', 10);
      const mockUser = {
        id: 'user_123',
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'CLINIC_ADMIN',
      };
      // @ts-ignore
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'myPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('admin@example.com');
    });

    it('should return 400 with invalid credentials', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'admin@example.com',
        password: 'correct_hashed_password',
        name: 'Admin User',
        role: 'CLINIC_ADMIN',
      };
      // @ts-ignore
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'wrongPassword',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid credentials.');
    });
  });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret_for_cureq_platform';

const generateToken = (role: string) => {
  return jwt.sign({
    id: 'test-user-id',
    email: 'test@example.com',
    role,
    name: 'Test User'
  }, process.env.JWT_SECRET as string);
};

describe('Advanced RBAC Permission Middleware', () => {
  it('should allow CLINIC_ADMIN to access a MANAGE_CLINIC protected route', async () => {
    const token = generateToken('CLINIC_ADMIN');
    // POST /api/clinics/:id/branches requires MANAGE_CLINIC
    const res = await request(app)
      .post('/api/clinics/test-clinic-id/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({});
      
    // 400 means it passed RBAC auth and hit the route validation logic
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Please provide branch name');
  });

  it('should deny PATIENT access to a MANAGE_CLINIC protected route', async () => {
    const token = generateToken('PATIENT');
    const res = await request(app)
      .post('/api/clinics/test-clinic-id/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({});
      
    // 403 means Forbidden by RBAC
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied. Missing required permission.');
  });

  it('should allow SUPER_ADMIN to access a MANAGE_CLINIC protected route (SYSTEM_ADMIN override)', async () => {
    const token = generateToken('SUPER_ADMIN');
    const res = await request(app)
      .post('/api/clinics/test-clinic-id/branches')
      .set('Authorization', `Bearer ${token}`)
      .send({});
      
    // 400 means it passed RBAC auth
    expect(res.status).toBe(400);
  });
  
  it('should return 401 if no token is provided', async () => {
    const res = await request(app)
      .post('/api/clinics/test-clinic-id/branches')
      .send({});
      
    // 401 means Unauthorized
    expect(res.status).toBe(401);
  });
});

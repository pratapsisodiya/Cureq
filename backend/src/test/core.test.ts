import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('Core Backend Upgrades E2E Tests', () => {
  it('should return security headers from Helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    // Helmet headers
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers).toHaveProperty('x-frame-options');
    expect(res.headers).toHaveProperty('strict-transport-security');
  });

  it('should enforce rate limiting headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });

  it('should serve Swagger documentation at /api-docs/', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });

  it('should handle non-existent routes', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});

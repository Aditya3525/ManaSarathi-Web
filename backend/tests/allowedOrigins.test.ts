import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAllowedProductionOrigins, isAllowedFrontendOrigin } from '../src/config/allowedOrigins';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('allowedOrigins', () => {
  it('allows configured production frontend origins exactly', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_URL', 'https://manasarathi-frontend.vercel.app');

    expect(isAllowedFrontendOrigin('https://manasarathi-frontend.vercel.app')).toBe(true);
    expect(isAllowedFrontendOrigin('https://random-preview.vercel.app')).toBe(false);
  });

  it('supports explicit additional production origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADDITIONAL_CORS_ORIGINS', 'https://preview.example.com, https://staging.example.com/');

    expect(getAllowedProductionOrigins()).toContain('https://staging.example.com');
    expect(isAllowedFrontendOrigin('https://preview.example.com')).toBe(true);
  });

  it('allows localhost only outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(isAllowedFrontendOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedFrontendOrigin('http://127.0.0.1:5173')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

describe('backend smoke', () => {
  it('loads environment-dependent LDAP service safely without config', async () => {
    const { authenticateLDAP } = await import('../services/ldap.service.js');
    await expect(authenticateLDAP('', '')).resolves.toBe(false);
  });
});

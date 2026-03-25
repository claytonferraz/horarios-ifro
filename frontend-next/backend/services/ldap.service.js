const { Client } = require('ldapts');

async function authenticateLDAP(username, password) {
  if (!process.env.LDAP_URL || !username || !password) return false;

  const client = new Client({
    url: process.env.LDAP_URL,
    timeout: 5000,
    connectTimeout: 5000,
  });

  const bindDN = username.includes('@')
    ? username
    : `${username}${process.env.LDAP_DOMAIN || ''}`;

  try {
    await client.bind(bindDN, password);
    console.log('[LDAP] Autenticacao bem-sucedida.');
    return true;
  } catch (err) {
    console.warn('[LDAP] Falha de autenticacao.');
    if (err && err.message) {
      console.error('[LDAP] Detalhe do erro:', err.message);
    }
    return false;
  } finally {
    try {
      await client.unbind();
    } catch (unbindErr) {
      if (unbindErr && unbindErr.message) {
        console.warn('[LDAP] Falha ao encerrar conexao:', unbindErr.message);
      }
    }
  }
}

module.exports = { authenticateLDAP };

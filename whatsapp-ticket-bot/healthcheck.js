// ================================================
// HEALTH CHECK PARA CONTAINERS
// Verifica se a aplicação está funcionando corretamente
// ================================================

const http = require('http');
const { Pool } = require('pg');

async function checkHealth() {
  try {
    // 1. Verificar se o servidor HTTP está respondendo
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: process.env.PORT || 3006,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`HTTP Status: ${res.statusCode}`));
        }
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('HTTP Timeout')));
      req.end();
    });

    // 2. Verificar conexão com PostgreSQL
    if (process.env.DB_HOST) {
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionTimeoutMillis: 5000
      });

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
    }

    console.log('✅ Health check passed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

checkHealth();

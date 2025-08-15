require('dotenv').config();

console.log('🔍 Testando variáveis de ambiente...');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD tipo:', typeof process.env.DB_PASSWORD, 'valor:', process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);

// Teste direto com pg
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'whatsapp_campaigns',
});

async function testConnection() {
  try {
    console.log('🔌 Testando conexão direta com PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL!');
    
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Horário do servidor:', result.rows[0].now);
    
    client.release();
    await pool.end();
    console.log('✅ Teste concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    process.exit(1);
  }
}

testConnection();

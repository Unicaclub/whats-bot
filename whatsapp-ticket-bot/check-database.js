require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'whatsapp_campaigns',
});

async function checkDatabase() {
  try {
    console.log('🔍 Verificando registros no PostgreSQL...');
    
    // Verificar registros na sent_numbers
    const sentNumbers = await pool.query(`
      SELECT id, campaign_id, phone_number, status, sent_at, metadata 
      FROM sent_numbers 
      ORDER BY sent_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📊 Últimos 5 registros em sent_numbers:');
    sentNumbers.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id} | Campanha: ${row.campaign_id} | Número: ${row.phone_number}`);
      console.log(`   Status: ${row.status} | Enviado: ${row.sent_at}`);
      console.log(`   Metadata: ${JSON.stringify(row.metadata, null, 2)}\n`);
    });
    
    // Verificar logs do sistema
    const systemLogs = await pool.query(`
      SELECT id, level, message, campaign_id, phone_number, created_at 
      FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log('📋 Últimos 3 logs do sistema:');
    systemLogs.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.level}: ${row.message}`);
      console.log(`   Criado: ${row.created_at}\n`);
    });
    
    await pool.end();
    console.log('✅ Verificação concluída!');
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    process.exit(1);
  }
}

checkDatabase();

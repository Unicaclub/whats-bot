require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'whatsapp_campaigns',
});

async function checkSchema() {
  try {
    console.log('🔍 Verificando esquema do banco...');
    
    // Verificar estrutura da tabela sent_numbers
    console.log('\n📊 Estrutura da tabela sent_numbers:');
    const sentNumbersSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'sent_numbers' 
      ORDER BY ordinal_position
    `);
    console.table(sentNumbersSchema.rows);
    
    // Verificar enum campaign_status
    console.log('\n📋 Valores do enum campaign_status:');
    const campaignStatusEnum = await pool.query(`
      SELECT enumlabel as value
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'campaign_status'
      ORDER BY enumsortorder
    `);
    console.table(campaignStatusEnum.rows);
    
    // Verificar estrutura da tabela system_logs
    console.log('\n📋 Estrutura da tabela system_logs:');
    const systemLogsSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'system_logs' 
      ORDER BY ordinal_position
    `);
    console.table(systemLogsSchema.rows);
    
    await pool.end();
    console.log('✅ Verificação concluída!');
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    process.exit(1);
  }
}

checkSchema();

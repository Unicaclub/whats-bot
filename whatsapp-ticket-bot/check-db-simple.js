const { Pool } = require('pg');

async function checkDatabase() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', 
    password: 'postgres',
    port: 5432
  });
  
  try {
    // 1. Verificar total de registros hoje
    const today = await pool.query(`
      SELECT COUNT(*) as total 
      FROM sent_numbers 
      WHERE DATE(sent_at) = CURRENT_DATE
    `);
    
    console.log(`📊 Total de registros HOJE: ${today.rows[0].total}`);
    
    // 2. Últimos 3 registros
    const latest = await pool.query(`
      SELECT id, phone_number, campaign_id, sent_at, status
      FROM sent_numbers 
      ORDER BY sent_at DESC 
      LIMIT 3
    `);
    
    console.log('\n🕐 ÚLTIMOS 3 REGISTROS:');
    latest.rows.forEach((row, i) => {
      const date = new Date(row.sent_at).toLocaleString('pt-BR');
      console.log(`${i+1}. ID:${row.id} - ${row.phone_number} - ${date}`);
    });
    
    // 3. Verificar se há registros após 08:00 de hoje
    const recentQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM sent_numbers 
      WHERE sent_at >= CURRENT_DATE + INTERVAL '8 hours'
    `);
    
    console.log(`\n⏰ Registros após 08:00 hoje: ${recentQuery.rows[0].count}`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro na consulta:', error.message);
  }
}

checkDatabase();

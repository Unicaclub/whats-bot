// Verificação rápida e direta do banco
const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'postgres',
  port: 5432,
});

client.connect()
  .then(() => {
    console.log('🔌 Conectado ao PostgreSQL');
    
    return client.query('SELECT MAX(id) as ultimo_id, COUNT(*) as total FROM sent_numbers');
  })
  .then(result => {
    console.log('📊 Último ID:', result.rows[0].ultimo_id);
    console.log('📊 Total registros:', result.rows[0].total);
    
    return client.query(`
      SELECT id, phone_number, sent_at 
      FROM sent_numbers 
      WHERE id > 2218 
      ORDER BY id DESC 
      LIMIT 5
    `);
  })
  .then(result => {
    console.log('\n🆕 NOVOS REGISTROS (ID > 2218):');
    if (result.rows.length === 0) {
      console.log('❌ NENHUM registro novo encontrado!');
    } else {
      result.rows.forEach((row, i) => {
        const date = new Date(row.sent_at).toLocaleString('pt-BR');
        console.log(`${i+1}. ID:${row.id} - ${row.phone_number} - ${date}`);
      });
    }
    
    return client.end();
  })
  .then(() => {
    console.log('\n✅ Verificação concluída');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });

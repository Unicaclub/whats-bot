// Monitor em tempo real para verificar se a correção funcionou
const { Client } = require('pg');

async function monitorDatabase() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost', 
    database: 'whatsapp_campaigns',
    password: '0000',
    port: 5432
  });
  
  await client.connect();
  console.log('🔍 MONITOR DE BANCO - Verificando salvamento em tempo real');
  console.log('⏰ Iniciado em:', new Date().toISOString());
  
  let lastId = 2228; // ID inicial
  
  setInterval(async () => {
    try {
      const result = await client.query('SELECT MAX(id) FROM sent_numbers');
      const currentId = result.rows[0].max;
      
      if (currentId > lastId) {
        console.log(`🎉 NOVO REGISTRO! ID: ${lastId} → ${currentId}`);
        
        // Buscar detalhes do novo registro
        const details = await client.query(`
          SELECT id, phone_number, campaign_id, sent_at 
          FROM sent_numbers 
          WHERE id > $1 
          ORDER BY id DESC 
          LIMIT 5
        `, [lastId]);
        
        details.rows.forEach(row => {
          const date = new Date(row.sent_at).toLocaleString('pt-BR');
          console.log(`  📱 ID:${row.id} - ${row.phone_number} - Campanha:${row.campaign_id} - ${date}`);
        });
        
        lastId = currentId;
      } else {
        process.stdout.write('.');
      }
    } catch (error) {
      console.error('❌ Erro:', error.message);
    }
  }, 2000); // Verificar a cada 2 segundos
}

monitorDatabase().catch(console.error);

// Finalizar após 5 minutos
setTimeout(() => {
  console.log('\n⏰ Monitor finalizado após 5 minutos');
  process.exit(0);
}, 300000);

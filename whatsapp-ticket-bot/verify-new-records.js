const { Client } = require('pg');
const client = new Client({user: 'postgres', host: 'localhost', database: 'whatsapp_campaigns', password: '0000', port: 5432});
client.connect().then(() => client.query('SELECT id, phone_number, campaign_id, sent_at FROM sent_numbers WHERE id > 2218 ORDER BY id DESC')).then(r => {
  console.log(`🎉 NOVOS REGISTROS ENCONTRADOS: ${r.rows.length}`);
  r.rows.forEach((row, i) => {
    const date = new Date(row.sent_at).toLocaleString('pt-BR');
    console.log(`${i+1}. ID:${row.id} - ${row.phone_number} - Campanha:${row.campaign_id} - ${date}`);
  });
  client.end();
}).catch(console.error);

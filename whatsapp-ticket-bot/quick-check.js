const { Client } = require('pg');
const client = new Client({user: 'postgres', host: 'localhost', database: 'whatsapp_campaigns', password: '0000', port: 5432});
client.connect().then(() => client.query('SELECT MAX(id) FROM sent_numbers')).then(r => {console.log('Último ID:', r.rows[0].max); client.end();}).catch(console.error);

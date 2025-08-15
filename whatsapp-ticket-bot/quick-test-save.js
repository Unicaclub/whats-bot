const { getCampaignTracker } = require('./modules/campaignTracker');

async function quickTest() {
  console.log('🧪 TESTE RÁPIDO DE SALVAMENTO');
  
  try {
    const tracker = getCampaignTracker();
    const testNumber = '5511999888777';
    
    console.log(`📱 Testando salvamento de ${testNumber}...`);
    
    const result = await tracker.registerSentNumber(1, testNumber, {
      status: 'enviado',
      session: 'test',
      sent_via: 'teste_rapido',
      timestamp: new Date().toISOString()
    });
    
    console.log('📊 Resultado:', result);
    
    if (result.success) {
      console.log(`✅ SUCESSO! ID: ${result.sentId}`);
      
      // Verificar no banco
      const { Client } = require('pg');
      const client = new Client({user: 'postgres', host: 'localhost', database: 'whatsapp_campaigns', password: '0000', port: 5432});
      await client.connect();
      const check = await client.query('SELECT MAX(id) as ultimo_id FROM sent_numbers');
      console.log(`🔍 Último ID no banco: ${check.rows[0].ultimo_id}`);
      await client.end();
    } else {
      console.log(`❌ FALHA: ${result.message}`);
    }
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
  }
  
  process.exit(0);
}

quickTest();

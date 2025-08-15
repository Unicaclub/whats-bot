const { getCampaignTracker } = require('./modules/campaignTracker');

async function testTracking() {
  try {
    console.log('🔍 Testando tracking do PostgreSQL...');
    
    const tracker = getCampaignTracker();
    
    // Teste simples de inserção
    const result = await tracker.registerSentNumber(
      1, // campaignId
      '5511999999999', // phoneNumber
      'enviado', // status
      {
        session: 'sales',
        sent_via: 'test',
        timestamp: new Date().toISOString(),
        message_template: 'Teste de tracking'
      }
    );
    
    console.log('✅ Resultado do teste:', result);
    
    console.log('✅ Teste concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

testTracking();

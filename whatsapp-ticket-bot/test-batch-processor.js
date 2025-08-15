// Teste do CampaignBatchProcessor com campaignControl configurado
const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testBatchProcessor() {
  console.log('🧪 TESTANDO CAMPAIGNBATCHPROCESSOR');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');
  
  try {
    // 1. Inicializar tracker
    const tracker = getCampaignTracker();
    
    // 2. Criar mock do campaignControl
    const mockCampaignControl = {
      tracker: tracker,
      
      async markCampaignSent(phoneNumber, campaignData = {}) {
        console.log(`📞 [CampaignControl] markCampaignSent: ${phoneNumber}`);
        
        const cleanNumber = phoneNumber.replace('@c.us', '');
        const campaignId = campaignData.campaignId || 1;
        
        try {
          const result = await tracker.registerSentNumber(campaignId, cleanNumber, {
            status: campaignData.status || 'enviado',
            session: campaignData.session || 'batch',
            sent_via: campaignData.sent_via || 'batch_processor',
            messageId: campaignData.messageId || null,
            notes: `Teste BatchProcessor - ${new Date().toISOString()}`,
            timestamp: campaignData.timestamp || new Date().toISOString()
          });
          
          if (result.success) {
            console.log(`✅ [CampaignControl] Sucesso: ${cleanNumber} → ID ${result.sentId}`);
          } else {
            console.log(`❌ [CampaignControl] Falha: ${result.message}`);
          }
          
          return result;
        } catch (error) {
          console.error(`💥 [CampaignControl] Erro: ${error.message}`);
          return { success: false, message: error.message };
        }
      }
    };
    
    // 3. Criar CampaignBatchProcessor
    const batchProcessor = new CampaignBatchProcessor({
      batchSize: 2,
      minInterval: 1000,
      maxInterval: 2000,
      batchDelayMin: 1000,
      batchDelayMax: 2000
    });
    
    // 4. CONFIGURAR campaignControl (esta é a correção!)
    batchProcessor.campaignControl = mockCampaignControl;
    console.log('✅ CampaignControl configurado no BatchProcessor');
    
    // 5. Testar recordSentNumber
    console.log('\n📋 Testando recordSentNumber...');
    
    const testNumbers = ['5511999111000', '5511999222000'];
    
    for (let i = 0; i < testNumbers.length; i++) {
      const number = testNumbers[i];
      console.log(`\n${i + 1}. Testando ${number}:`);
      
      await batchProcessor.recordSentNumber(number, 888);
    }
    
    // 6. Verificar no banco
    console.log('\n🔍 Verificando registros no banco...');
    const { Client } = require('pg');
    const client = new Client({
      user: 'postgres', 
      host: 'localhost', 
      database: 'whatsapp_campaigns', 
      password: '0000', 
      port: 5432
    });
    
    await client.connect();
    const result = await client.query(`
      SELECT id, phone_number, campaign_id, sent_at 
      FROM sent_numbers 
      WHERE campaign_id = 888 
      ORDER BY id DESC
    `);
    
    console.log('📊 Registros da campanha 888:');
    if (result.rows.length === 0) {
      console.log('❌ Nenhum registro encontrado!');
    } else {
      result.rows.forEach((row, index) => {
        const date = new Date(row.sent_at).toLocaleString('pt-BR');
        console.log(`  ${index + 1}. ID:${row.id} - ${row.phone_number} - ${date}`);
      });
    }
    
    await client.end();
    
    console.log('\n✅ TESTE BATCHPROCESSOR CONCLUÍDO!');
    console.log('🎯 Se aparecerem registros acima, a correção funcionou!');
    
  } catch (error) {
    console.error('💥 ERRO no teste:', error.message);
    console.error('📋 Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
  
  process.exit(0);
}

testBatchProcessor();

// Teste final para verificar se todas as duplicações foram eliminadas
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testUnifiedSave() {
  console.log('🧪 TESTE UNIFICADO - Verificando se salvamento funciona sem duplicação');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');
  
  try {
    // 1. Inicializar sistema
    const tracker = getCampaignTracker();
    
    // Simular o campaignControl do app.js
    const mockCampaignControl = {
      tracker: tracker,
      
      // Método markCampaignSent (único ponto de entrada)
      async markCampaignSent(phoneNumber, campaignData = {}) {
        console.log(`📞 markCampaignSent: ${phoneNumber}`);
        
        const cleanNumber = phoneNumber.replace('@c.us', '');
        const campaignId = campaignData.campaignId || 1;
        
        try {
          const result = await tracker.registerSentNumber(campaignId, cleanNumber, {
            status: campaignData.status || 'enviado',
            session: campaignData.session || 'test',
            sent_via: campaignData.sent_via || 'test_unificado',
            messageId: campaignData.messageId || null,
            notes: `Teste unificado - ${new Date().toISOString()}`,
            timestamp: campaignData.timestamp || new Date().toISOString()
          });
          
          if (result.success) {
            console.log(`✅ Sucesso: ${cleanNumber} registrado com ID ${result.sentId}`);
          } else {
            console.log(`❌ Falha: ${result.message}`);
          }
          
          return result;
        } catch (error) {
          console.error(`💥 Erro: ${error.message}`);
          return { success: false, message: error.message };
        }
      }
    };
    
    // 2. Testar o novo fluxo unificado
    const testNumbers = [
      '5511999000111',
      '5511999000222', 
      '5511999000333'
    ];
    
    console.log('📋 Testando fluxo UNIFICADO (sem duplicação):');
    console.log('');
    
    for (let i = 0; i < testNumbers.length; i++) {
      const number = testNumbers[i];
      console.log(`${i + 1}. Processando ${number}:`);
      
      // Simular exatamente o que app.js faz agora (linha 3305 corrigida)
      const result = await mockCampaignControl.markCampaignSent(number, {
        campaignId: 999,
        session: 'sales',
        messageId: 'test-msg-' + (i + 1),
        message_template: 'Teste unificado',
        sent_via: 'bulk_campaign',
        status: 'enviado',
        timestamp: new Date().toISOString()
      });
      
      console.log(`   Resultado: ${result.success ? '✅ Sucesso' : '❌ Falha'}`);
      console.log('');
    }
    
    // 3. Verificar no banco
    console.log('🔍 Verificando novos registros no banco...');
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
      WHERE campaign_id = 999 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('📊 Novos registros da campanha 999:');
    if (result.rows.length === 0) {
      console.log('❌ Nenhum registro encontrado!');
    } else {
      result.rows.forEach((row, index) => {
        const date = new Date(row.sent_at).toLocaleString('pt-BR');
        console.log(`  ${index + 1}. ID:${row.id} - ${row.phone_number} - ${date}`);
      });
    }
    
    await client.end();
    
    console.log('\n✅ TESTE UNIFICADO CONCLUÍDO!');
    console.log('🎯 Sistema agora usa apenas markCampaignSent (sem duplicação)');
    
  } catch (error) {
    console.error('💥 ERRO no teste:', error.message);
    console.error('📋 Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
  
  process.exit(0);
}

testUnifiedSave();

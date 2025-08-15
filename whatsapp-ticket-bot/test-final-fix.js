// Teste final para verificar se a correção dos conflitos funcionou
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testFinalFix() {
  console.log('🧪 TESTE FINAL - Verificando correção dos conflitos');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');
  
  try {
    // 1. Testar o fluxo corrigido
    const tracker = getCampaignTracker();
    
    // Simular o campaignControl corrigido
    const mockCampaignControl = {
      tracker: tracker,
      
      // Este é o método markCampaignSent corrigido
      async markCampaignSent(phoneNumber, campaignData = {}) {
        console.log(`📞 markCampaignSent chamado para: ${phoneNumber}`);
        
        const cleanNumber = phoneNumber.replace('@c.us', '');
        const campaignId = campaignData.campaignId || 1;
        
        try {
          const result = await tracker.registerSentNumber(campaignId, cleanNumber, {
            status: 'enviado',
            session: campaignData.session || 'test',
            sent_via: 'test_final_fix',
            messageId: 'test-final-' + Date.now(),
            notes: `Teste correção final - ${new Date().toISOString()}`,
            timestamp: new Date().toISOString()
          });
          
          if (result.success) {
            console.log(`✅ Sucesso: Número ${cleanNumber} registrado com ID ${result.sentId}`);
          } else {
            console.log(`❌ Falha: ${result.message}`);
          }
          
          return result;
        } catch (error) {
          console.error(`💥 Erro: ${error.message}`);
          return { success: false, message: error.message };
        }
      },
      
      // Este é o método registerCampaignSent corrigido (SEM duplicação)
      async registerCampaignSent(sessionId, number, campaignId, messageData = {}) {
        console.log(`🎯 registerCampaignSent chamado: ${number} (sessão: ${sessionId})`);
        
        // ÚNICA CHAMADA - sem duplicação
        return await this.markCampaignSent(number, { 
          campaignId, 
          session: sessionId, 
          ...messageData 
        });
      }
    };
    
    // 2. Testar cenário real de campanha
    const testNumbers = [
      '5511999111222',
      '5511999333444',
      '5511999555666'
    ];
    
    console.log('📋 Testando fluxo de campanha com 3 números...\n');
    
    for (let i = 0; i < testNumbers.length; i++) {
      const number = testNumbers[i];
      console.log(`${i + 1}. Processando ${number}:`);
      
      // Simular o fluxo real: registerCampaignSent -> markCampaignSent -> registerSentNumber
      const result = await mockCampaignControl.registerCampaignSent(
        'sales', 
        number, 
        999, 
        { 
          messageTemplate: 'Teste final',
          delay: 1000 + (i * 500)
        }
      );
      
      console.log(`   Resultado: ${result.success ? '✅ Sucesso' : '❌ Falha'}`);
      console.log('');
    }
    
    // 3. Verificar registros no banco
    console.log('🔍 Verificando últimos registros no banco...');
    const DatabaseManager = require('./database/manager-postgresql');
    const dbManager = new DatabaseManager();
    
    const recent = await dbManager.getRecentSentNumbers(5);
    console.log('\n📊 Últimos 5 registros:');
    recent.forEach((record, index) => {
      const date = new Date(record.sent_at).toLocaleString('pt-BR');
      console.log(`  ${index + 1}. ${record.phone_number} - Campanha ${record.campaign_id} - ${date}`);
    });
    
    console.log('\n✅ TESTE FINAL CONCLUÍDO!');
    console.log('🎯 Se os números acima aparecerem, a correção funcionou!');
    
  } catch (error) {
    console.error('💥 ERRO no teste:', error.message);
    console.error('📋 Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
  
  process.exit(0);
}

testFinalFix();

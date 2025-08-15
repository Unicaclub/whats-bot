// Script para limpar campanhas de teste e organizar campanhas reais
const { getCampaignTracker } = require('./modules/campaignTracker');

async function cleanupTestCampaigns() {
  try {
    console.log('🧹 LIMPEZA DE CAMPANHAS DE TESTE');
    console.log('===============================');
    
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Identificar campanhas de teste
    console.log('\n1. 🔍 Identificando campanhas de teste...');
    const allCampaigns = await db.query(`
      SELECT 
        id, 
        campaign_name, 
        status, 
        total_sent, 
        metadata,
        created_at
      FROM campaigns 
      ORDER BY id
    `);
    
    console.log(`📋 Total de campanhas encontradas: ${allCampaigns.length}`);
    
    const testCampaigns = [];
    const realCampaigns = [];
    
    for (const campaign of allCampaigns) {
      const isTest = 
        campaign.metadata?.created_for_test === true ||
        campaign.metadata?.persistence_type === 'batch_campaign' ||
        campaign.campaign_name.includes('Teste') ||
        campaign.campaign_name.includes('Validação') ||
        campaign.campaign_name.includes('teste');
      
      // Verificar se tem números reais enviados
      const realSentNumbers = await db.query(`
        SELECT COUNT(*) as count FROM sent_numbers WHERE campaign_id = $1
      `, [campaign.id]);
      
      const hasRealSentNumbers = realSentNumbers[0]?.count > 0;
      
      if (isTest || (!hasRealSentNumbers && campaign.total_sent > 0)) {
        testCampaigns.push({
          ...campaign,
          hasRealSentNumbers,
          reason: isTest ? 'Marcada como teste' : 'Sem registros reais em sent_numbers'
        });
      } else {
        realCampaigns.push({
          ...campaign,
          hasRealSentNumbers
        });
      }
    }
    
    console.log(`\n📊 RESULTADOS DA ANÁLISE:`);
    console.log(`   🧪 Campanhas de teste identificadas: ${testCampaigns.length}`);
    console.log(`   ✅ Campanhas reais identificadas: ${realCampaigns.length}`);
    
    // 2. Mostrar campanhas de teste
    console.log('\n2. 🧪 CAMPANHAS DE TESTE IDENTIFICADAS:');
    console.log('=====================================');
    
    if (testCampaigns.length > 0) {
      testCampaigns.forEach(campaign => {
        console.log(`📋 ID: ${campaign.id} | Nome: "${campaign.campaign_name}"`);
        console.log(`   📊 Status: ${campaign.status}`);
        console.log(`   📊 Total relatado: ${campaign.total_sent}`);
        console.log(`   📊 Números reais: ${campaign.hasRealSentNumbers ? 'SIM' : 'NÃO'}`);
        console.log(`   🔍 Motivo: ${campaign.reason}`);
        console.log('');
      });
    } else {
      console.log('✅ Nenhuma campanha de teste encontrada');
    }
    
    // 3. Mostrar campanhas reais
    console.log('\n3. ✅ CAMPANHAS REAIS IDENTIFICADAS:');
    console.log('===================================');
    
    if (realCampaigns.length > 0) {
      for (const campaign of realCampaigns) {
        console.log(`📋 ID: ${campaign.id} | Nome: "${campaign.campaign_name}"`);
        console.log(`   📊 Status: ${campaign.status}`);
        console.log(`   📊 Total relatado: ${campaign.total_sent}`);
        console.log(`   📊 Números reais: ${campaign.hasRealSentNumbers ? 'SIM' : 'NÃO'}`);
        
        // Verificar números pendentes se tem metadados
        if (campaign.metadata?.numbers) {
          const sentNumbers = await db.query(`
            SELECT DISTINCT phone_number FROM sent_numbers WHERE campaign_id = $1
          `, [campaign.id]);
          
          const pendingCount = campaign.metadata.numbers.length - sentNumbers.length;
          console.log(`   📱 Números originais: ${campaign.metadata.numbers.length}`);
          console.log(`   ✅ Números enviados: ${sentNumbers.length}`);
          console.log(`   ⏳ Números pendentes: ${pendingCount}`);
          
          if (pendingCount > 0 && (campaign.status === 'pausada' || campaign.status === 'ativa')) {
            console.log(`   🚀 PODE SER RETOMADA!`);
          }
        }
        console.log('');
      }
    } else {
      console.log('⚠️ Nenhuma campanha real encontrada');
    }
    
    // 4. Propor ações de limpeza
    console.log('\n4. 🧹 AÇÕES DE LIMPEZA PROPOSTAS:');
    console.log('=================================');
    
    if (testCampaigns.length > 0) {
      console.log(`🧪 Campanhas de teste para marcar como 'rascunho':`);
      testCampaigns.forEach(campaign => {
        if (campaign.status !== 'rascunho') {
          console.log(`   📋 Campanha ${campaign.id}: "${campaign.campaign_name}" (${campaign.status} → rascunho)`);
        }
      });
      
      // Perguntar se quer executar limpeza
      console.log(`\n❓ Deseja marcar ${testCampaigns.filter(c => c.status !== 'rascunho').length} campanhas de teste como 'rascunho'?`);
      console.log('   ✅ Isso evitará que sejam detectadas para recovery automático');
      console.log('   ⚠️ As campanhas não serão deletadas, apenas marcadas como rascunho');
      
      // Executar limpeza automática (em produção, poderia pedir confirmação)
      console.log('\n🔄 Executando limpeza automática...');
      
      let cleaned = 0;
      for (const campaign of testCampaigns) {
        if (campaign.status !== 'rascunho') {
          await db.query(`
            UPDATE campaigns 
            SET status = 'rascunho', updated_at = NOW() 
            WHERE id = $1
          `, [campaign.id]);
          
          console.log(`✅ Campanha ${campaign.id} marcada como rascunho`);
          cleaned++;
        }
      }
      
      console.log(`\n✅ Limpeza concluída: ${cleaned} campanhas marcadas como rascunho`);
    } else {
      console.log('✅ Nenhuma ação de limpeza necessária');
    }
    
    // 5. Relatório final
    console.log('\n5. 📊 RELATÓRIO FINAL PARA AUTO-RECOVERY:');
    console.log('========================================');
    
    const resumableCampaigns = realCampaigns.filter(campaign => 
      (campaign.status === 'pausada' || campaign.status === 'ativa') &&
      campaign.metadata?.numbers &&
      campaign.hasRealSentNumbers
    );
    
    console.log(`🚀 Campanhas disponíveis para recovery automático: ${resumableCampaigns.length}`);
    
    if (resumableCampaigns.length > 0) {
      console.log('\n📋 Campanhas que podem ser retomadas:');
      for (const campaign of resumableCampaigns) {
        const sentNumbers = await db.query(`
          SELECT DISTINCT phone_number FROM sent_numbers WHERE campaign_id = $1
        `, [campaign.id]);
        
        const pendingCount = campaign.metadata.numbers.length - sentNumbers.length;
        
        console.log(`   🎯 Campanha ${campaign.id}: "${campaign.campaign_name}"`);
        console.log(`      📊 Status: ${campaign.status}`);
        console.log(`      📱 Números pendentes: ${pendingCount}`);
        console.log(`      💬 Mensagem: ${campaign.message_template?.substring(0, 100)}...`);
      }
      
      console.log('\n🔄 Para ativar recovery automático:');
      console.log('   1. Reinicie a aplicação: node app.js');
      console.log('   2. Conecte uma sessão do WhatsApp');
      console.log('   3. O sistema detectará automaticamente essas campanhas');
    } else {
      console.log('ℹ️ Nenhuma campanha real disponível para recovery automático');
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar limpeza
cleanupTestCampaigns();

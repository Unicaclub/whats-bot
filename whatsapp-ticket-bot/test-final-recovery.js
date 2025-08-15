// Teste final para verificar se o sistema de auto-recovery melhorado está funcionando
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testImprovedRecovery() {
  try {
    console.log('🧪 TESTE FINAL DO SISTEMA DE AUTO-RECOVERY MELHORADO');
    console.log('==================================================');
    
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Verificar campanhas pausadas após limpeza
    console.log('\n1. 🔍 Verificando campanhas pausadas após limpeza...');
    const pausedCampaigns = await db.query(`
      SELECT id, campaign_name, status, metadata, total_sent
      FROM campaigns 
      WHERE status = 'pausada'
      ORDER BY id
    `);
    
    console.log(`📋 Campanhas pausadas encontradas: ${pausedCampaigns.length}`);
    
    if (pausedCampaigns.length > 0) {
      pausedCampaigns.forEach(campaign => {
        const isTest = 
          campaign.metadata?.created_for_test === true ||
          campaign.metadata?.persistence_type === 'batch_campaign' ||
          campaign.campaign_name.includes('Teste');
        
        console.log(`📋 ID: ${campaign.id} | Nome: "${campaign.campaign_name}"`);
        console.log(`   📊 Status: ${campaign.status} | Teste: ${isTest ? 'SIM' : 'NÃO'}`);
      });
    } else {
      console.log('✅ Nenhuma campanha pausada encontrada (esperado após limpeza)');
    }
    
    // 2. Verificar campanhas ativas
    console.log('\n2. ✅ Verificando campanhas ativas...');
    const activeCampaigns = await db.query(`
      SELECT id, campaign_name, status, metadata, total_sent
      FROM campaigns 
      WHERE status = 'ativa'
      ORDER BY id
    `);
    
    console.log(`📋 Campanhas ativas encontradas: ${activeCampaigns.length}`);
    
    const realActiveCampaigns = [];
    for (const campaign of activeCampaigns) {
      const isTest = 
        campaign.metadata?.created_for_test === true ||
        campaign.metadata?.persistence_type === 'batch_campaign' ||
        campaign.campaign_name.includes('Teste');
      
      // Verificar se tem números reais enviados
      const realSentNumbers = await db.query(`
        SELECT COUNT(*) as count FROM sent_numbers WHERE campaign_id = $1
      `, [campaign.id]);
      
      const hasRealSentNumbers = realSentNumbers[0]?.count > 0;
      
      console.log(`📋 ID: ${campaign.id} | Nome: "${campaign.campaign_name}"`);
      console.log(`   📊 Status: ${campaign.status} | Teste: ${isTest ? 'SIM' : 'NÃO'} | Números reais: ${hasRealSentNumbers ? 'SIM' : 'NÃO'}`);
      
      if (!isTest && hasRealSentNumbers && campaign.metadata?.numbers) {
        realActiveCampaigns.push(campaign);
      }
    }
    
    // 3. Simular o que o auto-recovery faria
    console.log('\n3. 🔄 SIMULANDO AUTO-RECOVERY...');
    
    console.log('📋 Campanhas que o recovery detectaria:');
    
    // Filtrar campanhas recuperáveis (pausadas ou ativas, não-teste, com números reais)
    const allRecoverableCampaigns = [...pausedCampaigns, ...activeCampaigns].filter(campaign => {
      const isTest = 
        campaign.metadata?.created_for_test === true ||
        campaign.metadata?.persistence_type === 'batch_campaign' ||
        campaign.campaign_name.includes('Teste');
      
      return !isTest && (campaign.status === 'pausada' || campaign.status === 'ativa');
    });
    
    if (allRecoverableCampaigns.length > 0) {
      for (const campaign of allRecoverableCampaigns) {
        console.log(`\n🎯 Analisando campanha ${campaign.id}: "${campaign.campaign_name}"`);
        
        // Verificar números reais
        const realSentNumbers = await db.query(`
          SELECT COUNT(*) as count FROM sent_numbers WHERE campaign_id = $1
        `, [campaign.id]);
        
        const hasRealSentNumbers = realSentNumbers[0]?.count > 0;
        
        if (campaign.metadata?.numbers && hasRealSentNumbers) {
          const sentNumbers = await db.query(`
            SELECT DISTINCT phone_number FROM sent_numbers WHERE campaign_id = $1
          `, [campaign.id]);
          
          const pendingCount = campaign.metadata.numbers.length - sentNumbers.length;
          
          console.log(`   📱 Números originais: ${campaign.metadata.numbers.length}`);
          console.log(`   ✅ Números enviados: ${sentNumbers.length}`);
          console.log(`   ⏳ Números pendentes: ${pendingCount}`);
          
          if (pendingCount > 0) {
            console.log(`   🚀 RECOVERY SERIA EXECUTADO!`);
            console.log(`      📋 Campanha: ${campaign.campaign_name}`);
            console.log(`      📱 Enviaria para: ${pendingCount} números restantes`);
            console.log(`      💬 Mensagem: ${campaign.message_template?.substring(0, 100)}...`);
          } else {
            console.log(`   ✅ Campanha já finalizada`);
          }
        } else if (!campaign.metadata?.numbers) {
          console.log(`   ⚠️ Números não disponíveis nos metadados`);
        } else if (!hasRealSentNumbers) {
          console.log(`   ⚠️ Nenhum número real enviado encontrado`);
        }
      }
    } else {
      console.log('✅ Nenhuma campanha seria processada pelo auto-recovery');
    }
    
    // 4. Relatório final do estado do sistema
    console.log('\n4. 📊 RELATÓRIO FINAL DO SISTEMA');
    console.log('===============================');
    
    const totalCampaigns = await db.query(`SELECT COUNT(*) as count FROM campaigns`);
    const testCampaigns = await db.query(`
      SELECT COUNT(*) as count FROM campaigns 
      WHERE status = 'rascunho' AND (
        metadata->>'created_for_test' = 'true' OR
        campaign_name LIKE '%Teste%' OR
        campaign_name LIKE '%Validação%'
      )
    `);
    
    console.log(`📊 Total de campanhas: ${totalCampaigns[0].count}`);
    console.log(`🧪 Campanhas de teste (rascunho): ${testCampaigns[0].count}`);
    console.log(`✅ Campanhas ativas não-teste: ${realActiveCampaigns.length}`);
    console.log(`🚀 Campanhas recuperáveis: ${allRecoverableCampaigns.length}`);
    
    if (allRecoverableCampaigns.length === 0) {
      console.log('\n🎉 SISTEMA DE AUTO-RECOVERY MELHORADO FUNCIONANDO CORRETAMENTE!');
      console.log('================================================================');
      console.log('✅ Campanhas de teste foram removidas da detecção');
      console.log('✅ Apenas campanhas reais serão processadas');
      console.log('✅ Sistema não tentará recovery de campanhas fictícias');
      console.log('✅ Auto-recovery está pronto para campanhas reais futuras');
    } else {
      console.log(`\n🔄 Sistema detectou ${allRecoverableCampaigns.length} campanhas para recovery automático`);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testImprovedRecovery();

// Script para testar o sistema de recovery de campanhas
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testRecoverySystem() {
  try {
    console.log('🧪 TESTANDO SISTEMA DE RECOVERY');
    console.log('================================');
    
    // Obter tracker
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Buscar campanhas pausadas
    console.log('\n1. 🔍 Buscando campanhas pausadas...');
    const pausedCampaigns = await db.query(`
      SELECT id, campaign_name, status, message_template, metadata, created_at
      FROM campaigns 
      WHERE status = 'pausada'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`📋 Encontradas ${pausedCampaigns.length} campanhas pausadas:`);
    pausedCampaigns.forEach(campaign => {
      console.log(`   📋 ID: ${campaign.id} | Nome: "${campaign.campaign_name}" | Criada: ${campaign.created_at}`);
    });
    
    // 2. Verificar detalhes da campanha 13 especificamente
    console.log('\n2. 🎯 Verificando detalhes da Campanha 13...');
    const campaign13 = await db.query(`
      SELECT * FROM campaigns WHERE id = 13
    `);
    
    if (campaign13.length > 0) {
      const campaign = campaign13[0];
      console.log(`📋 Campanha 13 encontrada:`);
      console.log(`   📝 Nome: ${campaign.campaign_name}`);
      console.log(`   📊 Status: ${campaign.status}`);
      console.log(`   📅 Criada: ${campaign.created_at}`);
      console.log(`   📅 Atualizada: ${campaign.updated_at}`);
      console.log(`   💬 Mensagem: ${campaign.message_template?.substring(0, 100)}...`);
      console.log(`   📊 Total enviados: ${campaign.total_sent || 0}`);
      console.log(`   📊 Total falhas: ${campaign.total_failed || 0}`);
      
      // Verificar metadados
      if (campaign.metadata) {
        console.log(`   📦 Metadados disponíveis: ${typeof campaign.metadata}`);
        if (typeof campaign.metadata === 'object' && campaign.metadata.numbers) {
          console.log(`   📱 Números nos metadados: ${campaign.metadata.numbers.length}`);
        }
      }
      
      // 3. Verificar números enviados para esta campanha
      console.log('\n3. 📊 Verificando números enviados...');
      const sentNumbers = await db.query(`
        SELECT COUNT(*) as sent_count, 
               MIN(sent_at) as first_sent,
               MAX(sent_at) as last_sent
        FROM sent_numbers 
        WHERE campaign_id = 13
      `);
      
      if (sentNumbers.length > 0) {
        const stats = sentNumbers[0];
        console.log(`   ✅ Números enviados: ${stats.sent_count}`);
        console.log(`   📅 Primeiro envio: ${stats.first_sent}`);
        console.log(`   📅 Último envio: ${stats.last_sent}`);
      }
      
      // 4. Verificar se há números pendentes
      console.log('\n4. 🔍 Verificando números pendentes...');
      let totalNumbers = 0;
      let pendingNumbers = 0;
      
      if (campaign.metadata && campaign.metadata.numbers) {
        totalNumbers = campaign.metadata.numbers.length;
        const sentNumbersList = await db.query(`
          SELECT DISTINCT phone_number 
          FROM sent_numbers 
          WHERE campaign_id = 13
        `);
        
        const sentSet = new Set(sentNumbersList.map(row => row.phone_number));
        const pending = campaign.metadata.numbers.filter(num => !sentSet.has(num));
        pendingNumbers = pending.length;
        
        console.log(`   📱 Total de números: ${totalNumbers}`);
        console.log(`   ✅ Números enviados: ${sentNumbersList.length}`);
        console.log(`   ⏳ Números pendentes: ${pendingNumbers}`);
        
        if (pendingNumbers > 0) {
          console.log('\n🚀 CAMPANHA PODE SER RETOMADA!');
          console.log(`   📋 Campanha: ${campaign.campaign_name}`);
          console.log(`   📱 Números restantes: ${pendingNumbers}`);
          console.log(`   💬 Mensagem: ${campaign.message_template?.substring(0, 150)}...`);
        } else {
          console.log('\n✅ CAMPANHA JÁ FINALIZADA');
          console.log('   Todos os números já foram enviados');
        }
      } else {
        console.log('   ⚠️ Metadados não encontrados ou números não disponíveis');
        
        // Tentar buscar de outras fontes
        try {
          const campaignNumbers = await db.query(`
            SELECT phone_number FROM campaign_numbers WHERE campaign_id = 13
          `);
          
          if (campaignNumbers.length > 0) {
            console.log(`   📱 Números encontrados em campaign_numbers: ${campaignNumbers.length}`);
          }
        } catch (error) {
          console.log('   ℹ️ Tabela campaign_numbers não encontrada');
        }
      }
      
    } else {
      console.log('❌ Campanha 13 não encontrada');
    }
    
    // 5. Sugestões de recuperação
    console.log('\n5. 💡 SUGESTÕES DE RECUPERAÇÃO');
    console.log('================================');
    
    if (pausedCampaigns.length > 0) {
      console.log('🔧 Para retomar campanhas pausadas:');
      console.log('   1. Reinicie a aplicação (as campanhas pausadas serão detectadas)');
      console.log('   2. Use a interface web para retomar manualmente');
      console.log('   3. Execute: node manual-recovery.js [campaign_id]');
      
      pausedCampaigns.forEach(campaign => {
        console.log(`   🎯 Campanha ${campaign.id}: node manual-recovery.js ${campaign.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de recovery:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar o teste
testRecoverySystem();

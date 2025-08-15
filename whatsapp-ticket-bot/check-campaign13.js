// Script para verificar estrutura exata das tabelas e encontrar números da campanha 13
const { getCampaignTracker } = require('./modules/campaignTracker');

async function checkTablesAndCampaign() {
  try {
    console.log('🔍 VERIFICANDO ESTRUTURA EXATA DO BANCO');
    console.log('=====================================');
    
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Estrutura da tabela sent_numbers
    console.log('\n1. 🏗️ Estrutura da tabela sent_numbers...');
    const sentNumbersColumns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sent_numbers'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela sent_numbers:');
    sentNumbersColumns.forEach(col => {
      console.log(`   📄 ${col.column_name} | ${col.data_type} | NULL: ${col.is_nullable}`);
    });
    
    // 2. Verificar números enviados para campanha 13
    console.log('\n2. ✅ Verificando números enviados da campanha 13...');
    const sentNumbers = await db.query(`
      SELECT phone_number, status, sent_at
      FROM sent_numbers 
      WHERE campaign_id = 13
      ORDER BY sent_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Total de registros encontrados: ${sentNumbers.length}`);
    if (sentNumbers.length > 0) {
      console.log('📱 Últimos números enviados:');
      sentNumbers.forEach(sent => {
        console.log(`   📱 ${sent.phone_number} | ${sent.status} | ${sent.sent_at}`);
      });
    } else {
      console.log('⚠️ Nenhum número enviado encontrado para campanha 13');
    }
    
    // 3. Metadados da campanha 13 (análise detalhada)
    console.log('\n3. 📦 ANÁLISE DETALHADA DOS METADADOS DA CAMPANHA 13');
    const campaign13 = await db.query(`
      SELECT * FROM campaigns WHERE id = 13
    `);
    
    if (campaign13.length > 0) {
      const campaign = campaign13[0];
      console.log(`📋 Campanha: ${campaign.campaign_name}`);
      console.log(`📊 Status: ${campaign.status}`);
      console.log(`📊 Total enviados (banco): ${campaign.total_sent}`);
      console.log(`📊 Total falhas (banco): ${campaign.total_failed}`);
      console.log(`📅 Criada: ${campaign.created_at}`);
      console.log(`📅 Atualizada: ${campaign.updated_at}`);
      
      if (campaign.metadata) {
        console.log('\n📦 Metadados completos:');
        Object.entries(campaign.metadata).forEach(([key, value]) => {
          console.log(`   📄 ${key}: ${value}`);
        });
        
        // Análise específica dos metadados
        const meta = campaign.metadata;
        if (meta.total_numbers && meta.processed_numbers) {
          const remaining = meta.total_numbers - meta.processed_numbers;
          console.log(`\n📊 ANÁLISE DE PROGRESSO:`);
          console.log(`   📱 Total de números: ${meta.total_numbers}`);
          console.log(`   ✅ Processados: ${meta.processed_numbers}`);
          console.log(`   ⏳ Restantes estimados: ${remaining}`);
          console.log(`   📦 Lote atual: ${meta.current_batch}/${meta.total_batches}`);
          console.log(`   📏 Tamanho do lote: ${meta.batch_size}`);
          
          if (meta.interrupted_at) {
            const interruptedAt = new Date(meta.interrupted_at);
            const now = new Date();
            const hoursAgo = (now - interruptedAt) / (1000 * 60 * 60);
            console.log(`   ⏸️ Interrompida há: ${hoursAgo.toFixed(1)} horas`);
            console.log(`   📝 Motivo: ${meta.interruption_reason || 'Não especificado'}`);
          }
        }
      }
    }
    
    // 4. Verificar se há números reais na base (independente da campanha)
    console.log('\n4. 📱 Verificando números reais na base...');
    const totalSentNumbers = await db.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(DISTINCT phone_number) as numeros_unicos,
        COUNT(DISTINCT campaign_id) as campanhas_com_envios
      FROM sent_numbers
    `);
    
    if (totalSentNumbers.length > 0) {
      const stats = totalSentNumbers[0];
      console.log(`📊 Estatísticas gerais:`);
      console.log(`   📊 Total de registros: ${stats.total_registros}`);
      console.log(`   📱 Números únicos: ${stats.numeros_unicos}`);
      console.log(`   📋 Campanhas com envios: ${stats.campanhas_com_envios}`);
    }
    
    // 5. Verificar campanhas com números reais enviados
    console.log('\n5. 📋 Campanhas com números realmente enviados...');
    const campaignsWithSent = await db.query(`
      SELECT 
        c.id,
        c.campaign_name,
        c.status,
        COUNT(sn.phone_number) as numeros_enviados
      FROM campaigns c
      LEFT JOIN sent_numbers sn ON c.id = sn.campaign_id
      GROUP BY c.id, c.campaign_name, c.status
      HAVING COUNT(sn.phone_number) > 0
      ORDER BY COUNT(sn.phone_number) DESC
    `);
    
    console.log(`📋 Campanhas com envios reais:`);
    campaignsWithSent.forEach(camp => {
      console.log(`   📋 Campanha ${camp.id}: "${camp.campaign_name}" (${camp.status}) - ${camp.numeros_enviados} envios`);
    });
    
    // 6. DIAGNÓSTICO FINAL
    console.log('\n6. 🩺 DIAGNÓSTICO FINAL DA CAMPANHA 13');
    console.log('=====================================');
    
    if (campaign13.length > 0) {
      const campaign = campaign13[0];
      const sentCount = sentNumbers.length;
      const metadataNumbers = campaign.metadata?.total_numbers || 0;
      const processedNumbers = campaign.metadata?.processed_numbers || 0;
      
      console.log(`📊 SITUAÇÃO ATUAL:`);
      console.log(`   📝 Nome: ${campaign.campaign_name}`);
      console.log(`   📊 Status: ${campaign.status}`);
      console.log(`   📊 Total relatado no banco: ${campaign.total_sent}`);
      console.log(`   📊 Registros reais em sent_numbers: ${sentCount}`);
      console.log(`   📊 Total original (metadados): ${metadataNumbers}`);
      console.log(`   📊 Processados (metadados): ${processedNumbers}`);
      
      if (sentCount === 0 && campaign.total_sent > 0) {
        console.log(`\n⚠️ INCONSISTÊNCIA DETECTADA:`);
        console.log(`   ❌ Banco relata ${campaign.total_sent} enviados`);
        console.log(`   ❌ Mas sent_numbers tem 0 registros para campanha 13`);
        console.log(`   🔍 Possíveis causas:`);
        console.log(`      - Números foram gravados com campaign_id diferente`);
        console.log(`      - Houve problema na gravação no banco`);
        console.log(`      - Sistema relatou envios fictícios`);
        
        console.log(`\n🔧 RECOMENDAÇÕES:`);
        console.log(`   1. Verificar se há números com campaign_id NULL ou diferente`);
        console.log(`   2. A campanha precisa ser recriada com números reais`);
        console.log(`   3. Os metadados indicam que havia 1000 números originalmente`);
        console.log(`   4. Recovery automático não é possível sem números reais`);
      } else if (sentCount > 0) {
        console.log(`\n✅ RECOVERY POSSÍVEL:`);
        console.log(`   📱 Há ${sentCount} números reais na base`);
        console.log(`   🔄 Sistema pode calcular pendentes baseado nos metadados`);
      } else {
        console.log(`\n❌ RECOVERY NÃO POSSÍVEL:`);
        console.log(`   📱 Nenhum número real encontrado`);
        console.log(`   📊 Dados inconsistentes no banco`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar verificação
checkTablesAndCampaign();

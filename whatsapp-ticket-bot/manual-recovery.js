// Script para recovery manual de campanhas específicas
const { getCampaignTracker } = require('./modules/campaignTracker');
const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');

async function manualRecovery(campaignId) {
  try {
    console.log(`🚀 RECOVERY MANUAL DA CAMPANHA ${campaignId}`);
    console.log('=========================================');
    
    // Obter tracker
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Buscar informações da campanha
    console.log(`\n1. 🔍 Buscando informações da campanha ${campaignId}...`);
    const campaignResult = await db.query(`
      SELECT * FROM campaigns WHERE id = $1
    `, [campaignId]);
    
    if (campaignResult.length === 0) {
      console.error(`❌ Campanha ${campaignId} não encontrada`);
      return;
    }
    
    const campaign = campaignResult[0];
    console.log(`📋 Campanha encontrada: "${campaign.campaign_name}"`);
    console.log(`📊 Status atual: ${campaign.status}`);
    console.log(`💬 Mensagem: ${campaign.message_template?.substring(0, 100)}...`);
    
    // 2. Verificar se há números para processar
    console.log(`\n2. 📱 Verificando números da campanha...`);
    let campaignNumbers = [];
    
    // Tentar obter números dos metadados
    if (campaign.metadata && campaign.metadata.numbers) {
      campaignNumbers = campaign.metadata.numbers;
      console.log(`📱 Números encontrados nos metadados: ${campaignNumbers.length}`);
    } else {
      // Tentar buscar de campaign_numbers
      try {
        const numbersResult = await db.query(`
          SELECT phone_number FROM campaign_numbers WHERE campaign_id = $1
        `, [campaignId]);
        
        campaignNumbers = numbersResult.map(row => row.phone_number);
        console.log(`📱 Números encontrados em campaign_numbers: ${campaignNumbers.length}`);
      } catch (error) {
        console.log('ℹ️ Tabela campaign_numbers não encontrada');
      }
    }
    
    if (campaignNumbers.length === 0) {
      console.error('❌ Nenhum número encontrado para esta campanha');
      return;
    }
    
    // 3. Verificar números já enviados
    console.log(`\n3. ✅ Verificando números já enviados...`);
    const sentNumbers = await db.query(`
      SELECT DISTINCT phone_number FROM sent_numbers WHERE campaign_id = $1
    `, [campaignId]);
    
    const sentSet = new Set(sentNumbers.map(row => row.phone_number));
    const pendingNumbers = campaignNumbers.filter(num => !sentSet.has(num));
    
    console.log(`📊 Total de números: ${campaignNumbers.length}`);
    console.log(`✅ Já enviados: ${sentNumbers.length}`);
    console.log(`⏳ Pendentes: ${pendingNumbers.length}`);
    
    if (pendingNumbers.length === 0) {
      console.log('✅ Todos os números já foram enviados!');
      
      // Atualizar status para finalizada
      await db.query(`
        UPDATE campaigns SET status = 'finalizada', completed_at = NOW() WHERE id = $1
      `, [campaignId]);
      
      console.log('✅ Campanha marcada como finalizada');
      return;
    }
    
    // 4. Confirmar recovery
    console.log(`\n4. ❓ CONFIRMAÇÃO DE RECOVERY`);
    console.log(`   📋 Campanha: ${campaign.campaign_name}`);
    console.log(`   📱 Números a enviar: ${pendingNumbers.length}`);
    console.log(`   💬 Mensagem: ${campaign.message_template?.substring(0, 150)}...`);
    console.log(`   ⏰ Tempo estimado: ${Math.ceil(pendingNumbers.length / 100)} minutos`);
    
    // Simular confirmação (em produção poderia pedir input do usuário)
    console.log(`\n✅ CONFIRMADO! Iniciando recovery...`);
    
    // 5. Atualizar status da campanha
    console.log(`\n5. 🔄 Atualizando status da campanha...`);
    await db.query(`
      UPDATE campaigns SET status = 'ativa', updated_at = NOW() WHERE id = $1
    `, [campaignId]);
    
    console.log('✅ Campanha reativada');
    
    // 6. Configurar processador
    console.log(`\n6. ⚙️ Configurando processador de lotes...`);
    
    // Simular campaignControl (em produção seria o real)
    const mockCampaignControl = {
      async markCampaignSent(number, data) {
        // Registrar no banco
        try {
          await db.query(`
            INSERT INTO sent_numbers (campaign_id, phone_number, status, session_name, sent_via, sent_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (campaign_id, phone_number) DO NOTHING
          `, [
            campaignId,
            number,
            data.status || 'enviado',
            data.session || 'recovery',
            data.sent_via || 'manual_recovery'
          ]);
          console.log(`💾 Registrado: ${number}`);
        } catch (error) {
          console.error(`❌ Erro ao registrar ${number}:`, error.message);
        }
      },
      
      isInCooldown(number) {
        return false; // Sem cooldown para recovery
      }
    };
    
    const processor = new CampaignBatchProcessor({
      batchSize: 30,        // Lotes menores para recovery
      minInterval: 6000,    // 6s entre mensagens
      maxInterval: 15000,   // 15s entre mensagens
      batchDelayMin: 30000, // 30s entre lotes
      batchDelayMax: 60000, // 60s entre lotes
      campaignControl: mockCampaignControl,
      tracker: tracker
    });
    
    console.log('⚙️ Processador configurado:');
    console.log('   📦 Lotes de 30 números');
    console.log('   ⏰ Delay entre mensagens: 6-15s');
    console.log('   🔄 Delay entre lotes: 30-60s');
    
    // 7. SIMULAR RECOVERY (não enviar realmente, apenas registrar)
    console.log(`\n7. 🚀 INICIANDO RECOVERY SIMULADO...`);
    console.log('   (Para recovery real, conecte um cliente WhatsApp)');
    
    let sent = 0;
    let failed = 0;
    const startTime = Date.now();
    
    // Processar em lotes pequenos para demonstração
    const batchSize = 5;
    for (let i = 0; i < pendingNumbers.length; i += batchSize) {
      const batch = pendingNumbers.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`\n📦 Lote ${batchNumber}: processando ${batch.length} números...`);
      
      for (const number of batch) {
        try {
          // SIMULAR envio (em produção seria client.sendText)
          console.log(`📱 SIMULANDO envio para ${number}`);
          
          // Registrar como enviado
          await mockCampaignControl.markCampaignSent(number, {
            status: 'enviado_simulado',
            session: 'recovery_test',
            sent_via: 'recovery_simulation'
          });
          
          sent++;
          
          // Delay simulado
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Erro ao processar ${number}:`, error.message);
          failed++;
        }
      }
      
      console.log(`✅ Lote ${batchNumber} concluído: ${batch.length} processados`);
      
      // Delay entre lotes (reduzido para demonstração)
      if (i + batchSize < pendingNumbers.length) {
        console.log('⏳ Aguardando 2s antes do próximo lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const duration = Date.now() - startTime;
    
    // 8. Relatório final
    console.log(`\n8. 📊 RELATÓRIO FINAL`);
    console.log('===================');
    console.log(`✅ Números processados: ${sent}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`⏱️ Tempo total: ${Math.round(duration / 1000)}s`);
    console.log(`📈 Taxa de sucesso: ${((sent / pendingNumbers.length) * 100).toFixed(1)}%`);
    
    // Atualizar estatísticas
    await db.query(`
      UPDATE campaigns 
      SET 
        total_sent = COALESCE(total_sent, 0) + $1,
        total_failed = COALESCE(total_failed, 0) + $2,
        updated_at = NOW()
      WHERE id = $3
    `, [sent, failed, campaignId]);
    
    // Marcar como finalizada se todos foram processados
    if (sent >= pendingNumbers.length) {
      await db.query(`
        UPDATE campaigns SET status = 'finalizada', completed_at = NOW() WHERE id = $1
      `, [campaignId]);
      console.log('🏁 Campanha marcada como finalizada!');
    }
    
    console.log('\n✅ RECOVERY SIMULADO CONCLUÍDO!');
    console.log('💡 Para recovery real:');
    console.log('   1. Inicie a aplicação principal (node app.js)');
    console.log('   2. Conecte uma sessão do WhatsApp');
    console.log('   3. O sistema detectará automaticamente campanhas pausadas');
    
  } catch (error) {
    console.error('❌ Erro no recovery manual:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Verificar argumentos
const campaignId = process.argv[2];

if (!campaignId) {
  console.log('📋 USO: node manual-recovery.js [campaign_id]');
  console.log('📋 Exemplo: node manual-recovery.js 13');
  process.exit(1);
}

// Executar recovery
manualRecovery(parseInt(campaignId));

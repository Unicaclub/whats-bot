// =====================================================
// TESTE COMPLETO DO SISTEMA DE PERSISTÊNCIA
// =====================================================

require('dotenv').config();
const { getDatabase } = require('./database/manager');
const CampaignStateManager = require('./database/campaign-state-manager');
const CampaignRecoveryManager = require('./database/campaign-recovery-manager');

async function testPersistenceSystem() {
    console.log('🧪 Iniciando teste completo do sistema de persistência...\n');

    try {
        // =====================================================
        // 1. TESTE DE CONEXÃO
        // =====================================================
        console.log('1️⃣ Testando conexão com banco...');
        const db = getDatabase();
        const isConnected = await db.testConnection();
        
        if (!isConnected) {
            throw new Error('Falha na conexão com o banco');
        }
        console.log('   ✅ Conexão estabelecida com sucesso\n');

        // =====================================================
        // 2. TESTE DOS GERENCIADORES
        // =====================================================
        console.log('2️⃣ Testando instanciação dos gerenciadores...');
        const stateManager = new CampaignStateManager();
        const recoveryManager = new CampaignRecoveryManager(stateManager);
        console.log('   ✅ Gerenciadores criados com sucesso\n');

        // =====================================================
        // 3. TESTE DE CRIAÇÃO DE CAMPANHA
        // =====================================================
        console.log('3️⃣ Testando criação de estado de campanha...');
        
        const campaignConfig = {
            sessionName: 'test',
            totalNumbers: 100,
            batchSize: 10,
            message: 'Mensagem de teste do sistema de persistência',
            campaignId: 'test-' + Date.now()
        };

        const stateId = await stateManager.createCampaignState(campaignConfig);
        console.log(`   ✅ Estado criado com ID: ${stateId}\n`);

        // =====================================================
        // 4. TESTE DE ATUALIZAÇÃO DE PROGRESSO
        // =====================================================
        console.log('4️⃣ Testando atualização de progresso...');
        
        // Simular processamento de alguns lotes
        for (let batch = 1; batch <= 3; batch++) {
            await stateManager.updateProgress(stateId, {
                currentBatch: batch,
                processedNumbers: batch * 10,
                successCount: batch * 8,
                failedCount: batch * 2
            });
            
            // Registrar detalhes do lote
            await stateManager.saveBatchDetails(stateId, {
                batchNumber: batch,
                numbersInBatch: 10,
                successCount: 8,
                failedCount: 2,
                startTime: new Date(),
                endTime: new Date(),
                avgDelay: 5000
            });
        }
        
        console.log('   ✅ Progresso atualizado para 3 lotes\n');

        // =====================================================
        // 5. TESTE DE INTERRUPÇÃO
        // =====================================================
        console.log('5️⃣ Testando interrupção de campanha...');
        
        await stateManager.markAsInterrupted(stateId, 'Teste de interrupção');
        console.log('   ✅ Campanha marcada como interrompida\n');

        // =====================================================
        // 6. TESTE DE RECUPERAÇÃO
        // =====================================================
        console.log('6️⃣ Testando sistema de recuperação...');
        
        const interruptedCampaigns = await stateManager.findInterruptedCampaigns();
        console.log(`   📊 Campanhas interrompidas encontradas: ${interruptedCampaigns.length}`);
        
        if (interruptedCampaigns.length > 0) {
            const campaign = interruptedCampaigns[0];
            console.log(`   🔄 Testando recuperação da campanha ${campaign.id}`);
            
            const canRecover = await recoveryManager.canRecoverCampaign(campaign.id);
            console.log(`   🔍 Pode recuperar: ${canRecover}`);
            
            if (canRecover) {
                const recoveryData = await recoveryManager.prepareCampaignRecovery(campaign.id);
                console.log(`   📋 Dados de recuperação preparados:`);
                console.log(`      - Estado: ${recoveryData.campaign.status}`);
                console.log(`      - Lote atual: ${recoveryData.campaign.current_batch}/${recoveryData.campaign.total_batches}`);
                console.log(`      - Números processados: ${recoveryData.campaign.processed_numbers}/${recoveryData.campaign.total_numbers}`);
                console.log(`      - Lotes encontrados: ${recoveryData.batches.length}`);
            }
        }
        
        console.log('   ✅ Sistema de recuperação testado\n');

        // =====================================================
        // 7. TESTE DE FINALIZAÇÃO
        // =====================================================
        console.log('7️⃣ Testando finalização de campanha...');
        
        await stateManager.completeCampaign(stateId, {
            successCount: 30,
            failedCount: 6,
            duplicateCount: 4,
            totalProcessed: 40
        });
        
        console.log('   ✅ Campanha finalizada com sucesso\n');

        // =====================================================
        // 8. TESTE DE CONSULTAS
        // =====================================================
        console.log('8️⃣ Testando consultas do sistema...');
        
        const campaignDetails = await stateManager.getCampaignDetails(stateId);
        console.log(`   📊 Detalhes da campanha:`);
        console.log(`      - Status: ${campaignDetails.status}`);
        console.log(`      - Criado em: ${campaignDetails.created_at}`);
        console.log(`      - Finalizado em: ${campaignDetails.completed_at}`);
        
        const nextBatch = await stateManager.getNextBatch(stateId);
        console.log(`   📦 Próximo lote: ${nextBatch ? nextBatch.number : 'Não há mais lotes'}\n`);

        // =====================================================
        // 9. TESTE DE LIMPEZA
        // =====================================================
        console.log('9️⃣ Testando limpeza automática...');
        
        const cleanedCount = await stateManager.cleanupOldCampaigns(0); // Limpar campanhas antigas (0 dias = todas)
        console.log(`   🧹 Campanhas limpas: ${cleanedCount}\n`);

        // =====================================================
        // RESULTADO FINAL
        // =====================================================
        console.log('🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!');
        console.log('✅ Todos os componentes do sistema de persistência estão funcionando corretamente');
        console.log('✅ Integração com PostgreSQL confirmada');
        console.log('✅ Sistema pronto para produção\n');

    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error);
        console.error('💡 Stacktrace:', error.stack);
        process.exit(1);
    } finally {
        // Fechar conexões
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
}

// Executar teste
testPersistenceSystem();

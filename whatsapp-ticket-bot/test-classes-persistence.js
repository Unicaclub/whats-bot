// Teste específico das classes de persistência
const CampaignStateManager = require('./database/campaign-state-manager');
const CampaignRecoveryManager = require('./database/campaign-recovery-manager');

async function testPersistenceClasses() {
    console.log('🧪 TESTE DAS CLASSES DE PERSISTÊNCIA\n');
    
    try {
        // Teste do CampaignStateManager
        console.log('1️⃣ Testando CampaignStateManager...');
        const stateManager = new CampaignStateManager();
        
        // Criar uma campanha
        const campaignData = {
            name: 'Teste da Classe StateManager',
            type: 'promocional',
            totalRecipients: 500
        };
        
        const newCampaign = await stateManager.createCampaignState(campaignData);
        console.log(`   ✅ Campanha criada com ID: ${newCampaign.id}`);
        
        // Ativar campanha
        const activatedCampaign = await stateManager.activateCampaign(newCampaign.id);
        console.log(`   ✅ Campanha ativada, status: ${activatedCampaign.status}`);
        
        // Atualizar progresso
        await stateManager.updateProgress(newCampaign.id, 250);
        console.log('   ✅ Progresso atualizado para 250/500');
        
        // Salvar números enviados
        await stateManager.saveSentNumber(newCampaign.id, '5511999999999', {
            message: 'Teste de mensagem',
            status: 'enviada'
        });
        console.log('   ✅ Número enviado salvo');
        
        // Finalizar campanha
        const finalizedCampaign = await stateManager.finalizeCampaign(newCampaign.id);
        console.log(`   ✅ Campanha finalizada, status: ${finalizedCampaign.status}`);
        
        console.log('\n2️⃣ Testando CampaignRecoveryManager...');
        const recoveryManager = new CampaignRecoveryManager();
        
        // Criar uma campanha para recuperação
        const recoveryData = {
            name: 'Teste de Recuperação',
            type: 'informativo',
            totalRecipients: 300
        };
        
        const recoveryCampaign = await stateManager.createCampaignState(recoveryData);
        await stateManager.activateCampaign(recoveryCampaign.id);
        await stateManager.updateProgress(recoveryCampaign.id, 150);
        
        // Marcar como interrompida
        await stateManager.markAsInterrupted(recoveryCampaign.id, 'Teste de interrupção');
        console.log('   ✅ Campanha marcada como interrompida');
        
        // Recuperar campanhas interrompidas
        const interrupted = await recoveryManager.getInterruptedCampaigns();
        console.log(`   🔍 Campanhas interrompidas encontradas: ${interrupted.length}`);
        
        // Recuperar estado da campanha
        const savedState = await recoveryManager.recoverCampaignState(recoveryCampaign.id);
        console.log(`   📊 Estado recuperado: ${savedState.name} - ${savedState.progress_count}/${savedState.total_recipients}`);
        
        // Buscar números já enviados
        const sentNumbers = await recoveryManager.getSentNumbers(recoveryCampaign.id);
        console.log(`   📱 Números enviados recuperados: ${sentNumbers.length}`);
        
        // Limpar dados de teste
        console.log('\n3️⃣ Limpando dados de teste...');
        const { DatabaseManager } = require('./database/manager');
        const db = new DatabaseManager();
        
        await db.query('DELETE FROM sent_numbers WHERE campaign_id IN ($1, $2)', [newCampaign.id, recoveryCampaign.id]);
        await db.query('DELETE FROM campaigns WHERE id IN ($1, $2)', [newCampaign.id, recoveryCampaign.id]);
        console.log('   ✅ Dados de teste removidos');
        
        console.log('\n🎉 TESTE DAS CLASSES FINALIZADO COM SUCESSO!');
        console.log('✅ CampaignStateManager funcionando corretamente');
        console.log('✅ CampaignRecoveryManager funcionando corretamente');
        console.log('✅ Integração entre classes validada');
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE DAS CLASSES:', error.message);
        console.error('💡 Detalhes:', error);
    }
}

testPersistenceClasses();

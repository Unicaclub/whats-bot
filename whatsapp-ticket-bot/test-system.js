const { CampaignTracker } = require('./modules/campaignTracker');

async function testSystem() {
    try {
        console.log('🔍 Testando sistema após correções...');
        
        const tracker = new CampaignTracker();
        
        // Teste 1: Verificar se conseguimos verificar números duplicados
        console.log('\n📋 Teste 1: Verificação de duplicatas');
        const testNumber = '5511999999999';
        const exists = await tracker.checkIfAlreadySent(null, testNumber);
        console.log(`✅ Verificação de duplicata para ${testNumber}: ${exists ? 'Encontrado' : 'Não encontrado'}`);
        
        // Teste 2: Tentar criar uma campanha
        console.log('\n📋 Teste 2: Criação de campanha');
        try {
            const campaignId = await tracker.createCampaign({
                name: 'Teste Sistema Corrigido',
                message: 'Esta é uma mensagem de teste',
                sessionName: 'sales',
                totalTargets: 1
            });
            console.log(`✅ Campanha criada com sucesso! ID: ${campaignId}`);
            
            console.log('ℹ️ Mantendo campanha de teste (não removida devido à integridade referencial)');
            
        } catch (error) {
            console.error('❌ Erro ao criar campanha:', error.message);
        }
        
        console.log('\n🎉 Teste do sistema concluído!');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
    
    process.exit(0);
}

testSystem();

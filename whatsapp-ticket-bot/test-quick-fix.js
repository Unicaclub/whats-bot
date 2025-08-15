// Teste rápido para verificar se a correção funcionou
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testQuickFix() {
    console.log('🧪 TESTE RÁPIDO: Verificando correção do salvamento');
    console.log('='.repeat(50));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado\n');
        
        // Simular campaignControl.markCampaignSent
        const testNumber = `5511888${Date.now().toString().slice(-6)}`;
        
        console.log(`📞 Testando número: ${testNumber}`);
        
        // Simular o código corrigido do markCampaignSent
        const campaignId = 1;
        const result = await tracker.registerSentNumber(campaignId, testNumber, {
            status: 'enviado',
            session: 'test',
            sent_via: 'test_fix',
            timestamp: new Date().toISOString()
        });
        
        console.log(`📊 Resultado:`, result);
        
        if (result.success) {
            console.log(`✅ SUCESSO: Número ${testNumber} salvo com ID ${result.sentId}`);
            
            // Verificar se foi salvo mesmo
            const verify = await tracker.db.query(`
                SELECT id, campaign_id, phone_number, status, sent_at
                FROM sent_numbers 
                WHERE id = $1
            `, [result.sentId]);
            
            if (verify.length > 0) {
                console.log(`✅ CONFIRMADO: Número encontrado no banco:`, verify[0]);
            } else {
                console.log(`❌ ERRO: Número não encontrado no banco`);
            }
        } else {
            console.log(`❌ FALHA: ${result.message} (${result.reason})`);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
        console.error('Stack:', error.stack);
    }
    
    // Encerrar processo
    setTimeout(() => {
        console.log('🔚 Encerrando teste...');
        process.exit(0);
    }, 2000);
}

// Executar teste
testQuickFix();

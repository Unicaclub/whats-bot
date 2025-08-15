// Teste específico para verificar o salvamento no banco de dados
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testDatabaseInsert() {
    console.log('🧪 TESTE: Verificando salvamento no banco de dados');
    console.log('='.repeat(60));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado');
        
        // Testar inserção direta
        const testNumber = '5511999999999';
        const testCampaignId = 1;
        
        console.log(`📞 Testando com número: ${testNumber}`);
        console.log(`📢 Campanha ID: ${testCampaignId}`);
        
        // Verificar se já foi enviado
        console.log('\n1️⃣ Verificando se já foi enviado...');
        const alreadySent = await tracker.checkIfAlreadySent(testCampaignId, testNumber);
        console.log(`   Resultado: ${alreadySent ? 'JÁ ENVIADO' : 'NÃO ENVIADO'}`);
        
        // Testar se pode enviar
        console.log('\n2️⃣ Verificando se pode enviar...');
        const canSend = await tracker.canSendToNumber(testCampaignId, testNumber, true);
        console.log(`   Pode enviar: ${canSend.canSend}`);
        console.log(`   Motivo: ${canSend.reason}`);
        console.log(`   Mensagem: ${canSend.message}`);
        
        // Tentar registrar o envio
        console.log('\n3️⃣ Tentando registrar envio...');
        const result = await tracker.registerSentNumber(testCampaignId, testNumber, {
            status: 'enviado',
            messageId: 'teste_' + Date.now(),
            session: 'test',
            sent_via: 'test_script',
            timestamp: new Date().toISOString()
        });
        
        console.log('   Resultado do registro:');
        console.log(`   - Sucesso: ${result.success}`);
        console.log(`   - Motivo: ${result.reason || 'N/A'}`);
        console.log(`   - Mensagem: ${result.message}`);
        console.log(`   - ID gerado: ${result.sentId || 'N/A'}`);
        
        // Verificar novamente se foi salvo
        console.log('\n4️⃣ Verificando se foi salvo...');
        const nowSent = await tracker.checkIfAlreadySent(testCampaignId, testNumber);
        console.log(`   Agora está salvo: ${nowSent ? 'SIM' : 'NÃO'}`);
        
        // Consultar diretamente o banco
        console.log('\n5️⃣ Consultando banco diretamente...');
        const directQuery = await tracker.db.query(`
            SELECT id, campaign_id, phone_number, status, sent_at, metadata
            FROM sent_numbers 
            WHERE phone_number = $1 
            ORDER BY sent_at DESC 
            LIMIT 5
        `, [testNumber]);
        
        console.log(`   Registros encontrados: ${directQuery.length}`);
        directQuery.forEach((record, index) => {
            console.log(`   ${index + 1}. ID: ${record.id}, Campanha: ${record.campaign_id}, Status: ${record.status}`);
            console.log(`      Enviado em: ${record.sent_at}`);
        });
        
        // Verificar campanhas existentes
        console.log('\n6️⃣ Verificando campanhas existentes...');
        const campaigns = await tracker.db.query(`
            SELECT id, campaign_name, status, created_at
            FROM campaigns 
            ORDER BY id DESC 
            LIMIT 5
        `);
        
        console.log(`   Campanhas encontradas: ${campaigns.length}`);
        campaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ID: ${campaign.id}, Nome: "${campaign.campaign_name}", Status: ${campaign.status}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Teste concluído');
        
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
testDatabaseInsert();

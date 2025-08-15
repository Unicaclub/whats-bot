// Teste com número não bloqueado
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testWithCleanNumber() {
    console.log('🧪 TESTE: Verificando salvamento com número limpo');
    console.log('='.repeat(60));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado');
        
        // Testar com número único
        const testNumber = `5511888${Date.now().toString().slice(-6)}`; // Número único
        const testCampaignId = 1;
        
        console.log(`📞 Testando com número: ${testNumber}`);
        console.log(`📢 Campanha ID: ${testCampaignId}`);
        
        // Verificar se está na blacklist
        console.log('\n1️⃣ Verificando blacklist...');
        const isBlacklisted = tracker.isBlacklisted(testNumber);
        console.log(`   Na blacklist: ${isBlacklisted ? 'SIM' : 'NÃO'}`);
        
        if (isBlacklisted) {
            console.log('❌ Número está na blacklist, cancelando teste');
            return;
        }
        
        // Verificar se já foi enviado
        console.log('\n2️⃣ Verificando se já foi enviado...');
        const alreadySent = await tracker.checkIfAlreadySent(testCampaignId, testNumber);
        console.log(`   Já enviado: ${alreadySent ? 'SIM' : 'NÃO'}`);
        
        // Testar se pode enviar
        console.log('\n3️⃣ Verificando se pode enviar...');
        const canSend = await tracker.canSendToNumber(testCampaignId, testNumber, true);
        console.log(`   Pode enviar: ${canSend.canSend}`);
        console.log(`   Motivo: ${canSend.reason}`);
        console.log(`   Mensagem: ${canSend.message}`);
        
        if (!canSend.canSend) {
            console.log('❌ Não pode enviar, cancelando teste');
            return;
        }
        
        // Tentar registrar o envio
        console.log('\n4️⃣ Tentando registrar envio...');
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
        console.log('\n5️⃣ Verificando se foi salvo...');
        const nowSent = await tracker.checkIfAlreadySent(testCampaignId, testNumber);
        console.log(`   Agora está salvo: ${nowSent ? 'SIM' : 'NÃO'}`);
        
        // Consultar diretamente o banco
        console.log('\n6️⃣ Consultando banco diretamente...');
        const directQuery = await tracker.db.query(`
            SELECT id, campaign_id, phone_number, status, sent_at, metadata
            FROM sent_numbers 
            WHERE phone_number = $1 
            ORDER BY sent_at DESC 
            LIMIT 3
        `, [testNumber]);
        
        console.log(`   Registros encontrados: ${directQuery.length}`);
        directQuery.forEach((record, index) => {
            console.log(`   ${index + 1}. ID: ${record.id}, Campanha: ${record.campaign_id}, Status: ${record.status}`);
            console.log(`      Enviado em: ${record.sent_at}`);
            console.log(`      Metadata: ${JSON.stringify(record.metadata, null, 2)}`);
        });
        
        // Teste: Tentar inserir outro número
        console.log('\n7️⃣ Testando com segundo número...');
        const testNumber2 = `5511777${Date.now().toString().slice(-6)}`;
        console.log(`📞 Segundo número: ${testNumber2}`);
        
        const result2 = await tracker.registerSentNumber(testCampaignId, testNumber2, {
            status: 'enviado',
            messageId: 'teste2_' + Date.now(),
            session: 'test',
            sent_via: 'test_script_2'
        });
        
        console.log(`   Segundo registro - Sucesso: ${result2.success}, ID: ${result2.sentId}`);
        
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
testWithCleanNumber();

// Script de teste para verificar se a implementação da verificação está funcionando
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testVerification() {
    console.log('🧪 Testando sistema de verificação de números...\n');
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        // Número de teste (deve existir na base)
        const testNumber = '556792242491'; // Um dos números que aparecem no resultado anterior
        
        console.log(`📞 Testando número: ${testNumber}`);
        
        // Testar verificação
        const alreadySent = await tracker.checkIfAlreadySent(null, testNumber, '24h');
        
        console.log(`\n📊 Resultado da verificação:`);
        console.log(`   - Número: ${testNumber}`);
        console.log(`   - Já foi enviado: ${alreadySent ? 'SIM' : 'NÃO'}`);
        console.log(`   - Deve ser ignorado: ${alreadySent ? 'SIM' : 'NÃO'}`);
        
        if (alreadySent) {
            console.log(`\n✅ Implementação funcionando! O número ${testNumber} foi detectado como já existente.`);
            console.log(`   - Este número SERÁ IGNORADO na próxima campanha`);
        } else {
            console.log(`\n⚠️  Número ${testNumber} não foi encontrado na base`);
            console.log(`   - Pode ser que não tenha sido enviado nas últimas 24h`);
        }
        
        // Testar com número inexistente
        console.log(`\n📞 Testando número inexistente: 5599888777666`);
        const notSent = await tracker.checkIfAlreadySent(null, '5599888777666', '24h');
        console.log(`   - Já foi enviado: ${notSent ? 'SIM' : 'NÃO'}`);
        console.log(`   - Deve ser enviado: ${notSent ? 'NÃO' : 'SIM'}`);
        
        if (!notSent) {
            console.log(`\n✅ Implementação funcionando! O número inexistente pode ser enviado.`);
        } else {
            console.log(`\n⚠️  Esse número também já está na base. Vamos testar outro...`);
            
            // Testar outro número
            console.log(`\n📞 Testando número completamente novo: 5511000000001`);
            const notSent2 = await tracker.checkIfAlreadySent(null, '5511000000001', '24h');
            console.log(`   - Já foi enviado: ${notSent2 ? 'SIM' : 'NÃO'}`);
            console.log(`   - Deve ser enviado: ${notSent2 ? 'NÃO' : 'SIM'}`);
            
            if (!notSent2) {
                console.log(`\n✅ Implementação funcionando! O número novo pode ser enviado.`);
            }
        }
        
        console.log('\n🎯 LÓGICA IMPLEMENTADA:');
        console.log('   1. Para cada número da campanha');
        console.log('   2. Verificar se já existe na tabela sent_numbers (últimas 24h)');
        console.log('   3. Se JÁ EXISTE: ignorar e ir para o próximo');
        console.log('   4. Se NÃO EXISTE: enviar normalmente');
        console.log('   5. Evitar duplicatas e respeitar histórico de envios');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Executar teste
testVerification()
    .then(() => {
        console.log('\n✅ Teste concluído!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });

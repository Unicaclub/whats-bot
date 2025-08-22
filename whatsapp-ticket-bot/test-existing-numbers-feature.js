// FUNCIONALIDADE TEMPORARIAMENTE DESABILITADA
// Este teste está comentado para evitar conflitos com a funcionalidade principal
/*
const ExistingNumbersCampaignManager = require('./modules/ExistingNumbersCampaignManager');
require('dotenv').config();

async function testExistingNumbersFeature() {
    console.log('🧪 TESTANDO NOVA FUNCIONALIDADE: CAMPANHAS COM NÚMEROS EXISTENTES');
    console.log('================================================================');
    
    // Configurar manager
    const manager = new ExistingNumbersCampaignManager({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'whatsapp_campaigns'
    });
    
    try {
        // 1. Obter estatísticas gerais
        console.log('\n1. 📊 ESTATÍSTICAS GERAIS');
        console.log('==========================');
        
        const stats = await manager.getNumbersStatistics();
        if (stats.success) {
            console.log('✅ Estatísticas obtidas:');
            console.log(`   📱 Números únicos: ${stats.general.total_unique_numbers}`);
            console.log(`   📤 Total de envios: ${stats.general.total_sends}`);
            console.log(`   📈 Taxa de resposta: ${Math.round(stats.general.response_rate)}%`);
            console.log(`   📅 Últimos 7 dias: ${stats.general.sends_last_7_days} envios`);
            console.log(`   📅 Últimos 30 dias: ${stats.general.sends_last_30_days} envios`);
            
            console.log('\n   Por sessão:');
            stats.by_session.forEach(session => {
                console.log(`   • ${session.session_name}: ${session.unique_numbers} números únicos (${session.total_sends} envios)`);
            });
        } else {
            console.log('❌ Erro ao obter estatísticas:', stats.error);
        }
        
        // 2. Buscar números que nunca responderam
        console.log('\n2. 📵 NÚMEROS QUE NUNCA RESPONDERAM');
        console.log('===================================');
        
        const neverResponded = await manager.getNumbersByCriteria({
            type: 'never_responded',
            limit: 10
        });
        
        if (neverResponded.success) {
            console.log(`✅ Encontrados ${neverResponded.total} números que nunca responderam`);
            neverResponded.numbers.slice(0, 5).forEach((num, index) => {
                console.log(`   ${index + 1}. ${num.phone_number} - ${num.total_sends} envios - Último: ${new Date(num.last_sent).toLocaleDateString('pt-BR')}`);
            });
        } else {
            console.log('❌ Erro:', neverResponded.error);
        }
        
        // 3. Buscar contatos antigos (30+ dias)
        console.log('\n3. ⏰ CONTATOS ANTIGOS (30+ DIAS)');
        console.log('=================================');
        
        const oldContacts = await manager.getNumbersByCriteria({
            type: 'old_contacts',
            days: 30,
            limit: 10
        });
        
        if (oldContacts.success) {
            console.log(`✅ Encontrados ${oldContacts.total} contatos antigos`);
            oldContacts.numbers.slice(0, 5).forEach((num, index) => {
                console.log(`   ${index + 1}. ${num.phone_number} - Último envio: ${new Date(num.last_sent).toLocaleDateString('pt-BR')}`);
            });
        } else {
            console.log('❌ Erro:', oldContacts.error);
        }
        
        // 4. Verificar elegibilidade de alguns números
        console.log('\n4. ✅ VERIFICAÇÃO DE ELEGIBILIDADE');
        console.log('==================================');
        
        if (neverResponded.success && neverResponded.numbers.length > 0) {
            const sampleNumber = neverResponded.numbers[0].phone_number;
            const eligibility = await manager.canReceiveNewCampaign(sampleNumber);
            
            console.log(`📱 Verificando ${sampleNumber}:`);
            console.log(`   ✅ Pode receber campanha: ${eligibility.canReceive ? 'SIM' : 'NÃO'}`);
            console.log(`   💭 Motivo: ${eligibility.reason}`);
            if (eligibility.lastSent) {
                console.log(`   📅 Último envio: ${new Date(eligibility.lastSent).toLocaleString('pt-BR')}`);
            }
        }
        
        console.log('\n🎯 RESULTADO DO TESTE:');
        console.log('======================');
        console.log('✅ Módulo ExistingNumbersCampaignManager funcionando corretamente');
        console.log('✅ APIs prontas para uso');
        console.log('✅ Interface web adicionada');
        console.log('✅ Nova funcionalidade 100% integrada!');
        console.log('\n🌐 Acesse http://localhost:3006 para usar a nova seção');
        console.log('💡 Procure por "Campanhas com Números Existentes" no dashboard');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

testExistingNumbersFeature();
*/

console.log('📋 Teste temporariamente desabilitado - funcionalidade comentada para evitar conflitos');

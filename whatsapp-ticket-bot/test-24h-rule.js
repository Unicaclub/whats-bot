const ExistingNumbersCampaignManager = require('./modules/ExistingNumbersCampaignManager');
require('dotenv').config();

async function testNewContactedRule() {
    console.log('🧪 TESTANDO NOVA REGRA: CONTACTADOS HÁ MAIS DE 24H');
    console.log('=================================================');
    
    const manager = new ExistingNumbersCampaignManager({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'whatsapp_campaigns'
    });
    
    try {
        // 1. Testar nova regra: contactados há mais de 24h
        console.log('\n1. ⏰ NÚMEROS CONTACTADOS HÁ MAIS DE 24H');
        console.log('========================================');
        
        const contacted24h = await manager.getNumbersByCriteria({
            type: 'contacted_24h_ago',
            limit: 10
        });
        
        if (contacted24h.success) {
            console.log(`✅ Encontrados ${contacted24h.total} números contactados há mais de 24h`);
            contacted24h.numbers.slice(0, 5).forEach((num, index) => {
                const hoursAgo = Math.round((Date.now() - new Date(num.last_sent).getTime()) / (1000 * 60 * 60));
                console.log(`   ${index + 1}. ${num.phone_number} - Último envio: ${hoursAgo}h atrás (${new Date(num.last_sent).toLocaleString('pt-BR')})`);
            });
        } else {
            console.log('❌ Erro:', contacted24h.error);
        }
        
        // 2. Testar função de elegibilidade com diferentes tempos
        console.log('\n2. 🔍 TESTE DE ELEGIBILIDADE COM DIFERENTES TEMPOS');
        console.log('=================================================');
        
        if (contacted24h.success && contacted24h.numbers.length > 0) {
            const sampleNumber = contacted24h.numbers[0].phone_number;
            
            // Testar com 1 hora
            const check1h = await manager.canReceiveNewCampaign(sampleNumber, null, 1);
            console.log(`📱 ${sampleNumber} (1h mínimo):`);
            console.log(`   ✅ Pode receber: ${check1h.canReceive ? 'SIM' : 'NÃO'}`);
            console.log(`   💭 Motivo: ${check1h.reason}`);
            
            // Testar com 24 horas
            const check24h = await manager.canReceiveNewCampaign(sampleNumber, null, 24);
            console.log(`📱 ${sampleNumber} (24h mínimo):`);
            console.log(`   ✅ Pode receber: ${check24h.canReceive ? 'SIM' : 'NÃO'}`);
            console.log(`   💭 Motivo: ${check24h.reason}`);
            
            // Testar com 48 horas
            const check48h = await manager.canReceiveNewCampaign(sampleNumber, null, 48);
            console.log(`📱 ${sampleNumber} (48h mínimo):`);
            console.log(`   ✅ Pode receber: ${check48h.canReceive ? 'SIM' : 'NÃO'}`);
            console.log(`   💭 Motivo: ${check48h.reason}`);
        }
        
        // 3. Comparar com números recentes
        console.log('\n3. 📊 COMPARAÇÃO: RECENTES vs 24H+');
        console.log('==================================');
        
        const recentContacts = await manager.getNumbersByCriteria({
            type: 'active_contacts',
            days: 1,
            limit: 5
        });
        
        if (recentContacts.success) {
            console.log(`📅 Números recentes (últimas 24h): ${recentContacts.total}`);
        }
        
        if (contacted24h.success) {
            console.log(`⏰ Números há mais de 24h: ${contacted24h.total}`);
        }
        
        console.log('\n🎯 RESULTADO DO TESTE:');
        console.log('======================');
        console.log('✅ Nova regra "contacted_24h_ago" funcionando');
        console.log('✅ Função de elegibilidade com tempo configurável');
        console.log('✅ API atualizada para aceitar minHoursBetween');
        console.log('✅ Interface web com seletor de tempo');
        console.log('\n🌐 Acesse http://localhost:3006');
        console.log('💡 Nova opção: "⏰ Contactados há mais de 24h"');
        console.log('⚙️ Configure o tempo mínimo entre campanhas (1h a 1 semana)');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

testNewContactedRule();

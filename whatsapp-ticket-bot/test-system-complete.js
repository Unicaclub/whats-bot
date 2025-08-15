// Teste do sistema completo incluindo markCampaignSent
require('dotenv').config();

async function testSystemComplete() {
    console.log('🧪 TESTE SISTEMA COMPLETO');
    console.log('='.repeat(40));
    
    try {
        // Importar e inicializar como o app.js faz
        const { getCampaignTracker } = require('./modules/campaignTracker');
        
        // Simular o campaignControl como no app.js
        const campaignControl = {
            sentCampaigns: new Map(),
            tracker: null,
            
            async init() {
                try {
                    this.tracker = getCampaignTracker();
                    console.log('✅ Campaign Control inicializado');
                } catch (error) {
                    console.error('❌ Erro ao inicializar tracking:', error);
                }
            },
            
            async markCampaignSent(phoneNumber, campaignData = {}) {
                const cleanNumber = phoneNumber.replace('@c.us', '');
                this.sentCampaigns.set(cleanNumber, Date.now());
                console.log(`📢 Campanha marcada para ${cleanNumber}`);
                
                try {
                    const campaignTracker = getCampaignTracker();
                    if (campaignTracker) {
                        const campaignId = campaignData.campaignId || 1;
                        
                        // USAR A CORREÇÃO: chamada com parâmetros corretos
                        const result = await campaignTracker.registerSentNumber(campaignId, cleanNumber, {
                            status: 'enviado',
                            session: campaignData.session || 'sales',
                            sent_via: 'test_system',
                            timestamp: new Date().toISOString()
                        });
                        
                        if (result.success) {
                            console.log(`📊 Sucesso: ${cleanNumber} registrado com ID ${result.sentId}`);
                            return result;
                        } else {
                            console.log(`⚠️ Falha: ${result.message} (${result.reason})`);
                            return result;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erro no tracking: ${error.message}`);
                    return { success: false, message: error.message };
                }
            }
        };
        
        // Aguardar inicialização
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Inicializar campaignControl
        await campaignControl.init();
        
        // Testar com número novo
        const testNumber = `5511777${Date.now().toString().slice(-6)}@c.us`;
        console.log(`\n📞 Testando número: ${testNumber}`);
        
        const result = await campaignControl.markCampaignSent(testNumber, {
            campaignId: 1,
            session: 'test'
        });
        
        console.log(`\n📊 Resultado final:`, result);
        
        if (result && result.success) {
            console.log('🎉 SISTEMA FUNCIONANDO CORRETAMENTE!');
        } else {
            console.log('❌ SISTEMA COM PROBLEMA');
        }
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        console.error('Stack:', error.stack);
    }
    
    setTimeout(() => {
        console.log('🔚 Finalizando...');
        process.exit(0);
    }, 3000);
}

testSystemComplete();

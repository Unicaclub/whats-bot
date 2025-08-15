// Teste para verificar se o sistema está salvando números corretamente
const { getDatabase } = require('./database/manager-postgresql');

async function testSaveNumbers() {
    try {
        console.log('🔍 Testando sistema de salvamento de números...');
        
        const db = getDatabase();
        
        // 1. Verificar total de números no banco
        console.log('\n📊 Verificando dados no banco...');
        const totalNumbers = await db.query('SELECT COUNT(*) as total FROM campaign_sent_numbers');
        console.log(`Total de números salvos: ${totalNumbers[0].total}`);
        
        // 2. Verificar últimos 5 registros
        const latestNumbers = await db.query(`
            SELECT phone_number, campaign_id, status, created_at 
            FROM campaign_sent_numbers 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\n📱 Últimos 5 números salvos:');
        latestNumbers.forEach((record, index) => {
            console.log(`${index + 1}. ${record.phone_number} - Campanha ${record.campaign_id} - ${record.status} - ${new Date(record.created_at).toLocaleString()}`);
        });
        
        // 3. Testar salvamento via campaignControl
        console.log('\n🧪 Testando salvamento via campaignControl...');
        
        // Importar o campaignControl do app.js
        const fs = require('fs');
        const appContent = fs.readFileSync('./app.js', 'utf8');
        
        // Executar apenas a parte do campaignControl
        eval(`
            const { getCampaignTracker } = require('./modules/campaignTracker');
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
                    console.log(\`📢 Campanha marcada para \${cleanNumber}\`);
                    
                    try {
                        const campaignTracker = getCampaignTracker();
                        if (campaignTracker) {
                            const campaignId = campaignData.campaignId || 1;
                            const status = 'enviado';
                            
                            await campaignTracker.registerSentNumber(campaignId, cleanNumber, status, {
                                session: campaignData.session || 'sales',
                                sent_via: 'test',
                                timestamp: new Date().toISOString()
                            });
                            
                            console.log(\`📊 Tracking: Envio registrado para \${cleanNumber} na campanha \${campaignId}\`);
                        }
                    } catch (error) {
                        console.error(\`❌ Erro no tracking para \${cleanNumber}:\`, error.message);
                    }
                }
            };
        `);
        
        // Inicializar e testar
        await campaignControl.init();
        
        // Testar salvamento de um número
        const testNumber = '5511999887766';
        console.log(`\n🎯 Testando salvamento do número ${testNumber}...`);
        await campaignControl.markCampaignSent(testNumber, { campaignId: 999, session: 'test' });
        
        // Verificar se foi salvo
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
        
        const savedNumber = await db.query(`
            SELECT * FROM campaign_sent_numbers 
            WHERE phone_number = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [testNumber]);
        
        if (savedNumber.length > 0) {
            console.log('✅ SUCESSO: Número foi salvo no banco!');
            console.log('📄 Dados salvos:', savedNumber[0]);
        } else {
            console.log('❌ ERRO: Número NÃO foi salvo no banco!');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
    
    process.exit(0);
}

testSaveNumbers();

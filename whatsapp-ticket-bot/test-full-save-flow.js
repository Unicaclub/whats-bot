// Teste completo do fluxo de salvamento de números
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function testFullSaveFlow() {
    console.log('🔍 TESTE COMPLETO: Verificando fluxo de salvamento de números');
    console.log('='.repeat(70));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado\n');
        
        // 1. Verificar conexão com banco
        console.log('1️⃣ VERIFICANDO CONEXÃO COM BANCO:');
        const testConnection = await tracker.db.testConnection();
        console.log(`   Conexão: ${testConnection ? 'OK' : 'FALHA'}`);
        
        // 2. Verificar estrutura da tabela sent_numbers
        console.log('\n2️⃣ VERIFICANDO ESTRUTURA DA TABELA sent_numbers:');
        const sentNumbersColumns = await tracker.db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sent_numbers'
            ORDER BY ordinal_position
        `);
        
        console.log(`   Colunas: ${sentNumbersColumns.length}`);
        sentNumbersColumns.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nulo: ${col.is_nullable}`);
        });
        
        // 3. Testar inserção direta no banco
        console.log('\n3️⃣ TESTE INSERÇÃO DIRETA NO BANCO:');
        const testNumber = `5511999${Date.now().toString().slice(-6)}`;
        const testCampaignId = 1;
        
        console.log(`   Número teste: ${testNumber}`);
        console.log(`   Campanha ID: ${testCampaignId}`);
        
        try {
            const directInsertResult = await tracker.db.query(`
                INSERT INTO sent_numbers (
                    campaign_id, 
                    phone_number, 
                    status, 
                    metadata
                ) VALUES ($1, $2, $3, $4)
                RETURNING id, campaign_id, phone_number, status, sent_at
            `, [
                testCampaignId, 
                testNumber, 
                'teste_direto', 
                JSON.stringify({
                    session: 'test',
                    sent_via: 'test_direct',
                    timestamp: new Date().toISOString()
                })
            ]);
            
            console.log(`   ✅ Inserção direta OK - ID: ${directInsertResult[0].id}`);
            console.log(`   Dados inseridos:`, directInsertResult[0]);
        } catch (directError) {
            console.error(`   ❌ Erro na inserção direta:`, directError.message);
            console.error(`   Stack:`, directError.stack);
        }
        
        // 4. Testar via registerSentNumber (método do manager)
        console.log('\n4️⃣ TESTE VIA registerSentNumber (Manager):');
        const testNumber2 = `5511888${Date.now().toString().slice(-6)}`;
        
        try {
            const managerResult = await tracker.db.registerSentNumber({
                campaignId: testCampaignId,
                phoneNumber: testNumber2,
                status: 'teste_manager',
                messageId: 'teste_' + Date.now(),
                session: 'test',
                sent_via: 'test_manager'
            });
            
            console.log(`   ✅ Via Manager OK - ID: ${managerResult}`);
        } catch (managerError) {
            console.error(`   ❌ Erro via Manager:`, managerError.message);
            console.error(`   Stack:`, managerError.stack);
        }
        
        // 5. Testar via registerSentNumber (método do tracker)
        console.log('\n5️⃣ TESTE VIA registerSentNumber (Tracker):');
        const testNumber3 = `5511777${Date.now().toString().slice(-6)}`;
        
        try {
            const trackerResult = await tracker.registerSentNumber(testCampaignId, testNumber3, {
                status: 'teste_tracker',
                messageId: 'teste_tracker_' + Date.now(),
                session: 'test',
                sent_via: 'test_tracker'
            });
            
            console.log(`   ✅ Via Tracker OK:`, trackerResult);
        } catch (trackerError) {
            console.error(`   ❌ Erro via Tracker:`, trackerError.message);
            console.error(`   Stack:`, trackerError.stack);
        }
        
        // 6. Verificar se todos os números foram salvos
        console.log('\n6️⃣ VERIFICANDO NÚMEROS SALVOS:');
        const allTestNumbers = [testNumber, testNumber2, testNumber3];
        
        for (let i = 0; i < allTestNumbers.length; i++) {
            const number = allTestNumbers[i];
            const found = await tracker.db.query(`
                SELECT id, campaign_id, phone_number, status, sent_at, metadata
                FROM sent_numbers 
                WHERE phone_number = $1
                ORDER BY sent_at DESC 
                LIMIT 1
            `, [number]);
            
            console.log(`   ${i + 1}. ${number}: ${found.length > 0 ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
            if (found.length > 0) {
                console.log(`      ID: ${found[0].id}, Status: ${found[0].status}, Enviado: ${found[0].sent_at}`);
            }
        }
        
        // 7. Verificar campanhas existentes
        console.log('\n7️⃣ VERIFICANDO CAMPANHAS EXISTENTES:');
        const campaigns = await tracker.db.query(`
            SELECT id, campaign_name, status
            FROM campaigns 
            ORDER BY id DESC 
            LIMIT 5
        `);
        
        console.log(`   Campanhas encontradas: ${campaigns.length}`);
        campaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ID: ${campaign.id} - "${campaign.campaign_name}" - Status: ${campaign.status}`);
        });
        
        // 8. Testar o fluxo do campaignControl.markCampaignSent
        console.log('\n8️⃣ TESTE VIA campaignControl.markCampaignSent:');
        
        // Simular o campaignControl
        const mockCampaignControl = {
            sentCampaigns: new Map(),
            tracker: tracker,
            
            async markCampaignSent(phoneNumber, campaignData = {}) {
                const cleanNumber = phoneNumber.replace('@c.us', '');
                this.sentCampaigns.set(cleanNumber, Date.now());
                console.log(`   📢 Marcando: ${cleanNumber}`);
                
                try {
                    const campaignId = campaignData.campaignId || 1;
                    
                    // Chama o método registerSentNumber do tracker
                    const result = await this.tracker.registerSentNumber(campaignId, cleanNumber, {
                        status: 'enviado',
                        session: campaignData.session || 'sales',
                        sent_via: 'mock_campaign',
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log(`   📊 Resultado tracking:`, result);
                    return result;
                } catch (error) {
                    console.error(`   ❌ Erro no tracking:`, error.message);
                    throw error;
                }
            }
        };
        
        const testNumber4 = `5511666${Date.now().toString().slice(-6)}@c.us`;
        
        try {
            const campaignControlResult = await mockCampaignControl.markCampaignSent(testNumber4, { 
                campaignId: 1, 
                session: 'test' 
            });
            console.log(`   ✅ Via campaignControl OK:`, campaignControlResult);
        } catch (campaignControlError) {
            console.error(`   ❌ Erro via campaignControl:`, campaignControlError.message);
            console.error(`   Stack:`, campaignControlError.stack);
        }
        
        // 9. Verificar todas as inserções
        console.log('\n9️⃣ RESUMO FINAL - VERIFICANDO TODAS AS INSERÇÕES:');
        const finalQuery = await tracker.db.query(`
            SELECT id, campaign_id, phone_number, status, sent_at, metadata
            FROM sent_numbers 
            WHERE phone_number IN ($1, $2, $3, $4)
            ORDER BY sent_at DESC
        `, [testNumber, testNumber2, testNumber3, testNumber4.replace('@c.us', '')]);
        
        console.log(`   Total de registros encontrados: ${finalQuery.length}`);
        finalQuery.forEach((record, index) => {
            const metadata = record.metadata || {};
            console.log(`   ${index + 1}. ID: ${record.id} - ${record.phone_number} - Status: ${record.status}`);
            console.log(`      Enviado: ${record.sent_at} - Via: ${metadata.sent_via || 'N/A'}`);
        });
        
        console.log('\n' + '='.repeat(70));
        
        if (finalQuery.length === 4) {
            console.log('✅ SUCESSO: Todas as inserções foram salvas corretamente!');
        } else {
            console.log(`❌ PROBLEMA: Esperados 4 registros, encontrados ${finalQuery.length}`);
            console.log('   Verifique os erros acima para identificar o problema.');
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
testFullSaveFlow();

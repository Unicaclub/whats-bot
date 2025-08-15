// Verificar estrutura das tabelas e números enviados
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function checkDatabaseStructure() {
    console.log('🔍 DIAGNÓSTICO: Verificando estrutura do banco e números enviados');
    console.log('='.repeat(70));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado\n');
        
        // 1. Verificar estrutura da tabela blacklist
        console.log('1️⃣ ESTRUTURA DA TABELA BLACKLIST:');
        const blacklistColumns = await tracker.db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'blacklist'
            ORDER BY ordinal_position
        `);
        
        console.log(`   Colunas da tabela blacklist: ${blacklistColumns.length}`);
        blacklistColumns.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nulo: ${col.is_nullable}`);
        });
        
        // 2. Verificar blacklist com colunas corretas
        console.log('\n2️⃣ NÚMEROS NA BLACKLIST:');
        const blacklistQuery = await tracker.db.query(`
            SELECT phone_number, reason, campaign_id
            FROM blacklist 
            WHERE is_active = TRUE
        `);
        
        console.log(`   Total na blacklist: ${blacklistQuery.length}`);
        blacklistQuery.forEach((record, index) => {
            console.log(`   ${index + 1}. ${record.phone_number} - Motivo: ${record.reason} - Campanha: ${record.campaign_id || 'N/A'}`);
        });
        
        // 3. Verificar estrutura da tabela sent_numbers
        console.log('\n3️⃣ ESTRUTURA DA TABELA SENT_NUMBERS:');
        const sentNumbersColumns = await tracker.db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sent_numbers'
            ORDER BY ordinal_position
        `);
        
        console.log(`   Colunas da tabela sent_numbers: ${sentNumbersColumns.length}`);
        sentNumbersColumns.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - Nulo: ${col.is_nullable}`);
        });
        
        // 4. Verificar números enviados hoje
        console.log('\n4️⃣ NÚMEROS ENVIADOS HOJE:');
        const today = new Date().toISOString().split('T')[0];
        const sentTodayQuery = await tracker.db.query(`
            SELECT 
                campaign_id, 
                phone_number, 
                status, 
                sent_at,
                metadata
            FROM sent_numbers 
            WHERE DATE(sent_at) = $1
            ORDER BY sent_at DESC
            LIMIT 10
        `, [today]);
        
        console.log(`   Total enviados hoje: ${sentTodayQuery.length}`);
        sentTodayQuery.forEach((record, index) => {
            const metadata = record.metadata || {};
            const session = metadata.session || 'N/A';
            const sentVia = metadata.sent_via || 'N/A';
            console.log(`   ${index + 1}. ${record.phone_number} - Campanha: ${record.campaign_id} - Status: ${record.status}`);
            console.log(`      Enviado: ${record.sent_at.toLocaleString()} - Sessão: ${session} - Via: ${sentVia}`);
        });
        
        // 5. Verificar números enviados nas últimas 24h
        console.log('\n5️⃣ NÚMEROS ENVIADOS NAS ÚLTIMAS 24H:');
        const last24hQuery = await tracker.db.query(`
            SELECT 
                campaign_id, 
                phone_number, 
                status, 
                sent_at
            FROM sent_numbers 
            WHERE sent_at > CURRENT_TIMESTAMP - INTERVAL '24 HOURS'
            ORDER BY sent_at DESC
        `);
        
        console.log(`   Total nas últimas 24h: ${last24hQuery.length}`);
        
        // Agrupar por campanha
        const byCampaign = {};
        last24hQuery.forEach(record => {
            if (!byCampaign[record.campaign_id]) {
                byCampaign[record.campaign_id] = [];
            }
            byCampaign[record.campaign_id].push(record);
        });
        
        Object.keys(byCampaign).forEach(campaignId => {
            console.log(`   📢 Campanha ${campaignId}: ${byCampaign[campaignId].length} números`);
            byCampaign[campaignId].slice(0, 3).forEach((record, index) => {
                console.log(`      ${index + 1}. ${record.phone_number} - ${record.sent_at.toLocaleString()}`);
            });
            if (byCampaign[campaignId].length > 3) {
                console.log(`      ... e mais ${byCampaign[campaignId].length - 3} números`);
            }
        });
        
        // 6. Verificar campanhas recentes
        console.log('\n6️⃣ CAMPANHAS RECENTES:');
        const recentCampaigns = await tracker.db.query(`
            SELECT id, campaign_name, status, created_at, 
                   (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaigns.id) as total_sent
            FROM campaigns 
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`   Campanhas encontradas: ${recentCampaigns.length}`);
        recentCampaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ID: ${campaign.id} - "${campaign.campaign_name}" - Status: ${campaign.status}`);
            console.log(`      Criada: ${campaign.created_at.toLocaleString()} - Enviados: ${campaign.total_sent}`);
        });
        
        // 7. Contar total de registros
        console.log('\n7️⃣ RESUMO GERAL:');
        const totalSentNumbers = await tracker.db.queryOne('SELECT COUNT(*) as count FROM sent_numbers');
        const totalCampaigns = await tracker.db.queryOne('SELECT COUNT(*) as count FROM campaigns');
        const totalBlacklist = await tracker.db.queryOne('SELECT COUNT(*) as count FROM blacklist WHERE is_active = TRUE');
        
        console.log(`   📊 Total de números enviados: ${totalSentNumbers.count}`);
        console.log(`   📢 Total de campanhas: ${totalCampaigns.count}`);
        console.log(`   🚫 Total na blacklist: ${totalBlacklist.count}`);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ Diagnóstico concluído');
        
        // Verificar se há problema recente
        if (sentTodayQuery.length === 0) {
            console.log('\n⚠️ ATENÇÃO: Nenhum número foi enviado hoje!');
            console.log('   Verifique se as campanhas estão rodando corretamente.');
        } else {
            console.log(`\n✅ Sistema funcionando: ${sentTodayQuery.length} números enviados hoje.`);
        }
        
        if (totalBlacklist.count > 0) {
            console.log(`\n⚠️ INFORMAÇÃO: ${totalBlacklist.count} números na blacklist não serão salvos novamente.`);
        }
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        console.error('Stack:', error.stack);
    }
    
    // Encerrar processo
    setTimeout(() => {
        console.log('🔚 Encerrando diagnóstico...');
        process.exit(0);
    }, 2000);
}

// Executar diagnóstico
checkDatabaseStructure();

// Verificar blacklist e números já enviados
require('dotenv').config();
const { getCampaignTracker } = require('./modules/campaignTracker');

async function checkBlacklistAndSentNumbers() {
    console.log('🔍 DIAGNÓSTICO: Verificando blacklist e números enviados');
    console.log('='.repeat(70));
    
    try {
        // Inicializar tracker
        const tracker = getCampaignTracker();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar inicialização
        
        console.log('✅ Tracker inicializado\n');
        
        // 1. Verificar blacklist
        console.log('1️⃣ NÚMEROS NA BLACKLIST:');
        const blacklistQuery = await tracker.db.query(`
            SELECT phone_number, reason, created_at, campaign_id
            FROM blacklist 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC
        `);
        
        console.log(`   Total na blacklist: ${blacklistQuery.length}`);
        blacklistQuery.forEach((record, index) => {
            console.log(`   ${index + 1}. ${record.phone_number} - Motivo: ${record.reason} - Adicionado: ${record.created_at.toLocaleString()}`);
        });
        
        // 2. Verificar números enviados hoje
        console.log('\n2️⃣ NÚMEROS ENVIADOS HOJE:');
        const today = new Date().toISOString().split('T')[0];
        const sentTodayQuery = await tracker.db.query(`
            SELECT 
                campaign_id, 
                phone_number, 
                status, 
                sent_at,
                metadata->>'session' as session
            FROM sent_numbers 
            WHERE DATE(sent_at) = $1
            ORDER BY sent_at DESC
            LIMIT 20
        `, [today]);
        
        console.log(`   Total enviados hoje: ${sentTodayQuery.length}`);
        sentTodayQuery.forEach((record, index) => {
            console.log(`   ${index + 1}. ${record.phone_number} - Campanha: ${record.campaign_id} - Status: ${record.status} - Sessão: ${record.session} - ${record.sent_at.toLocaleString()}`);
        });
        
        // 3. Verificar números enviados nas últimas 24h
        console.log('\n3️⃣ NÚMEROS ENVIADOS NAS ÚLTIMAS 24H:');
        const last24hQuery = await tracker.db.query(`
            SELECT 
                campaign_id, 
                phone_number, 
                status, 
                sent_at,
                metadata->>'sent_via' as sent_via
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
            byCampaign[campaignId].slice(0, 5).forEach((record, index) => {
                console.log(`      ${index + 1}. ${record.phone_number} - ${record.sent_at.toLocaleString()} - Via: ${record.sent_via || 'N/A'}`);
            });
            if (byCampaign[campaignId].length > 5) {
                console.log(`      ... e mais ${byCampaign[campaignId].length - 5} números`);
            }
        });
        
        // 4. Verificar campanhas ativas
        console.log('\n4️⃣ CAMPANHAS ATIVAS:');
        const activeCampaigns = await tracker.db.query(`
            SELECT id, campaign_name, status, created_at, 
                   (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaigns.id) as total_sent
            FROM campaigns 
            WHERE status IN ('ativa', 'rascunho', 'pausada')
            ORDER BY created_at DESC
        `);
        
        console.log(`   Total campanhas ativas: ${activeCampaigns.length}`);
        activeCampaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ID: ${campaign.id} - "${campaign.campaign_name}" - Status: ${campaign.status} - Enviados: ${campaign.total_sent}`);
        });
        
        // 5. Verificar últimos logs de erro
        console.log('\n5️⃣ ÚLTIMOS LOGS DE ERRO:');
        const errorLogs = await tracker.db.query(`
            SELECT level, message, metadata, created_at, phone_number
            FROM system_logs 
            WHERE level = 'error' OR message LIKE '%erro%' OR message LIKE '%falha%'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`   Logs de erro encontrados: ${errorLogs.length}`);
        errorLogs.forEach((log, index) => {
            console.log(`   ${index + 1}. ${log.created_at.toLocaleString()} - ${log.level}: ${log.message}`);
            if (log.phone_number) {
                console.log(`      Número: ${log.phone_number}`);
            }
        });
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ Diagnóstico concluído');
        console.log('\n💡 RESUMO:');
        console.log(`   - ${blacklistQuery.length} números na blacklist`);
        console.log(`   - ${sentTodayQuery.length} números enviados hoje`);
        console.log(`   - ${last24hQuery.length} números enviados nas últimas 24h`);
        console.log(`   - ${activeCampaigns.length} campanhas ativas`);
        console.log(`   - ${errorLogs.length} logs de erro recentes`);
        
        if (blacklistQuery.length > 0) {
            console.log('\n⚠️ ATENÇÃO: Números na blacklist não são salvos novamente!');
        }
        
        if (last24hQuery.length > sentTodayQuery.length) {
            console.log('⚠️ ATENÇÃO: Números já enviados nas últimas 24h são ignorados para evitar duplicatas!');
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
checkBlacklistAndSentNumbers();

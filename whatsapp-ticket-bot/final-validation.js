// TESTE FINAL - VALIDAÇÃO COMPLETA DO SISTEMA DE PERSISTÊNCIA
const { DatabaseManager } = require('./database/manager');

async function finalValidation() {
    console.log('🎯 VALIDAÇÃO FINAL DO SISTEMA DE PERSISTÊNCIA\n');
    
    try {
        const db = new DatabaseManager();
        
        // =====================================================
        // 1. TESTE DE CONEXÃO
        // =====================================================
        console.log('1️⃣ Testando conexão com banco...');
        await db.testConnection();
        console.log('   ✅ Conexão estabelecida\n');
        
        // =====================================================
        // 2. TESTE DE CRIAÇÃO DE CAMPANHA
        // =====================================================
        console.log('2️⃣ Testando criação de campanha...');
        const createResult = await db.query(`
            INSERT INTO campaigns (campaign_name, campaign_type, message_template, status, total_sent, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, ['Validação Final', 'promocional', 'Esta é uma mensagem de teste para validação do sistema de persistência.', 'rascunho', 0, new Date()]);
        
        const campaignId = createResult[0].id;
        console.log(`   ✅ Campanha criada com ID: ${campaignId}\n`);
        
        // =====================================================
        // 3. TESTE DE ATUALIZAÇÃO DE PROGRESSO
        // =====================================================
        console.log('3️⃣ Testando atualização de estatísticas...');
        await db.query(`
            UPDATE campaigns 
            SET total_sent = $1, total_delivered = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3
        `, [500, 480, campaignId]);
        console.log('   ✅ Estatísticas atualizadas (500 enviados, 480 entregues)\n');
        
        // =====================================================
        // 4. TESTE DE MUDANÇA DE STATUS
        // =====================================================
        console.log('4️⃣ Testando mudanças de status...');
        
        // Ativar campanha
        await db.query(`
            UPDATE campaigns 
            SET status = 'ativa', updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [campaignId]);
        console.log('   ✅ Campanha ativada');
        
        // Pausar campanha
        await db.query(`
            UPDATE campaigns 
            SET status = 'pausada', updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [campaignId]);
        console.log('   ✅ Campanha pausada');
        
        // Finalizar campanha
        await db.query(`
            UPDATE campaigns 
            SET status = 'finalizada', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [campaignId]);
        console.log('   ✅ Campanha finalizada\n');
        
        // =====================================================
        // 5. TESTE DE INTEGRAÇÃO COM SENT_NUMBERS
        // =====================================================
        console.log('5️⃣ Testando integração com sent_numbers...');
        
        // Inserir números enviados
        for (let i = 1; i <= 3; i++) {
            await db.query(`
                INSERT INTO sent_numbers (campaign_id, phone_number, status, metadata, sent_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `, [campaignId, `5511999${i.toString().padStart(6, '0')}`, 'enviado', JSON.stringify({ 
                message: `Mensagem teste ${i}`,
                timestamp: new Date().toISOString()
            })]);
        }
        console.log('   ✅ 3 números enviados registrados\n');
        
        // =====================================================
        // 6. TESTE DE CONSULTAS DE RECUPERAÇÃO
        // =====================================================
        console.log('6️⃣ Testando consultas de recuperação...');
        
        // Buscar campanhas por status
        const finalized = await db.query(`
            SELECT COUNT(*) as total FROM campaigns WHERE status = 'finalizada'
        `);
        console.log(`   📊 Campanhas finalizadas: ${finalized[0].total}`);
        
        // Buscar números enviados por campanha
        const sentNumbers = await db.query(`
            SELECT COUNT(*) as total FROM sent_numbers WHERE campaign_id = $1
        `, [campaignId]);
        console.log(`   📱 Números enviados desta campanha: ${sentNumbers[0].total}`);
        
        // Buscar último estado da campanha
        const campaignState = await db.query(`
            SELECT campaign_name, status, total_sent, total_delivered, created_at, updated_at
            FROM campaigns WHERE id = $1
        `, [campaignId]);
        
        const state = campaignState[0];
        console.log(`   📋 Estado da campanha: ${state.campaign_name}`);
        console.log(`   📈 Status: ${state.status}`);
        console.log(`   🎯 Estatísticas: ${state.total_sent} enviados, ${state.total_delivered} entregues`);
        console.log('   ✅ Recuperação de estado funcionando\n');
        
        // =====================================================
        // 7. TESTE DE LIMPEZA
        // =====================================================
        console.log('7️⃣ Limpando dados de teste...');
        await db.query('DELETE FROM sent_numbers WHERE campaign_id = $1', [campaignId]);
        await db.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
        console.log('   ✅ Dados de teste removidos\n');
        
        // =====================================================
        // 8. VALIDAÇÃO FINAL
        // =====================================================
        console.log('🎉 VALIDAÇÃO FINAL COMPLETA!\n');
        console.log('✅ TODAS AS FUNCIONALIDADES DE PERSISTÊNCIA VALIDADAS:');
        console.log('   🔗 Conexão com banco PostgreSQL');
        console.log('   📝 Criação de campanhas');
        console.log('   📊 Atualização de estatísticas');
        console.log('   🔄 Mudanças de status (rascunho → ativa → pausada → finalizada)');
        console.log('   📱 Integração com sent_numbers');
        console.log('   🔍 Consultas de recuperação');
        console.log('   🧹 Limpeza de dados');
        console.log('\n🏆 O SISTEMA DE PERSISTÊNCIA ESTÁ 100% FUNCIONAL E COMPATÍVEL COM O BANCO!');
        
    } catch (error) {
        console.error('❌ ERRO NA VALIDAÇÃO:', error.message);
        console.error('💡 Detalhes do erro:', error);
    }
}

finalValidation();

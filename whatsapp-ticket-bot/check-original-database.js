const { Pool } = require('pg');
require('dotenv').config();

async function checkOriginalDatabase() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'whatsapp_campaigns'
    });

    try {
        console.log('🔍 VERIFICANDO BANCO ORIGINAL: whatsapp_campaigns');
        console.log('==================================================');
        
        const client = await pool.connect();
        console.log('✅ Conectado ao banco:', process.env.DB_NAME);
        
        // Verificar números na tabela sent_numbers
        console.log('\n📞 NÚMEROS NA TABELA SENT_NUMBERS:');
        const sentResult = await client.query(`
            SELECT phone_number, campaign_id, sent_at, session_name 
            FROM sent_numbers 
            ORDER BY sent_at DESC 
            LIMIT 10
        `);
        
        if (sentResult.rows.length > 0) {
            sentResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${row.phone_number} - Campanha: ${row.campaign_id} - Sessão: ${row.session_name} - Data: ${new Date(row.sent_at).toLocaleString('pt-BR')}`);
            });
        } else {
            console.log('   📭 Nenhum número encontrado na tabela sent_numbers');
        }
        
        // Contar total de números enviados
        const totalSent = await client.query('SELECT COUNT(*) as total FROM sent_numbers');
        console.log(`\n📊 Total de números na sent_numbers: ${totalSent.rows[0].total}`);
        
        // Verificar campanhas ativas
        console.log('\n📋 CAMPANHAS NO BANCO ORIGINAL:');
        const campaignsResult = await client.query(`
            SELECT id, campaign_name, campaign_type, status, created_at 
            FROM campaigns 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (campaignsResult.rows.length > 0) {
            campaignsResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ID: ${row.id} - ${row.campaign_name} - Status: ${row.status}`);
            });
        } else {
            console.log('   📭 Nenhuma campanha encontrada');
        }
        
        // Verificar se existe o número problemático
        const problemNumber = '556791210220';
        const numberCheck = await client.query(
            'SELECT * FROM sent_numbers WHERE phone_number = $1',
            [problemNumber]
        );
        
        console.log(`\n🔍 VERIFICANDO NÚMERO PROBLEMÁTICO: ${problemNumber}`);
        if (numberCheck.rows.length > 0) {
            console.log(`   ⚠️ ENCONTRADO! Este número já foi enviado ${numberCheck.rows.length} vez(es)`);
            numberCheck.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. Campanha: ${row.campaign_id} - Data: ${new Date(row.sent_at).toLocaleString('pt-BR')}`);
            });
        } else {
            console.log(`   ✅ Número ${problemNumber} NÃO encontrado no banco original`);
        }
        
        client.release();
        
        console.log('\n🎯 CONCLUSÃO:');
        console.log('✅ Bot agora conectado ao banco original: whatsapp_campaigns');
        console.log('✅ Verificação de números duplicados concluída');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkOriginalDatabase();

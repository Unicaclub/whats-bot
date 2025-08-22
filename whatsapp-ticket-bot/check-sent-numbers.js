const { Pool } = require('pg');
require('dotenv').config();

async function checkSentNumbers() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'unica'
    });

    try {
        const client = await pool.connect();
        
        console.log('🔍 VERIFICANDO NÚMEROS CADASTRADOS');
        console.log('==================================');
        
        // Verificar números enviados
        const sentResult = await client.query(`
            SELECT id, phone, campaign_id, sent_at, session_name 
            FROM sent_numbers 
            ORDER BY sent_at DESC 
            LIMIT 10
        `);
        
        console.log('📱 ÚLTIMOS NÚMEROS ENVIADOS:');
        if (sentResult.rows.length === 0) {
            console.log('   📭 Nenhum número cadastrado');
        } else {
            sentResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. Telefone: ${row.phone} | Campanha: ${row.campaign_id} | Sessão: ${row.session_name} | Enviado: ${new Date(row.sent_at).toLocaleString('pt-BR')}`);
            });
        }
        
        // Contar números únicos
        const uniqueResult = await client.query('SELECT COUNT(DISTINCT phone) as unique_phones FROM sent_numbers');
        console.log(`\n📊 Total de números únicos: ${uniqueResult.rows[0].unique_phones}`);
        
        // Verificar o número específico que está dando problema
        const specificResult = await client.query(`
            SELECT * FROM sent_numbers 
            WHERE phone = '556791210220' 
            ORDER BY sent_at DESC
        `);
        
        console.log('\n🎯 VERIFICANDO NÚMERO ESPECÍFICO (556791210220):');
        if (specificResult.rows.length === 0) {
            console.log('   ✅ Número não está cadastrado');
        } else {
            specificResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ID: ${row.id} | Campanha: ${row.campaign_id} | Sessão: ${row.session_name}`);
                console.log(`       Enviado: ${new Date(row.sent_at).toLocaleString('pt-BR')}`);
                console.log(`       Status: ${row.status || 'N/A'}`);
            });
        }
        
        // Verificar campanhas ativas
        console.log('\n📈 CAMPANHAS ATIVAS:');
        const campaignsResult = await client.query(`
            SELECT id, campaign_name, status, created_at 
            FROM campaigns 
            WHERE status = 'ativa' 
            ORDER BY created_at DESC
        `);
        
        if (campaignsResult.rows.length === 0) {
            console.log('   📭 Nenhuma campanha ativa');
        } else {
            campaignsResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ID: ${row.id} | Nome: ${row.campaign_name} | Criada: ${new Date(row.created_at).toLocaleString('pt-BR')}`);
            });
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkSentNumbers();

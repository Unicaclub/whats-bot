const { Pool } = require('pg');
require('dotenv').config();

async function checkOriginalStructure() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'whatsapp_campaigns'
    });

    try {
        console.log('🔍 VERIFICANDO ESTRUTURA DO BANCO ORIGINAL');
        console.log('===========================================');
        
        const client = await pool.connect();
        console.log('✅ Conectado ao banco:', process.env.DB_NAME);
        
        // Verificar estrutura da tabela sent_numbers
        console.log('\n📋 ESTRUTURA DA TABELA SENT_NUMBERS:');
        const sentStructure = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sent_numbers' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        if (sentStructure.rows.length > 0) {
            sentStructure.rows.forEach(row => {
                console.log(`   • ${row.column_name} (${row.data_type})`);
            });
        } else {
            console.log('   ❌ Tabela sent_numbers não encontrada');
        }
        
        // Verificar dados com estrutura correta
        console.log('\n📞 NÚMEROS ENVIADOS (usando estrutura real):');
        const sentData = await client.query(`
            SELECT * FROM sent_numbers 
            ORDER BY id DESC 
            LIMIT 10
        `);
        
        if (sentData.rows.length > 0) {
            sentData.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
            });
        } else {
            console.log('   📭 Nenhum número na tabela sent_numbers');
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
                console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
            });
        } else {
            console.log(`   ✅ Número ${problemNumber} NÃO encontrado no banco original`);
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkOriginalStructure();

const { Pool } = require('pg');
require('dotenv').config();

async function checkCampaignsStructure() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'unica'
    });

    try {
        const client = await pool.connect();
        
        console.log('🔍 VERIFICANDO ESTRUTURA DA TABELA CAMPAIGNS:');
        console.log('===============================================');
        
        // Verificar colunas da tabela campaigns
        const columnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        if (columnsResult.rows.length === 0) {
            console.log('❌ Tabela campaigns não encontrada ou sem colunas');
        } else {
            console.log('📋 COLUNAS DA TABELA CAMPAIGNS:');
            columnsResult.rows.forEach(row => {
                console.log(`   • ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable}`);
            });
        }
        
        // Testar inserção com estrutura correta
        console.log('\n🔬 TESTANDO INSERÇÃO COM ESTRUTURA CORRETA:');
        
        // Primeiro vamos ver alguns dados existentes se houver
        const sampleResult = await client.query('SELECT * FROM campaigns LIMIT 3');
        if (sampleResult.rows.length > 0) {
            console.log('📊 DADOS EXISTENTES (sample):');
            sampleResult.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
            });
        } else {
            console.log('📊 Nenhum dado existente na tabela');
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkCampaignsStructure();

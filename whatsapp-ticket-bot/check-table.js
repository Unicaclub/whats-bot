const { Pool } = require('pg');
require('dotenv').config();

async function checkTableStructure() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    try {
        console.log('🔍 Verificando estrutura da tabela campaigns...\n');
        
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            ORDER BY ordinal_position;
        `);
        
        console.log('Colunas da tabela campaigns:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await pool.end();
    }
}

checkTableStructure();

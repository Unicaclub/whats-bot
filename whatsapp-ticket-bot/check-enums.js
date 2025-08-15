const { Pool } = require('pg');
require('dotenv').config();

async function checkEnums() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    try {
        console.log('🔍 Verificando enums do PostgreSQL...\n');
        
        // Verificar campaign_status
        const statusResult = await pool.query(`
            SELECT e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'campaign_status' 
            ORDER BY e.enumsortorder;
        `);
        
        console.log('Valores válidos para campaign_status:');
        statusResult.rows.forEach(row => {
            console.log(`- ${row.enumlabel}`);
        });
        
        console.log('\n');
        
        // Verificar campaign_type
        const typeResult = await pool.query(`
            SELECT e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'campaign_type' 
            ORDER BY e.enumsortorder;
        `);
        
        console.log('Valores válidos para campaign_type:');
        typeResult.rows.forEach(row => {
            console.log(`- ${row.enumlabel}`);
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkEnums();

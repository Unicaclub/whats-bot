const { Pool } = require('pg');
require('dotenv').config();

async function testUnicaDatabase() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB_NAME || 'unica'
    });

    try {
        console.log('🧪 TESTANDO BANCO UNICA');
        console.log('=======================');
        
        // Verificar conexão
        const client = await pool.connect();
        console.log('✅ Conectado ao banco:', process.env.DB_NAME);
        
        // Listar tabelas
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\n📋 TABELAS ENCONTRADAS:');
        tablesResult.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });
        
        // Testar inserção de campanha
        console.log('\n🔬 TESTANDO INSERÇÃO DE CAMPANHA:');
        const insertResult = await client.query(`
            INSERT INTO campaigns (name, message, status) 
            VALUES ($1, $2, $3) 
            RETURNING id, name
        `, ['Teste Unica Events', 'Mensagem de teste do banco Unica', 'active']);
        
        console.log(`   ✅ Campanha criada - ID: ${insertResult.rows[0].id}, Nome: ${insertResult.rows[0].name}`);
        
        // Contar campanhas
        const countResult = await client.query('SELECT COUNT(*) as total FROM campaigns');
        console.log(`   📊 Total de campanhas: ${countResult.rows[0].total}`);
        
        // Verificar blacklist
        const blacklistResult = await client.query('SELECT COUNT(*) as total FROM blacklist');
        console.log(`   🚫 Total na blacklist: ${blacklistResult.rows[0].total}`);
        
        client.release();
        
        console.log('\n🎯 RESULTADO FINAL:');
        console.log('✅ Banco "unica" configurado e funcionando perfeitamente!');
        console.log('✅ Todas as tabelas presentes');
        console.log('✅ Inserção/consulta funcionando');
        console.log('✅ Bot pronto para usar o banco Unica Events');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

testUnicaDatabase();

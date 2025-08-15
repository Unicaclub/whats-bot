// Teste simples para verificar banco de dados
const { getDatabase } = require('./database/manager-postgresql');

async function checkDatabase() {
    try {
        console.log('🔍 Conectando ao banco de dados...');
        
        const db = getDatabase();
        
        // Verificar total de números
        const totalNumbers = await db.query('SELECT COUNT(*) as total FROM campaign_sent_numbers');
        console.log(`📊 Total de números salvos: ${totalNumbers[0].total}`);
        
        // Verificar últimos registros
        const latestNumbers = await db.query(`
            SELECT phone_number, campaign_id, status, created_at 
            FROM campaign_sent_numbers 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n📱 Últimos 10 números salvos:');
        if (latestNumbers.length === 0) {
            console.log('❌ Nenhum número encontrado no banco!');
        } else {
            latestNumbers.forEach((record, index) => {
                console.log(`${index + 1}. ${record.phone_number} - Campanha ${record.campaign_id} - ${record.status} - ${new Date(record.created_at).toLocaleString()}`);
            });
        }
        
        // Verificar estrutura da tabela
        console.log('\n🏗️ Estrutura da tabela campaign_sent_numbers:');
        const tableStructure = await db.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'campaign_sent_numbers'
            ORDER BY ordinal_position
        `);
        
        tableStructure.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    process.exit(0);
}

checkDatabase();

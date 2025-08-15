const { DatabaseManager } = require('./database/manager');

async function checkTableStructure() {
    const db = new DatabaseManager();
    
    try {
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sent_numbers' 
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Estrutura da tabela sent_numbers:');
        console.log('Resultado:', result);
        if (result && result.rows) {
            result.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type}`);
            });
        } else {
            console.log('Nenhum resultado encontrado');
        }
        
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

checkTableStructure();

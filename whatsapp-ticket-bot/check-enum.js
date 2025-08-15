const { DatabaseManager } = require('./database/manager');

async function checkEnumValues() {
    const db = new DatabaseManager();
    
    try {
        const result = await db.query(`
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'message_status')
        `);
        
        console.log('📋 Valores válidos para enum message_status:');
        result.forEach(row => {
            console.log(`   - ${row.enumlabel}`);
        });
        
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

checkEnumValues();

// Teste direto e simples do banco
require('dotenv').config();

async function testDirect() {
    console.log('🧪 TESTE DIRETO: Testando salvamento no banco');
    
    try {
        const { getDatabase } = require('./database/manager-postgresql');
        const db = getDatabase();
        
        // Aguardar conexão
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Banco conectado');
        
        // Testar inserção direta
        const testNumber = `5511999${Date.now().toString().slice(-6)}`;
        const campaignId = 1;
        
        console.log(`📞 Testando: ${testNumber}`);
        
        const result = await db.query(`
            INSERT INTO sent_numbers (
                campaign_id, 
                phone_number, 
                status, 
                metadata
            ) VALUES ($1, $2, $3, $4)
            RETURNING id, campaign_id, phone_number, status, sent_at
        `, [
            campaignId, 
            testNumber, 
            'teste', 
            JSON.stringify({
                session: 'test',
                sent_via: 'direct_test',
                timestamp: new Date().toISOString()
            })
        ]);
        
        console.log('✅ SUCESSO: Inserção direta funcionou!');
        console.log('📊 Resultado:', result[0]);
        
        // Verificar se está salvo
        const verify = await db.query(`
            SELECT * FROM sent_numbers WHERE id = $1
        `, [result[0].id]);
        
        console.log('✅ VERIFICAÇÃO: Número encontrado no banco');
        console.log('📊 Dados:', verify[0]);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

testDirect();

const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');

async function testLargeCampaign() {
    try {
        console.log('🧪 TESTE: Processamento de Campanha Grande');
        console.log('='.repeat(50));
        
        // Simular 1000 números para teste
        const testNumbers = [];
        for (let i = 0; i < 1000; i++) {
            testNumbers.push(`5511${Math.floor(Math.random() * 900000000) + 100000000}`);
        }
        
        console.log(`📊 Teste com ${testNumbers.length} números`);
        
        const processor = new CampaignBatchProcessor(800); // Lotes otimizados de 800
        const message = "🎉 Esta é uma mensagem de teste para campanha grande!";
        
        const results = await processor.processLargeCampaignArray(testNumbers, message, 'sales');
        
        console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
        console.log(`📈 Taxa de sucesso simulada: ${((results.successCount / results.totalNumbers) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    testLargeCampaign();
}

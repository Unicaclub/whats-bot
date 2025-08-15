const fs = require('fs');
const path = require('path');

/**
 * Script para processar campanhas grandes em lotes
 * Use este script para campanhas com mais de 1000 números
 */

async function processCampaignInBatches(filePath, message, sessionName = 'sales', batchSize = 500) {
    try {
        console.log('🔄 Iniciando processamento em lotes...');
        
        // Ler arquivo
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let numbers = [];
        
        // Detectar formato do arquivo
        if (filePath.endsWith('.json')) {
            const data = JSON.parse(fileContent);
            numbers = Array.isArray(data) ? data : data.numbers || [];
        } else if (filePath.endsWith('.txt') || filePath.endsWith('.csv')) {
            numbers = fileContent.split('\n')
                .map(line => line.trim())
                .filter(line => line && /^\d+$/.test(line));
        }
        
        console.log(`📊 Total de números: ${numbers.length}`);
        console.log(`📦 Tamanho do lote: ${batchSize}`);
        
        const totalBatches = Math.ceil(numbers.length / batchSize);
        console.log(`🔢 Total de lotes: ${totalBatches}`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Processar em lotes
        for (let i = 0; i < totalBatches; i++) {
            const startIndex = i * batchSize;
            const endIndex = Math.min(startIndex + batchSize, numbers.length);
            const batch = numbers.slice(startIndex, endIndex);
            
            console.log(`\n🔄 Processando lote ${i + 1}/${totalBatches} (${batch.length} números)...`);
            
            try {
                const response = await fetch('http://localhost:3005/api/campaign/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        numbers: batch,
                        message: message,
                        sessionName: sessionName,
                        campaignName: `Lote ${i + 1} - Campanha Grande`
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ Lote ${i + 1} enviado com sucesso`);
                    successCount += batch.length;
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Erro no lote ${i + 1}: ${response.status} - ${errorText}`);
                    errorCount += batch.length;
                }
                
                // Aguardar entre lotes para não sobrecarregar
                if (i < totalBatches - 1) {
                    console.log('⏳ Aguardando 5 segundos antes do próximo lote...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.error(`❌ Erro no lote ${i + 1}:`, error.message);
                errorCount += batch.length;
            }
        }
        
        console.log('\n📊 RELATÓRIO FINAL:');
        console.log(`✅ Números processados com sucesso: ${successCount}`);
        console.log(`❌ Números com erro: ${errorCount}`);
        console.log(`📈 Taxa de sucesso: ${((successCount / numbers.length) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

// Configuração de uso
const CAMPAIGN_CONFIG = {
    filePath: './numeros-campanha.txt', // Altere para o caminho do seu arquivo
    message: `🎵 ROYAL – A NOITE É SUA, O REINADO É NOSSO 🎵

🎭 Prepare-se para uma noite LENDÁRIA!
MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil.

Se é luxo e exclusividade que você procura... Aqui é o seu lugar!`,
    sessionName: 'sales',
    batchSize: 500 // Ajuste conforme necessário
};

// Executar se chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('📋 USO:');
        console.log('node process-large-campaign.js <arquivo> <tamanho-lote>');
        console.log('');
        console.log('Exemplo:');
        console.log('node process-large-campaign.js ./numeros.txt 500');
        console.log('');
        console.log('Ou edite CAMPAIGN_CONFIG no arquivo e execute:');
        console.log('node process-large-campaign.js');
        
        // Usar configuração padrão
        processCampaignInBatches(
            CAMPAIGN_CONFIG.filePath,
            CAMPAIGN_CONFIG.message,
            CAMPAIGN_CONFIG.sessionName,
            CAMPAIGN_CONFIG.batchSize
        );
    } else {
        const filePath = args[0];
        const batchSize = args[1] ? parseInt(args[1]) : 500;
        
        processCampaignInBatches(
            filePath,
            CAMPAIGN_CONFIG.message,
            CAMPAIGN_CONFIG.sessionName,
            batchSize
        );
    }
}

module.exports = { processCampaignInBatches };

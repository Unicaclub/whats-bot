const fs = require('fs');
const path = require('path');

/**
 * Script para validar e preparar arquivos de campanha
 */

function validateCampaignFile(filePath) {
    try {
        console.log('🔍 Validando arquivo de campanha...');
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo não encontrado: ${filePath}`);
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let numbers = [];
        let errors = [];
        
        // Detectar formato
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.json') {
            try {
                const data = JSON.parse(fileContent);
                numbers = Array.isArray(data) ? data : data.numbers || [];
            } catch (e) {
                throw new Error('JSON inválido');
            }
        } else if (ext === '.txt' || ext === '.csv') {
            numbers = fileContent.split('\n')
                .map((line, index) => {
                    const cleaned = line.trim();
                    if (!cleaned) return null;
                    
                    // Validar se é número
                    if (!/^\d+$/.test(cleaned)) {
                        errors.push(`Linha ${index + 1}: "${cleaned}" não é um número válido`);
                        return null;
                    }
                    
                    // Validar formato brasileiro
                    if (!cleaned.startsWith('55') || cleaned.length < 12 || cleaned.length > 13) {
                        errors.push(`Linha ${index + 1}: "${cleaned}" não está no formato brasileiro correto`);
                        return null;
                    }
                    
                    return cleaned;
                })
                .filter(Boolean);
        } else {
            throw new Error('Formato de arquivo não suportado. Use .txt, .csv ou .json');
        }
        
        // Remover duplicatas
        const uniqueNumbers = [...new Set(numbers)];
        const duplicatesCount = numbers.length - uniqueNumbers.length;
        
        console.log('\n📊 RELATÓRIO DE VALIDAÇÃO:');
        console.log(`📁 Arquivo: ${path.basename(filePath)}`);
        console.log(`📏 Tamanho: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🔢 Total de linhas: ${numbers.length}`);
        console.log(`✅ Números válidos: ${uniqueNumbers.length}`);
        console.log(`🔄 Duplicatas removidas: ${duplicatesCount}`);
        console.log(`❌ Erros encontrados: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n⚠️ ERROS ENCONTRADOS:');
            errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
            if (errors.length > 10) {
                console.log(`  ... e mais ${errors.length - 10} erros`);
            }
        }
        
        // Recomendações
        console.log('\n💡 RECOMENDAÇÕES:');
        if (uniqueNumbers.length > 5000) {
            console.log('  🔄 Use processamento em lotes (recomendado: 500 por lote)');
        }
        if (uniqueNumbers.length > 1000) {
            console.log('  ⏱️ Considere usar delay maior entre envios');
        }
        if (duplicatesCount > 0) {
            console.log('  🧹 Arquivo limpo será salvo automaticamente');
        }
        
        // Salvar arquivo limpo se necessário
        if (duplicatesCount > 0 || errors.length > 0) {
            const cleanedPath = filePath.replace(/(\.[^.]+)$/, '_limpo$1');
            const cleanedContent = ext === '.json' 
                ? JSON.stringify(uniqueNumbers, null, 2)
                : uniqueNumbers.join('\n');
            
            fs.writeFileSync(cleanedPath, cleanedContent, 'utf8');
            console.log(`💾 Arquivo limpo salvo: ${cleanedPath}`);
        }
        
        return {
            isValid: errors.length === 0,
            numbers: uniqueNumbers,
            errors: errors,
            stats: {
                total: numbers.length,
                valid: uniqueNumbers.length,
                duplicates: duplicatesCount,
                errors: errors.length
            }
        };
        
    } catch (error) {
        console.error('❌ Erro na validação:', error.message);
        return {
            isValid: false,
            numbers: [],
            errors: [error.message],
            stats: { total: 0, valid: 0, duplicates: 0, errors: 1 }
        };
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const filePath = process.argv[2];
    
    if (!filePath) {
        console.log('📋 USO:');
        console.log('node validate-campaign-file.js <caminho-do-arquivo>');
        console.log('');
        console.log('Exemplo:');
        console.log('node validate-campaign-file.js ./numeros.txt');
        process.exit(1);
    }
    
    validateCampaignFile(filePath);
}

module.exports = { validateCampaignFile };

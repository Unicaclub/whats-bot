const fs = require('fs').promises;
const path = require('path');

// Carregar configurações do .env
require('dotenv').config();

// 🎭 IMPORTAR GERADOR DE VARIAÇÕES DE MENSAGENS
const MessageVariationGenerator = require('./MessageVariationGenerator');

class CampaignBatchProcessor {
    constructor(config = {}) {
        // Suporte ao formato antigo e novo
        if (typeof config === 'number') {
            // Formato antigo: constructor(batchSize, campaignControl, tracker)
            this.batchSize = config;
            this.campaignControl = arguments[1] || null;
            this.tracker = arguments[2] || null;
            this.minInterval = parseInt(process.env.MIN_DELAY) || 7000;   // 7s
            this.maxInterval = parseInt(process.env.MAX_DELAY) || 15000;  // 15s
            this.batchDelayMin = 15000; // 15s
            this.batchDelayMax = 30000; // 30s
        } else {
            // Formato novo: constructor({ batchSize, minInterval, maxInterval, ... })
            this.batchSize = config.batchSize || 300;
            this.minInterval = config.minInterval || parseInt(process.env.MIN_DELAY) || 7000;   // 7s
            this.maxInterval = config.maxInterval || parseInt(process.env.MAX_DELAY) || 15000;  // 15s
            this.batchDelayMin = config.batchDelayMin || 15000; // 15s
            this.batchDelayMax = config.batchDelayMax || 30000; // 30s
            this.campaignControl = config.campaignControl || null;
            this.tracker = config.tracker || null;
        }
        
        this.processedCount = 0;
        this.totalCount = 0;
        this.successCount = 0;
        this.failedCount = 0;
        this.duplicateCount = 0;
        
        // 🎭 SISTEMA DE VARIAÇÕES DE MENSAGENS
        this.variationGenerator = new MessageVariationGenerator();
        this.messageVariations = [];
        this.variationIndex = 0;
        
        // Sistema de persistência de estado
        this.stateManager = null;
        this.stateId = null;
        this.currentBatch = 0;
        
        console.log(`🚀 CampaignBatchProcessor configurado:`);
        console.log(`   📦 Batch size: ${this.batchSize}`);
        console.log(`   ⏰ Intervalo mensagens: ${this.minInterval/1000}s - ${this.maxInterval/1000}s`);
        console.log(`   🔄 Intervalo lotes: ${this.batchDelayMin/1000}s - ${this.batchDelayMax/1000}s`);
    }

    // Configurar gerenciador de estado para persistência
    setStateManager(stateManager, stateId) {
        this.stateManager = stateManager;
        this.stateId = stateId;
        console.log(`💾 State manager configurado: campanha ${stateId}`);
    }

    // 🎭 NOVO: Configurar variações de mensagem
    setupMessageVariations(originalMessage) {
        try {
            console.log('🎭 Gerando variações da mensagem para evitar detecção de spam...');
            this.messageVariations = this.variationGenerator.generateVariations(originalMessage);
            console.log(`✅ ${this.messageVariations.length} variações criadas com sucesso`);
            
            // Log das variações para monitoramento (primeiros 50 caracteres)
            this.messageVariations.forEach((variation, index) => {
                console.log(`📝 Variação ${index + 1}: ${variation.substring(0, 50)}...`);
            });
            
            this.variationIndex = 0; // Reset do índice
            return true;
        } catch (error) {
            console.error('❌ Erro ao gerar variações:', error);
            this.messageVariations = [originalMessage]; // Fallback para mensagem original
            return false;
        }
    }

    // 🎭 NOVO: Obter próxima variação da mensagem
    getNextMessageVariation() {
        if (this.messageVariations.length === 0) {
            return null;
        }
        
        const variation = this.messageVariations[this.variationIndex];
        this.variationIndex = (this.variationIndex + 1) % this.messageVariations.length;
        
        return {
            message: variation,
            variationNumber: (this.variationIndex === 0 ? this.messageVariations.length : this.variationIndex)
        };
    }
    
    // Método para resumir campanha do ponto onde parou
    async resumeCampaign(numbers, message, sessionName, client, startFromBatch = 0) {
        try {
            console.log(`🔄 Resumindo campanha do lote ${startFromBatch + 1}...`);
            
            // Criar lotes a partir do ponto de parada
            const allBatches = this.createBatches(numbers, this.batchSize);
            const remainingBatches = allBatches.slice(startFromBatch);
            
            console.log(`📦 Processando ${remainingBatches.length} lotes restantes`);
            
            const results = {
                totalNumbers: numbers.length,
                totalBatches: allBatches.length,
                processedBatches: startFromBatch,
                successCount: 0,
                failedCount: 0,
                duplicateCount: 0,
                startTime: new Date(),
                batches: []
            };
            
            // Processar lotes restantes
            for (let i = 0; i < remainingBatches.length; i++) {
                const batch = remainingBatches[i];
                const batchNumber = startFromBatch + i + 1;
                
                console.log(`\n🔄 Processando lote ${batchNumber}/${allBatches.length} (${batch.length} números)...`);
                
                try {
                    const batchResult = await this.processBatchReal(batch, message, sessionName, batchNumber, client);
                    results.batches.push(batchResult);
                    results.successCount += batchResult.sent;
                    results.failedCount += batchResult.failed;
                    results.duplicateCount += batchResult.duplicates;
                    results.processedBatches++;
                    
                    // Atualizar estado
                    if (this.stateManager && this.stateId) {
                        await this.stateManager.updateBatchStatus(this.stateId, batchNumber, {
                            sent: batchResult.sent,
                            failed: batchResult.failed,
                            duplicates: batchResult.duplicates,
                            success: true
                        });
                        
                        await this.stateManager.updateCampaignProgress(this.stateId, {
                            currentBatch: batchNumber,
                            processedNumbers: results.processedBatches * this.batchSize,
                            successCount: results.successCount,
                            failedCount: results.failedCount,
                            duplicateCount: results.duplicateCount
                        });
                    }
                    
                    console.log(`✅ Lote ${batchNumber} concluído: ${batchResult.sent} enviadas, ${batchResult.failed} falhas`);
                    
                    // Delay entre lotes
                    if (i < remainingBatches.length - 1) {
                        const delay = this.calculateBatchDelay();
                        console.log(`⏳ Aguardando ${Math.round(delay/1000)}s antes do próximo lote...`);
                        await this.sleep(delay);
                    }
                    
                } catch (error) {
                    console.error(`❌ Erro no lote ${batchNumber}:`, error.message);
                    
                    if (this.stateManager && this.stateId) {
                        await this.stateManager.updateBatchStatus(this.stateId, batchNumber, {
                            sent: 0,
                            failed: batch.length,
                            duplicates: 0,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                // Progresso
                const progress = ((i + 1) / remainingBatches.length * 100).toFixed(1);
                console.log(`📈 Progresso do recovery: ${progress}% (${i + 1}/${remainingBatches.length} lotes)`);
            }
            
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            
            // Marcar como concluída
            if (this.stateManager && this.stateId) {
                await this.stateManager.completeCampaign(this.stateId);
                console.log(`💾 Recovery da campanha ${this.stateId} concluído`);
            }
            
            this.printFinalReport(results);
            return results;
            
        } catch (error) {
            console.error('❌ Erro no resumo da campanha:', error);
            throw error;
        }
    }

    async processLargeCampaign(filePath, message, sessionName = 'sales') {
        try {
            console.log('📂 Iniciando processamento de campanha grande...');
            console.log(`📁 Arquivo: ${path.basename(filePath)}`);
            
            // Ler e validar arquivo
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
            
            this.totalCount = lines.length;
            console.log(`📊 Total de números encontrados: ${this.totalCount}`);
            
            // Validar números
            const validNumbers = this.validateNumbers(lines);
            console.log(`✅ Números válidos: ${validNumbers.length}`);
            console.log(`❌ Números inválidos: ${this.totalCount - validNumbers.length}`);
            
            if (validNumbers.length === 0) {
                throw new Error('Nenhum número válido encontrado no arquivo');
            }
            
            // Processar em lotes
            const batches = this.createBatches(validNumbers, this.batchSize);
            console.log(`📦 Dividido em ${batches.length} lotes de até ${this.batchSize} números`);
            
            const results = {
                totalNumbers: validNumbers.length,
                totalBatches: batches.length,
                processedBatches: 0,
                successCount: 0,
                failedCount: 0,
                duplicateCount: 0,
                estimatedTime: this.estimateProcessingTime(validNumbers.length),
                startTime: new Date(),
                batches: []
            };
            
            // Processar cada lote
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchNumber = i + 1;
                
                console.log(`\n🔄 Processando lote ${batchNumber}/${batches.length} (${batch.length} números)...`);
                
                try {
                    const batchResult = await this.processBatch(batch, message, sessionName, batchNumber);
                    results.batches.push(batchResult);
                    results.successCount += batchResult.sent;
                    results.failedCount += batchResult.failed;
                    results.duplicateCount += batchResult.duplicates;
                    results.processedBatches++;
                    
                    console.log(`✅ Lote ${batchNumber} concluído: ${batchResult.sent} enviadas, ${batchResult.failed} falhas, ${batchResult.duplicates} duplicatas`);
                    
                    // Aguardar entre lotes para não sobrecarregar o sistema
                    if (i < batches.length - 1) {
                        const delay = this.calculateBatchDelay();
                        console.log(`⏳ Aguardando ${delay/1000}s antes do próximo lote...`);
                        await this.sleep(delay);
                    }
                    
                } catch (error) {
                    console.error(`❌ Erro no lote ${batchNumber}:`, error.message);
                    results.batches.push({
                        batchNumber,
                        numbers: batch.length,
                        sent: 0,
                        failed: batch.length,
                        duplicates: 0,
                        error: error.message
                    });
                    results.failedCount += batch.length;
                }
                
                // Exibir progresso
                const progress = ((i + 1) / batches.length * 100).toFixed(1);
                console.log(`📈 Progresso geral: ${progress}% (${i + 1}/${batches.length} lotes)`);
            }
            
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            
            // Relatório final
            console.log('\n' + '='.repeat(60));
            console.log('📊 RELATÓRIO FINAL DA CAMPANHA');
            console.log('='.repeat(60));
            console.log(`📱 Números processados: ${results.totalNumbers}`);
            console.log(`📦 Lotes processados: ${results.processedBatches}/${results.totalBatches}`);
            console.log(`✅ Mensagens enviadas: ${results.successCount}`);
            console.log(`❌ Falhas: ${results.failedCount}`);
            console.log(`🔄 Duplicatas ignoradas: ${results.duplicateCount}`);
            console.log(`⏱️ Tempo total: ${Math.round(results.duration / 1000)}s`);
            console.log(`📈 Taxa de sucesso: ${((results.successCount / results.totalNumbers) * 100).toFixed(1)}%`);
            console.log('='.repeat(60));
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro no processamento da campanha:', error);
            throw error;
        }
    }
    
    async processLargeCampaignArray(numbers, message, sessionName = 'sales', client = null) {
        try {
            console.log('📂 Iniciando processamento de campanha grande (array)...');
            console.log(`📊 Total de números: ${numbers.length}`);
            
            if (!client) {
                throw new Error('Cliente WhatsApp não fornecido para envio real');
            }
            
            // Validar números
            const validNumbers = this.validateNumbers(numbers);
            console.log(`✅ Números válidos: ${validNumbers.length}`);
            console.log(`❌ Números inválidos: ${numbers.length - validNumbers.length}`);
            
            if (validNumbers.length === 0) {
                throw new Error('Nenhum número válido encontrado');
            }
            
            // Processar em lotes
            const batches = this.createBatches(validNumbers, this.batchSize);
            console.log(`📦 Dividido em ${batches.length} lotes de até ${this.batchSize} números`);
            
            const results = {
                totalNumbers: validNumbers.length,
                totalBatches: batches.length,
                processedBatches: 0,
                successCount: 0,
                failedCount: 0,
                duplicateCount: 0,
                estimatedTime: this.estimateProcessingTime(validNumbers.length),
                startTime: new Date(),
                batches: []
            };

            // Criar estado persistente se stateManager estiver disponível
            if (this.stateManager && !this.stateId) {
                this.stateId = await this.stateManager.createCampaignState({
                    campaignId: 1, // Pode ser passado como parâmetro
                    sessionName: sessionName,
                    totalNumbers: validNumbers.length,
                    totalBatches: batches.length,
                    message: message,
                    batchSize: this.batchSize,
                    numbersPerBatch: this.batchSize
                });
                console.log(`💾 Estado da campanha criado: ID ${this.stateId}`);
            }
            
            // Processar cada lote
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchNumber = i + 1;
                
                console.log(`\n🔄 Processando lote ${batchNumber}/${batches.length} (${batch.length} números)...`);
                
                try {
                    // ENVIO REAL usando o cliente WhatsApp
                    const batchResult = await this.processBatchReal(batch, message, sessionName, batchNumber, client);
                    results.batches.push(batchResult);
                    results.successCount += batchResult.sent;
                    results.failedCount += batchResult.failed;
                    results.duplicateCount += batchResult.duplicates;
                    results.processedBatches++;
                    
                    // Atualizar estado persistente
                    if (this.stateManager && this.stateId) {
                        await this.stateManager.updateBatchStatus(this.stateId, batchNumber, {
                            sent: batchResult.sent,
                            failed: batchResult.failed,
                            duplicates: batchResult.duplicates,
                            success: true
                        });
                        
                        await this.stateManager.updateCampaignProgress(this.stateId, {
                            currentBatch: batchNumber,
                            processedNumbers: results.processedBatches * this.batchSize,
                            successCount: results.successCount,
                            failedCount: results.failedCount,
                            duplicateCount: results.duplicateCount
                        });
                    }
                    
                    console.log(`✅ Lote ${batchNumber} concluído: ${batchResult.sent} enviadas, ${batchResult.failed} falhas, ${batchResult.duplicates} duplicatas`);
                    
                    // Aguardar entre lotes
                    if (i < batches.length - 1) {
                        const delay = this.calculateBatchDelay();
                        console.log(`⏳ Aguardando ${Math.round(delay/1000)}s antes do próximo lote...`);
                        await this.sleep(delay);
                    }
                    
                } catch (error) {
                    console.error(`❌ Erro no lote ${batchNumber}:`, error.message);
                    
                    const errorResult = {
                        batchNumber,
                        numbers: batch.length,
                        sent: 0,
                        failed: batch.length,
                        duplicates: 0,
                        error: error.message
                    };
                    
                    results.batches.push(errorResult);
                    results.failedCount += batch.length;
                    
                    // Atualizar estado com erro
                    if (this.stateManager && this.stateId) {
                        await this.stateManager.updateBatchStatus(this.stateId, batchNumber, {
                            sent: 0,
                            failed: batch.length,
                            duplicates: 0,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                // Exibir progresso
                const progress = ((i + 1) / batches.length * 100).toFixed(1);
                console.log(`📈 Progresso geral: ${progress}% (${i + 1}/${batches.length} lotes)`);
            }
            
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            
            // Marcar campanha como concluída
            if (this.stateManager && this.stateId) {
                await this.stateManager.completeCampaign(this.stateId);
                console.log(`💾 Campanha ${this.stateId} marcada como concluída`);
            }
            
            // Relatório final
            this.printFinalReport(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro no processamento da campanha:', error);
            throw error;
        }
    }
    
    async processBatchReal(numbers, message, sessionName, batchNumber, client) {
        // ENVIO REAL para WhatsApp
        try {
            console.log(`📱 Enviando lote ${batchNumber} com ${numbers.length} números...`);
            
            // 🎭 CONFIGURAR VARIAÇÕES DE MENSAGEM se ainda não foi feito
            if (this.messageVariations.length === 0) {
                this.setupMessageVariations(message);
            }
            
            let sent = 0;
            let failed = 0;
            let duplicates = 0;
            
            for (let i = 0; i < numbers.length; i++) {
                const number = numbers[i];
                const formattedNumber = `${number}@c.us`;
                
                try {
                    // Verificar duplicata antes de enviar
                    const isDuplicate = await this.checkDuplicate(number);
                    if (isDuplicate) {
                        duplicates++;
                        console.log(`🔄 ${sessionName} - Número ${number} já enviado - IGNORANDO`);
                        continue;
                    }
                    
                    // 🎭 USAR VARIAÇÃO DA MENSAGEM
                    const messageVariation = this.getNextMessageVariation();
                    const messageToSend = messageVariation ? messageVariation.message : message;
                    const variationUsed = messageVariation ? messageVariation.variationNumber : 1;
                    
                    console.log(`🎭 ${sessionName} - Usando variação ${variationUsed} para ${number}`);
                    
                    // Enviar mensagem com variação
                    await client.sendText(formattedNumber, messageToSend);
                    sent++;
                    
                    // Registrar no banco de dados com informação da variação
                    await this.recordSentNumber(number, batchNumber, {
                        message_template: message,
                        message_sent: messageToSend,
                        variation_used: variationUsed
                    });
                    
                    console.log(`✅ ${sessionName} - Enviado ${i + 1}/${numbers.length}: ${number} (Variação ${variationUsed})`);
                    
                    // Delay entre mensagens usando configurações dinâmicas - PROTEÇÃO ANTI-SPAM
                    const messageDelay = Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
                    await this.sleep(messageDelay);
                    
                } catch (error) {
                    failed++;
                    console.error(`❌ ${sessionName} - Falha ao enviar para ${number}:`, error.message);
                }
            }
            
            return {
                batchNumber,
                numbers: numbers.length,
                sent,
                failed,
                duplicates,
                processed: true
            };
            
        } catch (error) {
            console.error(`❌ Erro no lote ${batchNumber}:`, error);
            throw error;
        }
    }
    
    async checkDuplicate(number) {
        // Verificar se número já foi enviado usando sistema existente
        try {
            // Usar campaignControl se estiver disponível
            if (this.campaignControl && this.campaignControl.isInCooldown) {
                const isInCooldown = this.campaignControl.isInCooldown(number);
                if (isInCooldown) {
                    return true; // É duplicata/em cooldown
                }
            }
            
            // Usar tracker direto se estiver disponível
            if (this.tracker && this.tracker.checkIfAlreadySent) {
                const alreadySent = await this.tracker.checkIfAlreadySent(null, number, '24h');
                if (alreadySent) {
                    return true; // É duplicata
                }
            }
            
            return false; // Não é duplicata
        } catch (error) {
            console.error('❌ Erro ao verificar duplicata:', error);
            return false; // Em caso de erro, assumir que não é duplicata
        }
    }
    
    async recordSentNumber(number, campaignId, extraData = {}) {
        // Registrar número enviado usando sistema existente
        try {
            // ÚNICA CHAMADA: Usar apenas campaignControl.markCampaignSent 
            if (this.campaignControl && this.campaignControl.markCampaignSent) {
                await this.campaignControl.markCampaignSent(number, { 
                    campaignId: campaignId,
                    session: 'batch_with_variations',
                    timestamp: new Date().toISOString(),
                    sent_via: 'CampaignBatchProcessor',
                    ...extraData // Incluir dados extras como variação usada
                });
                console.log(`💾 Registrado envio: ${number} (campanha: ${campaignId})`);
            } else {
                console.log(`⚠️ CampaignControl não disponível para ${number}`);
            }
            
            // REMOVIDO: Chamada duplicada para tracker.markCampaignSent que não existe
            
        } catch (error) {
            console.error('❌ Erro ao registrar envio:', error);
        }
    }
    
    printFinalReport(results) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO FINAL DA CAMPANHA EM LOTES');
        console.log('='.repeat(60));
        console.log(`📱 Números processados: ${results.totalNumbers}`);
        console.log(`📦 Lotes processados: ${results.processedBatches}/${results.totalBatches}`);
        console.log(`✅ Mensagens enviadas: ${results.successCount}`);
        console.log(`❌ Falhas: ${results.failedCount}`);
        console.log(`🔄 Duplicatas ignoradas: ${results.duplicateCount}`);
        console.log(`⏱️ Tempo total: ${Math.round(results.duration / 1000)}s`);
        console.log(`📈 Taxa de sucesso: ${((results.successCount / results.totalNumbers) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
    }
    
    validateNumbers(lines) {
        const validNumbers = [];
        const phoneRegex = /^(\+?55)?[\s\-\.]?[\(]?(\d{2})[\)]?[\s\-\.]?(\d{4,5})[\s\-\.]?(\d{4})$/;
        
        for (const line of lines) {
            let cleanNumber = line.replace(/[^\d+]/g, '');
            
            // Remover + se existir e adicionar 55 se necessário
            if (cleanNumber.startsWith('+')) {
                cleanNumber = cleanNumber.substring(1);
            }
            
            if (!cleanNumber.startsWith('55') && cleanNumber.length >= 10) {
                cleanNumber = '55' + cleanNumber;
            }
            
            // Validar formato
            if (phoneRegex.test(cleanNumber) && cleanNumber.length >= 12 && cleanNumber.length <= 13) {
                validNumbers.push(cleanNumber);
            }
        }
        
        // Remover duplicatas
        return [...new Set(validNumbers)];
    }
    
    createBatches(numbers, batchSize) {
        const batches = [];
        for (let i = 0; i < numbers.length; i += batchSize) {
            batches.push(numbers.slice(i, i + batchSize));
        }
        return batches;
    }
    
    async processBatch(numbers, message, sessionName, batchNumber) {
        // Esta função será integrada com o sistema de envio existente
        try {
            // Simular o envio (substituir pela integração real)
            const sent = numbers.length; // Temporário
            const failed = 0;
            const duplicates = 0;
            
            return {
                batchNumber,
                numbers: numbers.length,
                sent,
                failed,
                duplicates,
                processed: true
            };
        } catch (error) {
            throw error;
        }
    }
    
    estimateProcessingTime(totalNumbers) {
        // Estimativa baseada em 1 mensagem por segundo + delays
        const messagesPerSecond = 0.5; // Conservador para incluir delays
        const seconds = totalNumbers / messagesPerSecond;
        const minutes = Math.round(seconds / 60);
        return { seconds, minutes };
    }
    
    calculateBatchDelay() {
        // Delay entre lotes usando configurações dinâmicas - PROTEÇÃO ANTI-SPAM
        return Math.random() * (this.batchDelayMax - this.batchDelayMin) + this.batchDelayMin;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CampaignBatchProcessor;

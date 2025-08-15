const CampaignStateManager = require('./campaign-state-manager');
const CampaignBatchProcessor = require('../modules/CampaignBatchProcessor');

class CampaignRecoveryManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.activeRecoveries = new Map();
        
        console.log('🔄 Sistema de Recovery de Campanhas inicializado');
    }

    // Verificar campanhas interrompidas na inicialização
    async checkForInterruptedCampaigns(sessionName = null, client = null) {
        try {
            console.log(`🔍 Verificando campanhas interrompidas para sessão: ${sessionName || 'todas'}...`);
            
            const interruptedCampaigns = await this.stateManager.findInterruptedCampaigns(sessionName);
            
            if (interruptedCampaigns.length === 0) {
                console.log('✅ Nenhuma campanha interrompida encontrada');
                return;
            }

            console.log(`🔄 Encontradas ${interruptedCampaigns.length} campanhas interrompidas`);
            
            // Se há client disponível, executar recovery imediatamente
            if (client && sessionName) {
                await this.executeRecovery(sessionName, client);
            } else {
                // Caso contrário, agendar para quando a sessão reconectar
                for (const campaign of interruptedCampaigns) {
                    console.log(`📊 Campanha ${campaign.id}: ${campaign.completed_batches || 0}/${campaign.total_batches} lotes concluídos`);
                    this.scheduleRecovery(campaign);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao verificar campanhas interrompidas:', error);
        }
    }

    // Agendar recovery para quando a sessão reconectar
    scheduleRecovery(campaign) {
        const sessionName = campaign.session_name;
        
        if (!this.activeRecoveries.has(sessionName)) {
            this.activeRecoveries.set(sessionName, []);
        }
        
        this.activeRecoveries.get(sessionName).push(campaign);
        
        console.log(`📋 Recovery agendado para sessão ${sessionName}: Campanha ${campaign.id}`);
    }

    // Executar recovery quando uma sessão reconectar
    async executeRecovery(sessionName, client) {
        try {
            const pendingRecoveries = this.activeRecoveries.get(sessionName);
            
            if (!pendingRecoveries || pendingRecoveries.length === 0) {
                return;
            }

            console.log(`🔄 Executando recovery para sessão ${sessionName}...`);

            for (const campaign of pendingRecoveries) {
                await this.recoverCampaign(campaign, client);
            }

            // Limpar recoveries processados
            this.activeRecoveries.delete(sessionName);
            
        } catch (error) {
            console.error(`❌ Erro no recovery da sessão ${sessionName}:`, error);
        }
    }

    // Recuperar uma campanha específica
    async recoverCampaign(campaignState, client) {
        try {
            const stateId = campaignState.id;
            const sessionName = campaignState.session_name;
            
            console.log(`🔄 Recuperando campanha ${stateId} da sessão ${sessionName}...`);
            
            // Buscar detalhes completos da campanha
            const details = await this.stateManager.getCampaignDetails(stateId);
            if (!details) {
                console.error(`❌ Detalhes da campanha ${stateId} não encontrados`);
                return;
            }

            const { campaign, batches } = details;
            
            // Verificar qual lote deve ser processado
            const nextBatch = await this.stateManager.getNextBatch(stateId);
            if (!nextBatch) {
                console.log(`✅ Campanha ${stateId} já está concluída`);
                await this.stateManager.completeCampaign(stateId);
                return;
            }

            console.log(`📊 Recuperando do lote ${nextBatch.batch_number}/${campaign.total_batches}`);
            console.log(`📈 Progresso anterior: ${campaign.success_count} enviadas, ${campaign.failed_count} falhas`);

            // Criar processador de lotes com configurações atualizadas
            const batchProcessor = new CampaignBatchProcessor({
                batchSize: campaign.batch_size || 300,
                minInterval: 4000,
                maxInterval: 10000,
                batchDelayMin: 15000,
                batchDelayMax: 30000
            });

            // Configurar state manager para persistência
            batchProcessor.setStateManager(this.stateManager, stateId);

            // Buscar números já enviados para evitar duplicatas
            const alreadySent = await this.getAlreadySentNumbers(stateId);
            
            // Recuperar números originais da campanha
            const originalNumbers = await this.reconstructNumbersList(campaign, batches, alreadySent);
            
            if (originalNumbers.length === 0) {
                console.log(`✅ Campanha ${stateId} - todos os números já foram processados`);
                await this.stateManager.completeCampaign(stateId);
                return;
            }

            console.log(`🔄 Continuando processamento: ${originalNumbers.length} números restantes`);

            // Continuar processamento do ponto onde parou
            const result = await batchProcessor.resumeCampaign(
                originalNumbers,
                campaign.message,
                sessionName,
                client,
                nextBatch.batch_number - 1 // Índice do último lote processado
            );

            console.log(`✅ Recovery da campanha ${stateId} concluído!`);
            console.log(`📊 Resultado final: ${result.successCount} enviadas, ${result.failedCount} falhas`);

        } catch (error) {
            console.error(`❌ Erro ao recuperar campanha ${campaignState.id}:`, error);
        }
    }

    // Buscar números já enviados para evitar duplicatas
    async getAlreadySentNumbers(stateId) {
        try {
            const query = `
                SELECT DISTINCT phone_number 
                FROM sent_numbers 
                WHERE campaign_id = $1
            `;
            
            const result = await this.stateManager.db.query(query, [stateId]);
            return result.map(row => row.phone_number);
        } catch (error) {
            console.error('❌ Erro ao buscar números já enviados:', error);
            return [];
        }
    }

    // Reconstruir lista de números não processados
    async reconstructNumbersList(campaign, batches, alreadySent) {
        try {
            // Para uma implementação completa, seria necessário armazenar a lista original
            // Por agora, vamos usar uma abordagem baseada nos números já enviados
            
            // Buscar todos os números da campanha original
            const query = `
                SELECT DISTINCT phone_number 
                FROM sent_numbers 
                WHERE campaign_id = $1
                ORDER BY phone_number
            `;
            
            const result = await this.stateManager.db.query(query, [campaign.id]);
            
            // Se não há números enviados, retornar lista vazia para indicar que precisa da lista original
            if (result.length === 0) {
                console.log('⚠️ Nenhum número encontrado na tabela sent_numbers. Lista original necessária.');
                return [];
            }
            
            // Se há números enviados, assumir que são todos os números originais
            // Filtrar números já processados
            const allNumbers = result.map(row => row.phone_number);
            const pendingNumbers = allNumbers.filter(num => !alreadySent.includes(num));
            
            console.log(`📋 Números reconstruídos: ${allNumbers.length} total, ${pendingNumbers.length} pendentes`);
            return pendingNumbers;
        } catch (error) {
            console.error('❌ Erro ao reconstruir lista de números:', error);
            return [];
        }
    }

    // Verificar se existe recovery pendente para uma sessão
    hasPendingRecovery(sessionName) {
        return this.activeRecoveries.has(sessionName) && 
               this.activeRecoveries.get(sessionName).length > 0;
    }

    // Obter estatísticas de recovery
    getRecoveryStats() {
        const stats = {
            pendingSessions: this.activeRecoveries.size,
            totalPendingCampaigns: 0
        };

        for (const [sessionName, campaigns] of this.activeRecoveries) {
            stats.totalPendingCampaigns += campaigns.length;
        }

        return stats;
    }

    // Limpar recoveries antigos
    async cleanupOldRecoveries() {
        try {
            // Limpar campanhas antigas do state manager
            await this.stateManager.cleanupOldCampaigns();
            
            // Limpar recoveries em memória que são muito antigos
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas
            
            for (const [sessionName, campaigns] of this.activeRecoveries) {
                const validCampaigns = campaigns.filter(campaign => {
                    const campaignAge = now - new Date(campaign.created_at).getTime();
                    return campaignAge < maxAge;
                });
                
                if (validCampaigns.length === 0) {
                    this.activeRecoveries.delete(sessionName);
                } else {
                    this.activeRecoveries.set(sessionName, validCampaigns);
                }
            }
            
            console.log('🧹 Cleanup de recoveries antigos concluído');
        } catch (error) {
            console.error('❌ Erro no cleanup de recoveries:', error);
        }
    }
}

module.exports = CampaignRecoveryManager;

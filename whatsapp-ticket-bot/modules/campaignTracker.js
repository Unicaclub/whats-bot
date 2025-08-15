// =====================================================
// SISTEMA DE TRACKING DE CAMPANHAS
// Módulo principal para rastreamento de envios com PostgreSQL
// =====================================================

const { getDatabase } = require('../database/manager-postgresql');

class CampaignTracker {
    constructor() {
        this.db = getDatabase();
        this.activeCampaigns = new Map(); // Cache de campanhas ativas
        this.recentSends = new Map(); // Cache de envios recentes para performance
        this.blacklistCache = new Set(); // Cache da blacklist
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Inicializando sistema de tracking...');
            
            // Carregar blacklist em cache
            await this.loadBlacklistCache();
            
            // Carregar campanhas ativas
            await this.loadActiveCampaigns();
            
            // Iniciar limpeza automática
            this.startCleanupTimer();
            
            console.log('✅ Sistema de tracking inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar tracking:', error);
        }
    }

    async loadBlacklistCache() {
        try {
            const blacklistedNumbers = await this.db.query(
                'SELECT phone_number FROM blacklist WHERE is_active = TRUE'
            );
            
            this.blacklistCache = new Set(blacklistedNumbers.map(row => row.phone_number));
            console.log(`🚫 ${this.blacklistCache.size} números carregados na blacklist`);
        } catch (error) {
            console.error('❌ Erro ao carregar blacklist:', error);
        }
    }

    async loadActiveCampaigns() {
        try {
            const campaigns = await this.db.query(
                "SELECT * FROM campaigns WHERE status IN ('ativa', 'rascunho') ORDER BY created_at DESC"
            );
            
            this.activeCampaigns.clear();
            campaigns.forEach(campaign => {
                this.activeCampaigns.set(campaign.id, campaign);
            });
            
            console.log(`📢 ${campaigns.length} campanhas ativas carregadas`);
        } catch (error) {
            console.error('❌ Erro ao carregar campanhas:', error);
        }
    }

    // =====================================================
    // MÉTODOS PRINCIPAIS DE TRACKING
    // =====================================================

    async createCampaign(campaignData) {
        try {
            const campaignId = await this.db.createCampaign(campaignData);
            
            // Adicionar ao cache
            const campaign = await this.db.getCampaign(campaignId);
            this.activeCampaigns.set(campaignId, campaign);
            
            // Log da criação
            await this.db.logAction('campaign', 'CAMPAIGN_CREATED', 
                `Campanha '${campaignData.name}' criada`, campaignId);
            
            return campaignId;
        } catch (error) {
            console.error('❌ Erro ao criar campanha:', error);
            throw error;
        }
    }

    async startCampaign(campaignId) {
        try {
            await this.db.updateCampaignStatus(campaignId, 'ativa');
            
            // Atualizar cache
            const campaign = await this.db.getCampaign(campaignId);
            this.activeCampaigns.set(campaignId, campaign);
            
            await this.db.logAction('campaign', 'CAMPAIGN_STARTED', 
                `Campanha iniciada`, campaignId);
            
            console.log(`🚀 Campanha ${campaignId} iniciada`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao iniciar campanha:', error);
            throw error;
        }
    }

    async finishCampaign(campaignId) {
        try {
            await this.db.updateCampaignStatus(campaignId, 'finalizada');
            
            // Remover do cache de ativas
            this.activeCampaigns.delete(campaignId);
            
            await this.db.logAction('campaign', 'CAMPAIGN_FINISHED', 
                `Campanha finalizada`, campaignId);
            
            console.log(`✅ Campanha ${campaignId} finalizada`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao finalizar campanha:', error);
            throw error;
        }
    }

    // =====================================================
    // VERIFICAÇÃO E VALIDAÇÃO DE ENVIOS
    // =====================================================

    async canSendToNumber(campaignId, phoneNumber, checkDuplicates = true) {
        try {
            // 1. Verificar blacklist (cache)
            if (this.isBlacklisted(phoneNumber)) {
                return {
                    canSend: false,
                    reason: 'blacklisted',
                    message: 'Número está na blacklist'
                };
            }

            // 2. Verificar duplicatas se solicitado
            if (checkDuplicates) {
                const alreadySent = await this.checkIfAlreadySent(campaignId, phoneNumber, '24h');
                if (alreadySent) {
                    return {
                        canSend: false,
                        reason: 'duplicate',
                        message: 'Número já recebeu mensagem nas últimas 24h'
                    };
                }
            }

            // 3. Verificar limite diário do número
            const dailyLimit = await this.checkDailyLimit(phoneNumber);
            if (!dailyLimit.canSend) {
                return dailyLimit;
            }

            return {
                canSend: true,
                reason: 'approved',
                message: 'Número aprovado para envio'
            };

        } catch (error) {
            console.error('❌ Erro ao verificar número:', error);
            return {
                canSend: false,
                reason: 'error',
                message: 'Erro na verificação: ' + error.message
            };
        }
    }

    // Método público para verificar se número já foi enviado
    async checkIfAlreadySent(campaignId, phoneNumber, timeWindow = '24h') {
        try {
            return await this.db.checkIfAlreadySent(campaignId, phoneNumber, timeWindow);
        } catch (error) {
            console.error('❌ Erro ao verificar duplicata:', error);
            return false;
        }
    }

    async checkDailyLimit(phoneNumber, maxPerDay = 3) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const todayCount = await this.db.queryOne(`
                SELECT COUNT(*) as count 
                FROM sent_numbers 
                WHERE phone_number = $1 AND DATE(sent_at) = $2
            `, [phoneNumber, today]);

            const count = todayCount?.count || 0;
            const canSend = count < maxPerDay;

            return {
                canSend,
                reason: canSend ? 'within_limit' : 'daily_limit_exceeded',
                message: canSend 
                    ? `Número pode receber (${count}/${maxPerDay} hoje)`
                    : `Limite diário excedido (${count}/${maxPerDay})`,
                count,
                limit: maxPerDay
            };
        } catch (error) {
            console.error('❌ Erro ao verificar limite diário:', error);
            return { canSend: false, reason: 'error', message: error.message };
        }
    }

    // =====================================================
    // REGISTRO DE ENVIOS
    // =====================================================

    async registerSentNumber(campaignId, phoneNumber, messageData = {}) {
        try {
            // Verificar se pode enviar
            const canSend = await this.canSendToNumber(campaignId, phoneNumber);
            if (!canSend.canSend) {
                console.log(`🚫 Envio negado para ${phoneNumber}: ${canSend.message}`);
                return {
                    success: false,
                    reason: canSend.reason,
                    message: canSend.message
                };
            }

            // Registrar o envio
            const sentData = {
                campaignId,
                phoneNumber,
                formattedNumber: this.formatPhoneNumber(phoneNumber),
                status: messageData.status || 'enviado',
                messageId: messageData.messageId,
                session: messageData.session || 'sales',
                ipAddress: messageData.ipAddress,
                userAgent: messageData.userAgent,
                notes: messageData.notes
            };

            const sentId = await this.db.registerSentNumber(sentData);

            if (sentId) {
                // Adicionar ao cache de recentes
                this.recentSends.set(`${campaignId}-${phoneNumber}`, Date.now());
                
                // Log do envio
                await this.db.logAction('campaign', 'NUMBER_SENT', 
                    `Número ${phoneNumber} enviado`, campaignId, phoneNumber);

                return {
                    success: true,
                    sentId,
                    message: 'Número registrado com sucesso'
                };
            } else {
                return {
                    success: false,
                    reason: 'duplicate',
                    message: 'Número já foi enviado nesta campanha'
                };
            }

        } catch (error) {
            console.error('❌ Erro ao registrar envio:', error);
            
            // Log do erro
            await this.db.logAction('error', 'SEND_ERROR', 
                `Erro ao enviar para ${phoneNumber}: ${error.message}`, campaignId, phoneNumber);

            return {
                success: false,
                reason: 'error',
                message: error.message
            };
        }
    }

    async updateSendStatus(sentId, status, errorMessage = null) {
        try {
            await this.db.updateSentNumberStatus(sentId, status, errorMessage);
            
            if (status === 'falhou' && errorMessage) {
                console.log(`❌ Envio ${sentId} falhou: ${errorMessage}`);
            } else if (status === 'entregue') {
                console.log(`✅ Envio ${sentId} confirmado como entregue`);
            }

            return true;
        } catch (error) {
            console.error('❌ Erro ao atualizar status:', error);
            return false;
        }
    }

    // =====================================================
    // GERENCIAMENTO DE RESPOSTAS
    // =====================================================

    async registerResponse(phoneNumber, campaignId, responseData) {
        try {
            // Encontrar o registro de envio
            const sentRecord = await this.db.queryOne(`
                SELECT id, campaign_id FROM sent_numbers 
                WHERE phone_number = $1 AND campaign_id = $2
                ORDER BY sent_at DESC LIMIT 1
            `, [phoneNumber, campaignId]);

            if (!sentRecord) {
                console.log(`⚠️ Registro de envio não encontrado para ${phoneNumber}`);
                return false;
            }

            // Detectar opt-out automaticamente
            const isOptOut = this.detectOptOut(responseData.content);
            if (isOptOut) {
                await this.addToBlacklist(phoneNumber, 'opt_out', campaignId);
            }

            // Registrar a resposta
            const responseId = await this.db.registerResponse(sentRecord.id, {
                campaignId,
                phoneNumber,
                content: responseData.content,
                type: responseData.type || 'texto',
                sentiment: this.detectSentiment(responseData.content),
                isOptOut
            });

            // Log da resposta
            await this.db.logAction('campaign', 'RESPONSE_RECEIVED', 
                `Resposta recebida de ${phoneNumber}`, campaignId, phoneNumber);

            console.log(`💬 Resposta registrada para ${phoneNumber} (ID: ${responseId})`);
            return responseId;

        } catch (error) {
            console.error('❌ Erro ao registrar resposta:', error);
            return false;
        }
    }

    detectOptOut(message) {
        const optOutKeywords = [
            'parar', 'stop', 'sair', 'remover', 'cancelar', 'descadastrar',
            'não quero', 'nao quero', 'pare', 'chega', 'basta'
        ];
        
        const lowerMessage = message.toLowerCase();
        return optOutKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    detectSentiment(message) {
        const lowerMessage = message.toLowerCase();
        
        // Palavras positivas
        const positive = ['obrigado', 'legal', 'ótimo', 'excelente', 'interessante', 'sim', 'quero'];
        if (positive.some(word => lowerMessage.includes(word))) {
            return 'positivo';
        }
        
        // Palavras negativas
        const negative = ['não', 'nao', 'ruim', 'péssimo', 'chato', 'spam'];
        if (negative.some(word => lowerMessage.includes(word))) {
            return 'negativo';
        }
        
        // Palavras de interesse
        const interested = ['preço', 'valor', 'quanto', 'como', 'quando', 'onde', 'info', 'informação'];
        if (interested.some(word => lowerMessage.includes(word))) {
            return 'interessado';
        }
        
        return 'neutro';
    }

    // =====================================================
    // GERENCIAMENTO DE BLACKLIST
    // =====================================================

    async addToBlacklist(phoneNumber, reason, campaignId = null) {
        try {
            const result = await this.db.addToBlacklist(phoneNumber, reason, campaignId);
            
            if (result) {
                // Atualizar cache
                this.blacklistCache.add(phoneNumber);
                
                // Log da ação
                await this.db.logAction('security', 'BLACKLIST_ADD', 
                    `Número ${phoneNumber} adicionado à blacklist (${reason})`, campaignId, phoneNumber);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Erro ao adicionar à blacklist:', error);
            return false;
        }
    }

    isBlacklisted(phoneNumber) {
        return this.blacklistCache.has(phoneNumber);
    }

    async removeFromBlacklist(phoneNumber) {
        try {
            const result = await this.db.removeFromBlacklist(phoneNumber);
            
            if (result > 0) {
                // Atualizar cache
                this.blacklistCache.delete(phoneNumber);
                
                // Log da ação
                await this.db.logAction('security', 'BLACKLIST_REMOVE', 
                    `Número ${phoneNumber} removido da blacklist`, null, phoneNumber);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Erro ao remover da blacklist:', error);
            return false;
        }
    }

    // =====================================================
    // RELATÓRIOS E ESTATÍSTICAS
    // =====================================================

    async getCampaignReport(campaignId) {
        try {
            const stats = await this.db.getCampaignStats(campaignId);
            const topResponders = await this.db.getTopResponders(campaignId, 10);
            
            // Estatísticas de horário
            const hourlyStats = await this.db.query(`
                SELECT 
                    EXTRACT(HOUR FROM sent_at) as hour,
                    COUNT(*) as sent_count,
                    SUM(CASE WHEN response_received = TRUE THEN 1 ELSE 0 END) as response_count
                FROM sent_numbers 
                WHERE campaign_id = $1
                GROUP BY EXTRACT(HOUR FROM sent_at)
                ORDER BY hour
            `, [campaignId]);

            return {
                campaign: stats,
                topResponders,
                hourlyStats,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            throw error;
        }
    }

    async getDashboardStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const stats = await this.db.queryOne(`
                SELECT 
                    COUNT(DISTINCT c.id) as total_campaigns,
                    SUM(c.total_sent) as total_sent_all_time,
                    SUM(c.total_delivered) as total_delivered_all_time,
                    SUM(c.total_responses) as total_responded_all_time,
                    COUNT(DISTINCT CASE WHEN DATE(sn.sent_at) = $1 THEN sn.id END) as sent_today,
                    COUNT(DISTINCT CASE WHEN DATE(sn.response_at) = $2 THEN sn.id END) as responses_today
                FROM campaigns c
                LEFT JOIN sent_numbers sn ON c.id = sn.campaign_id
            `, [today, today]);

            const blacklistCount = await this.db.queryOne(`
                SELECT COUNT(*) as count FROM blacklist WHERE is_active = TRUE
            `);

            return {
                ...stats,
                blacklist_count: blacklistCount?.count || 0,
                active_campaigns: this.activeCampaigns.size,
                updated_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    // =====================================================
    // UTILITÁRIOS
    // =====================================================

    formatPhoneNumber(number) {
        return this.db.formatPhoneNumber(number);
    }

    startCleanupTimer() {
        // Limpeza a cada 6 horas
        setInterval(async () => {
            try {
                // Limpar cache de envios recentes (manter apenas últimas 2 horas)
                const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
                for (const [key, timestamp] of this.recentSends.entries()) {
                    if (timestamp < twoHoursAgo) {
                        this.recentSends.delete(key);
                    }
                }

                // Recarregar blacklist
                await this.loadBlacklistCache();
                
                console.log('✅ Limpeza automática do tracking executada');
            } catch (error) {
                console.error('❌ Erro na limpeza automática:', error);
            }
        }, 6 * 60 * 60 * 1000); // 6 horas
    }

    async exportCampaignData(campaignId, format = 'json') {
        return await this.db.exportCampaignData(campaignId, format);
    }

    async getRecentActivity(limit = 50) {
        try {
            return await this.db.query(`
                SELECT 
                    sl.action,
                    sl.details,
                    sl.phone_number,
                    sl.created_at,
                    c.campaign_name
                FROM system_logs sl
                LEFT JOIN campaigns c ON sl.campaign_id = c.id
                WHERE sl.log_type IN ('campaign', 'security')
                ORDER BY sl.created_at DESC
                LIMIT ?
            `, [limit]);
        } catch (error) {
            console.error('❌ Erro ao obter atividade recente:', error);
            return [];
        }
    }
}

// =====================================================
// INSTÂNCIA SINGLETON
// =====================================================

let trackerInstance = null;

function getCampaignTracker() {
    if (!trackerInstance) {
        trackerInstance = new CampaignTracker();
    }
    return trackerInstance;
}

module.exports = {
    CampaignTracker,
    getCampaignTracker
};

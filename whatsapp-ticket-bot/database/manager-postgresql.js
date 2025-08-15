// =====================================================
// DATABASE MANAGER PARA POSTGRESQL
// Gerenciamento completo de campanhas WhatsApp
// =====================================================

require('dotenv').config();
const { Pool } = require('pg');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.connectionConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER || 'postgres',
            password: String(process.env.DB_PASSWORD || ''),
            database: process.env.DB_NAME || 'whatsapp_campaigns',
            max: 20, // máximo de conexões no pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            // Configurações específicas do PostgreSQL
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            timezone: 'UTC'
        };
        
        this.init();
    }

    async init() {
        try {
            await this.connect();
        } catch (error) {
            console.error('❌ Falha na inicialização do banco:', error);
        }
    }

    async connect() {
        try {
            if (this.isConnected && this.pool) {
                return this.pool;
            }

            console.log('🔌 Conectando ao PostgreSQL...');
            this.pool = new Pool(this.connectionConfig);
            
            // Testar conexão
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            this.isConnected = true;
            console.log('✅ Conectado ao PostgreSQL com sucesso');
            
            return this.pool;
        } catch (error) {
            console.error('❌ Erro ao conectar PostgreSQL:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.end();
                this.pool = null;
                this.isConnected = false;
                console.log('🔌 Desconectado do PostgreSQL');
            }
        } catch (error) {
            console.error('❌ Erro ao desconectar:', error);
        }
    }

    async query(text, params = []) {
        try {
            if (!this.pool) {
                await this.connect();
            }
            
            const result = await this.pool.query(text, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro na query PostgreSQL:', error);
            console.error('Query:', text);
            console.error('Params:', params);
            throw error;
        }
    }

    async queryOne(text, params = []) {
        try {
            const result = await this.query(text, params);
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('❌ Erro na queryOne:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.query('SELECT 1 as test');
            return true;
        } catch (error) {
            console.error('❌ Teste de conexão falhou:', error);
            return false;
        }
    }

    // =====================================================
    // MÉTODOS DE CAMPANHAS
    // =====================================================

    async createCampaign(campaignData) {
        try {
            const { 
                name, 
                message, 
                sessionName = 'sales',
                campaignType = 'promocional'
            } = campaignData;

            const result = await this.query(`
                INSERT INTO campaigns (
                    campaign_name, 
                    message_template, 
                    session_name, 
                    campaign_type,
                    status
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [name, message, sessionName, campaignType, 'rascunho']);

            const campaignId = result[0].id;
            
            // Log da criação
            await this.logAction('campaign', 'CAMPAIGN_CREATED', 
                `Campanha '${name}' criada`, campaignId);

            return campaignId;
        } catch (error) {
            console.error('❌ Erro ao criar campanha:', error);
            throw error;
        }
    }

    async getCampaign(campaignId) {
        try {
            return await this.queryOne(`
                SELECT * FROM campaigns WHERE id = $1
            `, [campaignId]);
        } catch (error) {
            console.error('❌ Erro ao buscar campanha:', error);
            throw error;
        }
    }

    async updateCampaignStatus(campaignId, status) {
        try {
            const timestampField = status === 'finalizada' ? 'completed_at' : null;
            
            let query = `UPDATE campaigns SET status = $1, updated_at = CURRENT_TIMESTAMP`;
            const params = [status];
            
            if (timestampField) {
                query += `, ${timestampField} = CURRENT_TIMESTAMP`;
            }
            
            query += ` WHERE id = $2`;
            params.push(campaignId);

            await this.query(query, params);
            return true;
        } catch (error) {
            console.error('❌ Erro ao atualizar status da campanha:', error);
            throw error;
        }
    }

    async getCampaignStats(campaignId) {
        try {
            return await this.queryOne(`
                SELECT * FROM v_campaign_statistics WHERE id = $1
            `, [campaignId]);
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    // =====================================================
    // MÉTODOS DE ENVIOS
    // =====================================================

    async registerSentNumber(sentData) {
        try {
            const {
                campaignId,
                phoneNumber,
                formattedNumber,
                status = 'enviado',
                messageId,
                session = 'sales',
                ipAddress,
                userAgent,
                notes
            } = sentData;

            // Verificar se já foi enviado
            const existing = await this.queryOne(`
                SELECT id FROM sent_numbers 
                WHERE campaign_id = $1 AND phone_number = $2
            `, [campaignId, phoneNumber]);

            if (existing) {
                return null; // Já foi enviado
            }

            const result = await this.query(`
                INSERT INTO sent_numbers (
                    campaign_id, 
                    phone_number, 
                    status, 
                    metadata
                ) VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [
                campaignId, 
                phoneNumber, 
                status, 
                JSON.stringify({
                    session: session,
                    sent_via: sentData.sent_via || 'campaign',
                    timestamp: new Date().toISOString(),
                    formatted_number: formattedNumber || this.formatPhoneNumber(phoneNumber),
                    message_id: messageId,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    notes: notes
                })
            ]);

            return result[0].id;
        } catch (error) {
            console.error('❌ Erro ao registrar envio:', error);
            throw error;
        }
    }

    async checkIfAlreadySent(campaignId, phoneNumber, timeWindow = '24h') {
        try {
            console.log(`🔍 Verificando duplicata: campaignId=${campaignId}, phone=${phoneNumber}, window=${timeWindow}`);
            
            // Converter timeWindow para PostgreSQL interval
            let interval = '24 HOURS';
            if (timeWindow === '1h') interval = '1 HOUR';
            else if (timeWindow === '12h') interval = '12 HOURS';
            else if (timeWindow === '48h') interval = '48 HOURS';
            else if (timeWindow === '7d') interval = '7 DAYS';
            
            const result = await this.queryOne(`
                SELECT id, sent_at, campaign_id FROM sent_numbers 
                WHERE phone_number = $1 
                AND ($2::integer IS NULL OR campaign_id = $2)
                AND sent_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
                ORDER BY sent_at DESC
                LIMIT 1
            `, [phoneNumber, campaignId]);

            const exists = result !== null;
            console.log(`🔍 Resultado verificação: ${exists ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
            
            if (result) {
                console.log(`   - ID: ${result.id}, Campanha: ${result.campaign_id}, Enviado: ${result.sent_at}`);
            }

            return exists;
        } catch (error) {
            console.error('❌ Erro ao verificar envio duplicado:', error);
            console.error('   - Parâmetros:', { campaignId, phoneNumber, timeWindow });
            throw error;
        }
    }

    async updateSentNumberStatus(sentId, status, errorMessage = null) {
        try {
            const timestampField = status === 'entregue' ? 'delivery_time' : 
                                  status === 'lido' ? 'read_time' : null;
            
            let query = `UPDATE sent_numbers SET status = $1`;
            const params = [status];
            let paramCount = 1;
            
            if (errorMessage) {
                query += `, error_message = $${++paramCount}`;
                params.push(errorMessage);
            }
            
            if (timestampField) {
                query += `, ${timestampField} = CURRENT_TIMESTAMP`;
            }
            
            query += ` WHERE id = $${++paramCount}`;
            params.push(sentId);

            await this.query(query, params);
            return true;
        } catch (error) {
            console.error('❌ Erro ao atualizar status do envio:', error);
            throw error;
        }
    }

    // =====================================================
    // MÉTODOS DE BLACKLIST
    // =====================================================

    async addToBlacklist(phoneNumber, reason, campaignId = null) {
        try {
            const result = await this.query(`
                INSERT INTO blacklist (phone_number, reason, campaign_id, is_active)
                VALUES ($1, $2, $3, TRUE)
                ON CONFLICT (phone_number) 
                DO UPDATE SET 
                    reason = EXCLUDED.reason,
                    updated_at = CURRENT_TIMESTAMP,
                    is_active = TRUE
                RETURNING id
            `, [phoneNumber, reason, campaignId]);

            return result.length > 0;
        } catch (error) {
            console.error('❌ Erro ao adicionar à blacklist:', error);
            throw error;
        }
    }

    async removeFromBlacklist(phoneNumber) {
        try {
            const result = await this.query(`
                UPDATE blacklist SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE phone_number = $1 AND is_active = TRUE
            `, [phoneNumber]);

            return result.rowCount > 0;
        } catch (error) {
            console.error('❌ Erro ao remover da blacklist:', error);
            throw error;
        }
    }

    async isBlacklisted(phoneNumber) {
        try {
            const result = await this.queryOne(`
                SELECT id FROM blacklist 
                WHERE phone_number = $1 AND is_active = TRUE
            `, [phoneNumber]);

            return result !== null;
        } catch (error) {
            console.error('❌ Erro ao verificar blacklist:', error);
            return false;
        }
    }

    // =====================================================
    // MÉTODOS DE RESPOSTAS
    // =====================================================

    async registerResponse(sentNumberId, responseData) {
        try {
            const {
                campaignId,
                phoneNumber,
                content,
                type = 'text',
                sentiment = 'neutro',
                isOptOut = false
            } = responseData;

            const result = await this.query(`
                INSERT INTO responses (
                    sent_number_id,
                    campaign_id,
                    phone_number,
                    message_content,
                    message_type,
                    sentiment,
                    is_opt_out
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [sentNumberId, campaignId, phoneNumber, content, type, sentiment, isOptOut]);

            // Marcar que recebeu resposta
            await this.query(`
                UPDATE sent_numbers 
                SET response_received = TRUE 
                WHERE id = $1
            `, [sentNumberId]);

            return result[0].id;
        } catch (error) {
            console.error('❌ Erro ao registrar resposta:', error);
            throw error;
        }
    }

    async getTopResponders(campaignId, limit = 10) {
        try {
            let query = `
                SELECT * FROM v_top_responders
            `;
            const params = [];
            
            if (campaignId) {
                query = `
                    SELECT 
                        r.phone_number,
                        COUNT(r.id) as total_responses,
                        AVG(CASE 
                            WHEN r.sentiment = 'positivo' THEN 1 
                            WHEN r.sentiment = 'interessado' THEN 0.8
                            WHEN r.sentiment = 'neutro' THEN 0.5 
                            WHEN r.sentiment = 'negativo' THEN 0.2 
                            ELSE 0.5 
                        END) as avg_sentiment_score,
                        MIN(r.received_at) as first_response,
                        MAX(r.received_at) as last_response
                    FROM responses r
                    WHERE r.campaign_id = $1 AND r.is_opt_out = FALSE
                    GROUP BY r.phone_number
                    ORDER BY total_responses DESC, avg_sentiment_score DESC
                `;
                params.push(campaignId);
            }
            
            query += ` LIMIT $${params.length + 1}`;
            params.push(limit);

            return await this.query(query, params);
        } catch (error) {
            console.error('❌ Erro ao buscar top responders:', error);
            throw error;
        }
    }

    // =====================================================
    // MÉTODOS DE LOGS
    // =====================================================

    async logAction(logType, action, details, campaignId = null, phoneNumber = null) {
        try {
            await this.query(`
                INSERT INTO system_logs (
                    level, 
                    message, 
                    metadata,
                    campaign_id, 
                    phone_number
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                logType, 
                `${action}: ${details}`, 
                JSON.stringify({ action, details }), 
                campaignId, 
                phoneNumber
            ]);

            return true;
        } catch (error) {
            console.error('❌ Erro ao registrar log:', error);
            return false;
        }
    }

    // =====================================================
    // MÉTODOS DE RELATÓRIOS
    // =====================================================

    async exportCampaignData(campaignId, format = 'csv') {
        try {
            const data = await this.query(`
                SELECT 
                    sn.phone_number,
                    sn.formatted_number,
                    sn.sent_at,
                    sn.status,
                    sn.response_received,
                    r.message_content as response_content,
                    r.sentiment,
                    r.received_at as response_time
                FROM sent_numbers sn
                LEFT JOIN responses r ON sn.id = r.sent_number_id
                WHERE sn.campaign_id = $1
                ORDER BY sn.sent_at
            `, [campaignId]);

            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            }

            if (format === 'csv') {
                const headers = 'phone_number,formatted_number,sent_at,status,response_received,response_content,sentiment,response_time\n';
                const csvData = data.map(row => {
                    return [
                        row.phone_number,
                        row.formatted_number,
                        row.sent_at,
                        row.status,
                        row.response_received,
                        (row.response_content || '').replace(/"/g, '""'),
                        row.sentiment || '',
                        row.response_time || ''
                    ].join(',');
                }).join('\n');
                
                return headers + csvData;
            }

            return data;
        } catch (error) {
            console.error('❌ Erro ao exportar dados:', error);
            throw error;
        }
    }

    // =====================================================
    // UTILITÁRIOS
    // =====================================================

    formatPhoneNumber(number) {
        // Remove caracteres especiais e garante formato brasileiro
        const cleaned = number.replace(/\D/g, '');
        
        if (cleaned.length === 11 && cleaned.startsWith('55')) {
            return cleaned;
        }
        
        if (cleaned.length === 11) {
            return '55' + cleaned;
        }
        
        if (cleaned.length === 10) {
            return '55' + cleaned;
        }
        
        return cleaned;
    }

    async getHealthCheck() {
        try {
            const dbTime = await this.queryOne('SELECT NOW() as current_time');
            const campaignCount = await this.queryOne('SELECT COUNT(*) as count FROM campaigns');
            const sentCount = await this.queryOne('SELECT COUNT(*) as count FROM sent_numbers WHERE sent_at > CURRENT_DATE');
            
            return {
                database: 'connected',
                currentTime: dbTime.current_time,
                totalCampaigns: campaignCount.count,
                sentToday: sentCount.count,
                poolSize: this.pool ? this.pool.totalCount : 0,
                activeConnections: this.pool ? this.pool.idleCount : 0
            };
        } catch (error) {
            console.error('❌ Erro no health check:', error);
            return {
                database: 'error',
                error: error.message
            };
        }
    }
}

// =====================================================
// INSTÂNCIA SINGLETON
// =====================================================

let databaseInstance = null;

function getDatabase() {
    if (!databaseInstance) {
        databaseInstance = new DatabaseManager();
    }
    return databaseInstance;
}

// Graceful shutdown
process.on('SIGINT', async () => {
    if (databaseInstance) {
        await databaseInstance.disconnect();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (databaseInstance) {
        await databaseInstance.disconnect();
    }
    process.exit(0);
});

module.exports = {
    DatabaseManager,
    getDatabase
};

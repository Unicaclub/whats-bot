// =====================================================
// MÓDULO DE CONEXÃO COM BANCO DE DADOS
// Sistema de tracking de campanhas WhatsApp
// =====================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_campaigns_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000,
            multipleStatements: true,
            charset: 'utf8mb4'
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('🗄️ Inicializando conexão com banco de dados...');
            
            // Criar pool de conexões
            this.pool = mysql.createPool(this.config);
            
            // Testar conexão
            await this.testConnection();
            
            // Criar banco se não existir
            await this.createDatabaseIfNotExists();
            
            // Executar schema se necessário
            await this.initializeSchema();
            
            this.isConnected = true;
            console.log('✅ Banco de dados inicializado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar banco de dados:', error);
            this.isConnected = false;
        }
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            console.log('✅ Conexão com MySQL estabelecida');
        } catch (error) {
            throw new Error(`Falha na conexão: ${error.message}`);
        }
    }

    async createDatabaseIfNotExists() {
        try {
            // Conectar sem especificar database
            const tempConfig = { ...this.config };
            delete tempConfig.database;
            const tempPool = mysql.createPool(tempConfig);
            
            const connection = await tempPool.getConnection();
            await connection.execute(`CREATE DATABASE IF NOT EXISTS ${this.config.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            connection.release();
            await tempPool.end();
            
            console.log(`✅ Database '${this.config.database}' verificado/criado`);
        } catch (error) {
            console.error('❌ Erro ao criar database:', error);
        }
    }

    async initializeSchema() {
        try {
            const schemaPath = path.join(__dirname, 'schema.sql');
            
            if (fs.existsSync(schemaPath)) {
                console.log('📄 Executando schema SQL...');
                const schema = fs.readFileSync(schemaPath, 'utf8');
                
                // Dividir em statements individuais para execução
                const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        try {
                            await this.pool.execute(statement);
                        } catch (error) {
                            // Ignorar erros de "já existe" 
                            if (!error.message.includes('already exists') && 
                                !error.message.includes('Duplicate key')) {
                                console.warn('⚠️ Aviso no schema:', error.message);
                            }
                        }
                    }
                }
                
                console.log('✅ Schema SQL executado com sucesso');
            } else {
                console.log('⚠️ Arquivo schema.sql não encontrado, pulando inicialização');
            }
        } catch (error) {
            console.error('❌ Erro ao executar schema:', error);
        }
    }

    // =====================================================
    // MÉTODOS DE QUERY GENÉRICOS
    // =====================================================

    async query(sql, params = []) {
        if (!this.isConnected) {
            throw new Error('Banco de dados não conectado');
        }

        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('❌ Erro na query:', error);
            throw error;
        }
    }

    async queryOne(sql, params = []) {
        const results = await this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    async insert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const result = await this.query(sql, values);
        
        return result.insertId;
    }

    async update(table, data, whereClause, whereParams = []) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const result = await this.query(sql, [...values, ...whereParams]);
        
        return result.affectedRows;
    }

    async delete(table, whereClause, whereParams = []) {
        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        const result = await this.query(sql, whereParams);
        
        return result.affectedRows;
    }

    // =====================================================
    // MÉTODOS ESPECÍFICOS PARA CAMPANHAS
    // =====================================================

    async createCampaign(campaignData) {
        try {
            const campaignId = await this.insert('campaigns', {
                campaign_name: campaignData.name,
                campaign_type: campaignData.type || 'promocional',
                message_template: campaignData.message,
                session_name: campaignData.session || 'sales',
                created_by: campaignData.createdBy || 'system',
                notes: campaignData.notes || null
            });

            console.log(`✅ Campanha criada com ID: ${campaignId}`);
            return campaignId;
        } catch (error) {
            console.error('❌ Erro ao criar campanha:', error);
            throw error;
        }
    }

    async getCampaign(campaignId) {
        return await this.queryOne('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
    }

    async updateCampaignStatus(campaignId, status) {
        const updateData = { status };
        
        if (status === 'ativa') {
            updateData.started_at = new Date();
        } else if (status === 'finalizada') {
            updateData.finished_at = new Date();
        }

        return await this.update('campaigns', updateData, 'id = ?', [campaignId]);
    }

    // =====================================================
    // MÉTODOS PARA NÚMEROS ENVIADOS
    // =====================================================

    async registerSentNumber(data) {
        try {
            const sentId = await this.insert('sent_numbers', {
                campaign_id: data.campaignId,
                phone_number: data.phoneNumber,
                formatted_number: data.formattedNumber,
                status: data.status || 'enviado',
                whatsapp_message_id: data.messageId || null,
                session_used: data.session || 'sales',
                ip_address: data.ipAddress || null,
                user_agent: data.userAgent || null,
                notes: data.notes || null
            });

            console.log(`📱 Número registrado: ${data.phoneNumber} (ID: ${sentId})`);
            return sentId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log(`⚠️ Número ${data.phoneNumber} já foi enviado nesta campanha`);
                return null;
            }
            console.error('❌ Erro ao registrar número:', error);
            throw error;
        }
    }

    async checkIfAlreadySent(campaignId, phoneNumber, timeframe = '24h') {
        const timeCondition = timeframe === 'all' ? '' : 
            `AND sent_at > DATE_SUB(NOW(), INTERVAL ${timeframe.replace('h', '')} HOUR)`;
        
        const sql = `
            SELECT id, sent_at, status 
            FROM sent_numbers 
            WHERE campaign_id = ? AND phone_number = ? ${timeCondition}
            LIMIT 1
        `;
        
        const result = await this.queryOne(sql, [campaignId, phoneNumber]);
        return result !== null;
    }

    async updateSentNumberStatus(sentId, status, errorMessage = null) {
        const updateData = { status };
        if (errorMessage) {
            updateData.error_message = errorMessage;
        }

        return await this.update('sent_numbers', updateData, 'id = ?', [sentId]);
    }

    async registerResponse(sentId, responseData) {
        try {
            // Atualizar sent_numbers
            await this.update('sent_numbers', {
                response_received: true,
                response_at: new Date(),
                response_count: responseData.responseCount || 1,
                last_response_at: new Date()
            }, 'id = ?', [sentId]);

            // Inserir na tabela responses
            const responseId = await this.insert('responses', {
                sent_number_id: sentId,
                campaign_id: responseData.campaignId,
                phone_number: responseData.phoneNumber,
                message_content: responseData.content,
                response_type: responseData.type || 'texto',
                sentiment: responseData.sentiment || 'neutro',
                is_opt_out: responseData.isOptOut || false
            });

            return responseId;
        } catch (error) {
            console.error('❌ Erro ao registrar resposta:', error);
            throw error;
        }
    }

    // =====================================================
    // MÉTODOS PARA BLACKLIST
    // =====================================================

    async addToBlacklist(phoneNumber, reason, campaignId = null) {
        try {
            const blacklistId = await this.insert('blacklist', {
                phone_number: phoneNumber,
                formatted_number: this.formatPhoneNumber(phoneNumber),
                reason: reason,
                campaign_id: campaignId,
                auto_blocked: campaignId !== null
            });

            console.log(`🚫 Número ${phoneNumber} adicionado à blacklist (Motivo: ${reason})`);
            return blacklistId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log(`⚠️ Número ${phoneNumber} já está na blacklist`);
                return null;
            }
            console.error('❌ Erro ao adicionar à blacklist:', error);
            throw error;
        }
    }

    async isBlacklisted(phoneNumber) {
        const result = await this.queryOne(
            'SELECT id, reason FROM blacklist WHERE phone_number = ? AND is_active = TRUE',
            [phoneNumber]
        );
        return result !== null;
    }

    async removeFromBlacklist(phoneNumber) {
        return await this.update('blacklist', { is_active: false }, 'phone_number = ?', [phoneNumber]);
    }

    // =====================================================
    // MÉTODOS PARA RELATÓRIOS
    // =====================================================

    async getCampaignStats(campaignId) {
        return await this.queryOne('SELECT * FROM campaign_summary WHERE id = ?', [campaignId]);
    }

    async getDailyStats(days = 7) {
        return await this.query(
            'SELECT * FROM daily_performance WHERE send_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY send_date DESC',
            [days]
        );
    }

    async getDuplicateSends() {
        return await this.query('SELECT * FROM duplicate_sends ORDER BY send_count DESC LIMIT 100');
    }

    async getTopResponders(campaignId, limit = 50) {
        const sql = `
            SELECT 
                sn.phone_number,
                sn.formatted_number,
                sn.response_count,
                sn.last_response_at,
                r.sentiment
            FROM sent_numbers sn
            LEFT JOIN responses r ON sn.id = r.sent_number_id
            WHERE sn.campaign_id = ? AND sn.response_received = TRUE
            ORDER BY sn.response_count DESC, sn.last_response_at DESC
            LIMIT ?
        `;
        
        return await this.query(sql, [campaignId, limit]);
    }

    // =====================================================
    // MÉTODOS UTILITÁRIOS
    // =====================================================

    formatPhoneNumber(number) {
        // Formatar número brasileiro para exibição
        const cleaned = String(number).replace(/\D/g, '');
        
        if (cleaned.length >= 11) {
            const country = cleaned.substring(0, 2);
            const area = cleaned.substring(2, 4);
            const first = cleaned.substring(4, 9);
            const second = cleaned.substring(9);
            
            return `+${country} ${area} ${first}-${second}`;
        }
        
        return number;
    }

    async logAction(type, action, details, campaignId = null, phoneNumber = null) {
        try {
            await this.insert('system_logs', {
                log_type: type,
                action: action,
                details: details,
                campaign_id: campaignId,
                phone_number: phoneNumber
            });
        } catch (error) {
            console.error('❌ Erro ao registrar log:', error);
        }
    }

    async cleanup(daysToKeep = 90) {
        try {
            await this.query('CALL CleanOldData(?)', [daysToKeep]);
            console.log(`✅ Limpeza automática executada (mantendo ${daysToKeep} dias)`);
        } catch (error) {
            console.error('❌ Erro na limpeza automática:', error);
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🗄️ Conexão com banco de dados fechada');
        }
    }

    // =====================================================
    // MÉTODO PARA BACKUP
    // =====================================================

    async exportCampaignData(campaignId, format = 'json') {
        try {
            const campaign = await this.getCampaign(campaignId);
            const sentNumbers = await this.query(
                'SELECT * FROM sent_numbers WHERE campaign_id = ? ORDER BY sent_at',
                [campaignId]
            );
            const responses = await this.query(
                'SELECT * FROM responses WHERE campaign_id = ? ORDER BY received_at',
                [campaignId]
            );

            const exportData = {
                campaign,
                sent_numbers: sentNumbers,
                responses,
                export_date: new Date().toISOString(),
                total_records: sentNumbers.length
            };

            if (format === 'json') {
                return JSON.stringify(exportData, null, 2);
            } else if (format === 'csv') {
                // Converter para CSV (implementação básica)
                const headers = Object.keys(sentNumbers[0] || {}).join(',');
                const rows = sentNumbers.map(row => Object.values(row).join(',')).join('\n');
                return headers + '\n' + rows;
            }

            return exportData;
        } catch (error) {
            console.error('❌ Erro ao exportar dados:', error);
            throw error;
        }
    }
}

// =====================================================
// INSTÂNCIA SINGLETON
// =====================================================

let dbInstance = null;

function getDatabase() {
    if (!dbInstance) {
        dbInstance = new DatabaseManager();
    }
    return dbInstance;
}

module.exports = {
    DatabaseManager,
    getDatabase
};

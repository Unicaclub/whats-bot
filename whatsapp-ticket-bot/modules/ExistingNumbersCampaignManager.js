// =====================================================
// MÓDULO TEMPORARIAMENTE DESABILITADO: CAMPANHAS COM NÚMEROS EXISTENTES
// Permite criar campanhas usando números já cadastrados
// NOTA: Desabilitado para evitar conflitos com funcionalidade principal
// =====================================================

/*
const { Pool } = require('pg');

class ExistingNumbersCampaignManager {
    constructor(dbConfig) {
        this.pool = new Pool(dbConfig);
    }

    // Buscar números únicos já cadastrados no banco
    async getExistingNumbers(filters = {}) {
        try {
            let query = `
                SELECT DISTINCT 
                    phone_number,
                    COUNT(*) as times_sent,
                    MAX(sent_at) as last_sent,
                    MIN(sent_at) as first_sent,
                    STRING_AGG(DISTINCT CAST(campaign_id AS TEXT), ', ') as campaign_ids,
                    STRING_AGG(DISTINCT COALESCE(metadata->>'session', 'unknown'), ', ') as sessions
                FROM sent_numbers 
                WHERE 1=1
            `;
            
            const params = [];
            let paramIndex = 1;

            // Filtro por período
            if (filters.days_ago) {
                query += ` AND sent_at >= NOW() - INTERVAL '${parseInt(filters.days_ago)} days'`;
            }

            // Filtro por campanha específica
            if (filters.campaign_id) {
                query += ` AND campaign_id = $${paramIndex}`;
                params.push(filters.campaign_id);
                paramIndex++;
            }

            // Filtro por sessão
            if (filters.session) {
                query += ` AND metadata->>'session' = $${paramIndex}`;
                params.push(filters.session);
                paramIndex++;
            }

            // Filtro por status
            if (filters.status) {
                query += ` AND status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }

            query += `
                GROUP BY phone_number
                ORDER BY last_sent DESC
                LIMIT ${parseInt(filters.limit) || 500}
            `;

            const result = await this.pool.query(query, params);
            
            return {
                success: true,
                numbers: result.rows,
                total: result.rows.length
            };

        } catch (error) {
            console.error('❌ Erro ao buscar números existentes:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Buscar números por critérios específicos
    async getNumbersByCriteria(criteria) {
        try {
            let baseQuery = `
                SELECT DISTINCT phone_number, 
                       MAX(sent_at) as last_sent,
                       COUNT(*) as total_sends
                FROM sent_numbers 
                WHERE 1=1
            `;
            
            const params = [];
            let paramIndex = 1;

            switch (criteria.type) {
                case 'never_responded':
                    // Números que nunca responderam
                    baseQuery += ` AND response_received = false`;
                    break;
                    
                case 'responded_once':
                    // Números que responderam pelo menos uma vez
                    baseQuery += ` AND response_received = true`;
                    break;
                    
                case 'old_contacts':
                    // Contatos antigos (não recebem há X dias)
                    const daysAgo = criteria.days || 30;
                    baseQuery += ` AND sent_at < NOW() - INTERVAL '${daysAgo} days'`;
                    break;
                    
                case 'active_contacts':
                    // Contatos recentes (últimos X dias)
                    const recentDays = criteria.days || 7;
                    baseQuery += ` AND sent_at >= NOW() - INTERVAL '${recentDays} days'`;
                    break;
                    
                case 'by_campaign':
                    // Números de uma campanha específica
                    baseQuery += ` AND campaign_id = $${paramIndex}`;
                    params.push(criteria.campaign_id);
                    paramIndex++;
                    break;
                    
                case 'by_session':
                    // Números de uma sessão específica
                    baseQuery += ` AND metadata->>'session' = $${paramIndex}`;
                    params.push(criteria.session);
                    paramIndex++;
                    break;
                    
                case 'contacted_24h_ago':
                    // Números que foram contactados há mais de 24 horas
                    baseQuery += ` AND sent_at < NOW() - INTERVAL '24 hours'`;
                    break;
            }

            baseQuery += `
                GROUP BY phone_number
                ORDER BY last_sent DESC
                LIMIT ${parseInt(criteria.limit) || 1000}
            `;

            const result = await this.pool.query(baseQuery, params);
            
            return {
                success: true,
                numbers: result.rows.map(row => ({
                    phone_number: row.phone_number,
                    last_sent: row.last_sent,
                    total_sends: row.total_sends
                })),
                total: result.rows.length,
                criteria: criteria
            };

        } catch (error) {
            console.error('❌ Erro ao buscar números por critério:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Verificar se um número pode receber nova campanha
    async canReceiveNewCampaign(phoneNumber, campaignId = null, minHoursBetween = 24) {
        try {
            // Verificar último envio
            const lastSentQuery = `
                SELECT sent_at, campaign_id, status
                FROM sent_numbers 
                WHERE phone_number = $1 
                ORDER BY sent_at DESC 
                LIMIT 1
            `;
            
            const lastSent = await this.pool.query(lastSentQuery, [phoneNumber]);
            
            if (lastSent.rows.length === 0) {
                return {
                    canReceive: true,
                    reason: 'Número não encontrado no banco'
                };
            }

            const lastRecord = lastSent.rows[0];
            const hoursSinceLastSent = (Date.now() - new Date(lastRecord.sent_at).getTime()) / (1000 * 60 * 60);

            // Usar o tempo mínimo configurável (padrão 24h)
            if (hoursSinceLastSent < minHoursBetween) {
                return {
                    canReceive: false,
                    reason: `Último envio há apenas ${Math.round(hoursSinceLastSent)} horas (mínimo: ${minHoursBetween}h)`,
                    lastSent: lastRecord.sent_at,
                    hoursSince: Math.round(hoursSinceLastSent)
                };
            }

            // Se for a mesma campanha, não permitir duplicata
            if (campaignId && lastRecord.campaign_id === campaignId) {
                return {
                    canReceive: false,
                    reason: 'Número já recebeu esta campanha',
                    lastSent: lastRecord.sent_at
                };
            }

            return {
                canReceive: true,
                reason: `Número elegível (último envio há ${Math.round(hoursSinceLastSent)}h)`,
                lastSent: lastRecord.sent_at,
                hoursSince: Math.round(hoursSinceLastSent)
            };

        } catch (error) {
            console.error('❌ Erro ao verificar elegibilidade:', error);
            return {
                canReceive: false,
                reason: 'Erro na verificação: ' + error.message
            };
        }
    }

    // Obter estatísticas dos números cadastrados
    async getNumbersStatistics() {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(DISTINCT phone_number) as total_unique_numbers,
                    COUNT(*) as total_sends,
                    COUNT(DISTINCT campaign_id) as total_campaigns,
                    AVG(CASE WHEN response_received THEN 1 ELSE 0 END) * 100 as response_rate,
                    COUNT(CASE WHEN sent_at >= NOW() - INTERVAL '7 days' THEN 1 END) as sends_last_7_days,
                    COUNT(CASE WHEN sent_at >= NOW() - INTERVAL '30 days' THEN 1 END) as sends_last_30_days
                FROM sent_numbers
            `;

            const sessionStatsQuery = `
                SELECT 
                    COALESCE(metadata->>'session', 'unknown') as session_name,
                    COUNT(DISTINCT phone_number) as unique_numbers,
                    COUNT(*) as total_sends
                FROM sent_numbers
                GROUP BY metadata->>'session'
                ORDER BY total_sends DESC
            `;

            const [stats, sessionStats] = await Promise.all([
                this.pool.query(statsQuery),
                this.pool.query(sessionStatsQuery)
            ]);

            return {
                success: true,
                general: stats.rows[0],
                by_session: sessionStats.rows
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ExistingNumbersCampaignManager;
*/

// Módulo temporariamente desabilitado - retornando null para evitar erros
module.exports = null;

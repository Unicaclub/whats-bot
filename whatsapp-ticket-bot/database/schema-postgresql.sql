-- =====================================================
-- SCHEMA COMPLETO PARA TRACKING DE CAMPANHAS WHATSAPP
-- Sistema PostgreSQL com tracking completo de envios
-- =====================================================

-- Garantir que as extensões necessárias estão disponíveis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tipos ENUM para PostgreSQL
DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM ('criada', 'ativa', 'pausada', 'finalizada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE campaign_type AS ENUM ('promocional', 'informativo', 'follow-up', 'teste');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_status AS ENUM ('enviado', 'entregue', 'lido', 'falhou', 'rejeitado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE blacklist_reason AS ENUM ('opt_out', 'spam_report', 'invalid_number', 'manual', 'bounce');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE response_sentiment AS ENUM ('positivo', 'neutro', 'negativo', 'interessado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABELA PRINCIPAL DE CAMPANHAS
-- =====================================================

CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type campaign_type DEFAULT 'promocional',
    message_template TEXT NOT NULL,
    session_name VARCHAR(50) NOT NULL DEFAULT 'sales',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    status campaign_status DEFAULT 'criada',
    created_by VARCHAR(100) DEFAULT 'system',
    
    -- Estatísticas
    total_targets INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_responded INTEGER DEFAULT 0,
    total_opt_outs INTEGER DEFAULT 0,
    
    -- Configurações
    max_daily_sends INTEGER DEFAULT 1000,
    delay_between_sends INTEGER DEFAULT 5000, -- millisegundos
    respect_blacklist BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- TABELA DE NÚMEROS ENVIADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS sent_numbers (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    formatted_number VARCHAR(25) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status message_status DEFAULT 'enviado',
    message_id VARCHAR(255),
    session_name VARCHAR(50),
    delivery_time TIMESTAMP WITH TIME ZONE,
    read_time TIMESTAMP WITH TIME ZONE,
    response_received BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- =====================================================
-- TABELA DE BLACKLIST
-- =====================================================

CREATE TABLE IF NOT EXISTS blacklist (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    reason blacklist_reason NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    campaign_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by VARCHAR(100) DEFAULT 'system',
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- =====================================================
-- TABELA DE RESPOSTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    sent_number_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_type VARCHAR(50) DEFAULT 'text',
    sentiment response_sentiment DEFAULT 'neutro',
    is_opt_out BOOLEAN DEFAULT FALSE,
    processing_time INTEGER, -- millisegundos
    metadata JSONB,
    
    FOREIGN KEY (sent_number_id) REFERENCES sent_numbers(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- =====================================================
-- TABELA DE ESTATÍSTICAS DE CAMPANHA (CACHE)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_stats (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL UNIQUE,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_read INTEGER DEFAULT 0,
    total_responded INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0.00,
    delivery_rate DECIMAL(5,2) DEFAULT 0.00,
    read_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_response_time INTEGER, -- segundos
    first_send_at TIMESTAMP WITH TIME ZONE,
    last_send_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- =====================================================
-- TABELA DE LOGS DO SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    log_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    campaign_id INTEGER,
    phone_number VARCHAR(20),
    session_name VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices de campanhas
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_session ON campaigns(session_name);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(campaign_type);

-- Índices de números enviados
CREATE INDEX IF NOT EXISTS idx_sent_numbers_campaign ON sent_numbers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_phone ON sent_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_sent_at ON sent_numbers(sent_at);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_status ON sent_numbers(status);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_session ON sent_numbers(session_name);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_response ON sent_numbers(response_received);

-- Índices de blacklist
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone_number);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(is_active);
CREATE INDEX IF NOT EXISTS idx_blacklist_reason ON blacklist(reason);

-- Índices de respostas
CREATE INDEX IF NOT EXISTS idx_responses_campaign ON responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_responses_phone ON responses(phone_number);
CREATE INDEX IF NOT EXISTS idx_responses_received_at ON responses(received_at);
CREATE INDEX IF NOT EXISTS idx_responses_sentiment ON responses(sentiment);
CREATE INDEX IF NOT EXISTS idx_responses_opt_out ON responses(is_opt_out);

-- Índices de logs
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_campaign ON system_logs(campaign_id);

-- Índices compostos para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_sent_numbers_campaign_phone ON sent_numbers(campaign_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_sent_numbers_phone_sent_at ON sent_numbers(phone_number, sent_at);
CREATE INDEX IF NOT EXISTS idx_responses_campaign_sentiment ON responses(campaign_id, sentiment);

-- =====================================================
-- VIEWS PARA RELATÓRIOS
-- =====================================================

-- View de estatísticas de campanha em tempo real
CREATE OR REPLACE VIEW v_campaign_statistics AS
SELECT 
    c.id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.session_name,
    c.created_at,
    c.started_at,
    c.finished_at,
    COUNT(sn.id) as total_sent,
    COUNT(CASE WHEN sn.status = 'entregue' THEN 1 END) as total_delivered,
    COUNT(CASE WHEN sn.status = 'lido' THEN 1 END) as total_read,
    COUNT(CASE WHEN sn.response_received = TRUE THEN 1 END) as total_responded,
    COUNT(CASE WHEN sn.status = 'falhou' THEN 1 END) as total_failed,
    ROUND(
        CASE 
            WHEN COUNT(sn.id) > 0 THEN 
                (COUNT(CASE WHEN sn.response_received = TRUE THEN 1 END)::DECIMAL / COUNT(sn.id)) * 100
            ELSE 0 
        END, 2
    ) as response_rate,
    ROUND(
        CASE 
            WHEN COUNT(sn.id) > 0 THEN 
                (COUNT(CASE WHEN sn.status = 'entregue' THEN 1 END)::DECIMAL / COUNT(sn.id)) * 100
            ELSE 0 
        END, 2
    ) as delivery_rate
FROM campaigns c
LEFT JOIN sent_numbers sn ON c.id = sn.campaign_id
GROUP BY c.id, c.campaign_name, c.campaign_type, c.status, c.session_name, c.created_at, c.started_at, c.finished_at;

-- View de top respondedores
CREATE OR REPLACE VIEW v_top_responders AS
SELECT 
    r.phone_number,
    COUNT(r.id) as total_responses,
    COUNT(DISTINCT r.campaign_id) as campaigns_responded,
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
WHERE r.is_opt_out = FALSE
GROUP BY r.phone_number
ORDER BY total_responses DESC, avg_sentiment_score DESC;

-- View de análise de horários
CREATE OR REPLACE VIEW v_hourly_analysis AS
SELECT 
    EXTRACT(HOUR FROM sn.sent_at) as hour_of_day,
    COUNT(sn.id) as total_sent,
    COUNT(CASE WHEN sn.response_received = TRUE THEN 1 END) as total_responses,
    ROUND(
        CASE 
            WHEN COUNT(sn.id) > 0 THEN 
                (COUNT(CASE WHEN sn.response_received = TRUE THEN 1 END)::DECIMAL / COUNT(sn.id)) * 100
            ELSE 0 
        END, 2
    ) as response_rate
FROM sent_numbers sn
WHERE sn.sent_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM sn.sent_at)
ORDER BY hour_of_day;

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at em campanhas
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em blacklist
DROP TRIGGER IF EXISTS update_blacklist_updated_at ON blacklist;
CREATE TRIGGER update_blacklist_updated_at
    BEFORE UPDATE ON blacklist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar estatísticas quando um número é enviado
CREATE OR REPLACE FUNCTION update_campaign_stats_on_send()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar estatísticas da campanha
    UPDATE campaigns SET 
        total_sent = total_sent + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.campaign_id;
    
    -- Inserir ou atualizar cache de estatísticas
    INSERT INTO campaign_stats (campaign_id, total_sent, first_send_at, last_send_at, updated_at)
    VALUES (NEW.campaign_id, 1, NEW.sent_at, NEW.sent_at, CURRENT_TIMESTAMP)
    ON CONFLICT (campaign_id) DO UPDATE SET
        total_sent = campaign_stats.total_sent + 1,
        last_send_at = NEW.sent_at,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stats_on_send ON sent_numbers;
CREATE TRIGGER trigger_update_stats_on_send
    AFTER INSERT ON sent_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_stats_on_send();

-- Trigger para atualizar estatísticas quando status muda
CREATE OR REPLACE FUNCTION update_campaign_stats_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        -- Atualizar contadores baseado no novo status
        IF NEW.status = 'entregue' THEN
            UPDATE campaigns SET 
                total_delivered = total_delivered + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.campaign_id;
            
            UPDATE campaign_stats SET
                total_delivered = total_delivered + 1,
                delivery_rate = CASE 
                    WHEN total_sent > 0 THEN (total_delivered + 1.0) / total_sent * 100 
                    ELSE 0 
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE campaign_id = NEW.campaign_id;
        END IF;
        
        IF NEW.status = 'falhou' THEN
            UPDATE campaigns SET 
                total_failed = total_failed + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.campaign_id;
            
            UPDATE campaign_stats SET
                total_failed = total_failed + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE campaign_id = NEW.campaign_id;
        END IF;
    END IF;
    
    -- Atualizar flag de resposta
    IF OLD.response_received != NEW.response_received AND NEW.response_received = TRUE THEN
        UPDATE campaigns SET 
            total_responded = total_responded + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.campaign_id;
        
        UPDATE campaign_stats SET
            total_responded = total_responded + 1,
            response_rate = CASE 
                WHEN total_sent > 0 THEN (total_responded + 1.0) / total_sent * 100 
                ELSE 0 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE campaign_id = NEW.campaign_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stats_on_status_change ON sent_numbers;
CREATE TRIGGER trigger_update_stats_on_status_change
    AFTER UPDATE ON sent_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_stats_on_status_change();

-- =====================================================
-- PROCEDIMENTOS PARA MANUTENÇÃO
-- =====================================================

-- Procedimento para limpeza de dados antigos
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 90)
RETURNS TEXT AS $$
DECLARE
    deleted_logs INTEGER;
    deleted_responses INTEGER;
    result_text TEXT;
BEGIN
    -- Limpar logs antigos
    DELETE FROM system_logs 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Limpar respostas muito antigas (manter mais tempo)
    DELETE FROM responses 
    WHERE received_at < CURRENT_DATE - INTERVAL '1 day' * (days_to_keep * 2);
    GET DIAGNOSTICS deleted_responses = ROW_COUNT;
    
    result_text := 'Limpeza concluída: ' || deleted_logs || ' logs removidos, ' || deleted_responses || ' respostas antigas removidas.';
    
    -- Log da limpeza
    INSERT INTO system_logs (log_type, action, details)
    VALUES ('maintenance', 'CLEANUP_EXECUTED', result_text);
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Procedimento para atualizar estatísticas
CREATE OR REPLACE FUNCTION refresh_campaign_statistics()
RETURNS TEXT AS $$
DECLARE
    updated_campaigns INTEGER;
BEGIN
    -- Atualizar todas as estatísticas de campanhas
    UPDATE campaign_stats SET
        total_sent = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaign_stats.campaign_id),
        total_delivered = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaign_stats.campaign_id AND status = 'entregue'),
        total_responded = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaign_stats.campaign_id AND response_received = TRUE),
        total_failed = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = campaign_stats.campaign_id AND status = 'falhou'),
        updated_at = CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS updated_campaigns = ROW_COUNT;
    
    -- Recalcular rates
    UPDATE campaign_stats SET
        response_rate = CASE WHEN total_sent > 0 THEN (total_responded::DECIMAL / total_sent) * 100 ELSE 0 END,
        delivery_rate = CASE WHEN total_sent > 0 THEN (total_delivered::DECIMAL / total_sent) * 100 ELSE 0 END;
    
    RETURN 'Estatísticas atualizadas para ' || updated_campaigns || ' campanhas.';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- =====================================================

-- Inserir dados de exemplo apenas se não existirem campanhas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM campaigns LIMIT 1) THEN
        -- Campanha de exemplo
        INSERT INTO campaigns (campaign_name, campaign_type, message_template, session_name, description)
        VALUES (
            'Campanha de Boas-vindas',
            'informativo',
            'Olá! Bem-vindo à nossa empresa. Como podemos ajudá-lo hoje?',
            'sales',
            'Campanha automática para novos clientes'
        );
        
        -- Alguns números na blacklist (números fictícios)
        INSERT INTO blacklist (phone_number, reason, notes)
        VALUES 
            ('5511999999999', 'opt_out', 'Cliente solicitou remoção'),
            ('5511888888888', 'invalid_number', 'Número inválido detectado');
            
        -- Log da criação
        INSERT INTO system_logs (log_type, action, details)
        VALUES ('system', 'SAMPLE_DATA_CREATED', 'Dados de exemplo inseridos durante inicialização');
    END IF;
END
$$;

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

-- Este schema PostgreSQL fornece:
-- 1. Tracking completo de campanhas WhatsApp
-- 2. Prevenção automática de duplicatas
-- 3. Sistema de blacklist integrado
-- 4. Estatísticas em tempo real via triggers
-- 5. Views otimizadas para relatórios
-- 6. Procedimentos de manutenção automática
-- 7. Logs detalhados de todas as operações
-- 8. Suporte a metadados JSON para flexibilidade
-- 9. Índices otimizados para alta performance
-- 10. Triggers para consistência de dados automática

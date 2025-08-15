-- =====================================================
-- SISTEMA DE TRACKING DE CAMPANHAS WHATSAPP
-- Estrutura completa de banco de dados
-- =====================================================

-- Criar banco de dados se não existir
CREATE DATABASE IF NOT EXISTS whatsapp_campaigns_db 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE whatsapp_campaigns_db;

-- =====================================================
-- TABELA: campaigns
-- Gerenciamento de campanhas de marketing
-- =====================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type ENUM('promocional', 'informativo', 'follow-up', 'teste') NOT NULL DEFAULT 'promocional',
    message_template TEXT NOT NULL,
    session_name VARCHAR(50) NOT NULL DEFAULT 'sales',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    status ENUM('criada', 'ativa', 'pausada', 'finalizada', 'cancelada') NOT NULL DEFAULT 'criada',
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    total_responded INT NOT NULL DEFAULT 0,
    total_blocked INT NOT NULL DEFAULT 0,
    created_by VARCHAR(100) DEFAULT 'system',
    notes TEXT,
    
    INDEX idx_campaign_status (status),
    INDEX idx_campaign_type (campaign_type),
    INDEX idx_created_at (created_at),
    INDEX idx_session_name (session_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: sent_numbers
-- Registro detalhado de todos os envios
-- =====================================================
CREATE TABLE IF NOT EXISTS sent_numbers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campaign_id INT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    formatted_number VARCHAR(25) NOT NULL, -- Formato +55 11 99999-9999
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('enviado', 'entregue', 'falhou', 'bloqueado', 'spam') NOT NULL DEFAULT 'enviado',
    response_received BOOLEAN DEFAULT FALSE,
    response_at TIMESTAMP NULL,
    response_count INT DEFAULT 0,
    last_response_at TIMESTAMP NULL,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    whatsapp_message_id VARCHAR(100),
    session_used VARCHAR(50) NOT NULL DEFAULT 'sales',
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    INDEX idx_phone_number (phone_number),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_sent_at (sent_at),
    INDEX idx_status (status),
    INDEX idx_response_received (response_received),
    INDEX idx_session_used (session_used),
    UNIQUE KEY unique_campaign_phone (campaign_id, phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: blacklist
-- Gerenciamento de números bloqueados
-- =====================================================
CREATE TABLE IF NOT EXISTS blacklist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    formatted_number VARCHAR(25) NOT NULL,
    reason ENUM('solicitacao_usuario', 'spam_complaint', 'numero_invalido', 'opt_out', 'bloqueio_manual', 'whatsapp_block') NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_by VARCHAR(100) DEFAULT 'system',
    campaign_id INT NULL, -- Campanha que originou o bloqueio
    auto_blocked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    INDEX idx_phone_number (phone_number),
    INDEX idx_reason (reason),
    INDEX idx_blocked_at (blocked_at),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: campaign_stats
-- Estatísticas detalhadas por período
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campaign_id INT NOT NULL,
    date_recorded DATE NOT NULL,
    hour_recorded INT NOT NULL DEFAULT 0, -- 0-23
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    response_count INT DEFAULT 0,
    blocked_count INT DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0.00,
    delivery_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    UNIQUE KEY unique_campaign_date_hour (campaign_id, date_recorded, hour_recorded),
    INDEX idx_date_recorded (date_recorded),
    INDEX idx_campaign_id (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: responses
-- Registro de respostas dos clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sent_number_id INT NOT NULL,
    campaign_id INT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT,
    response_type ENUM('texto', 'midia', 'emoji', 'audio', 'documento') DEFAULT 'texto',
    sentiment ENUM('positivo', 'neutro', 'negativo', 'interessado', 'desinteressado') DEFAULT 'neutro',
    is_opt_out BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP NULL,
    
    FOREIGN KEY (sent_number_id) REFERENCES sent_numbers(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    INDEX idx_phone_number (phone_number),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_received_at (received_at),
    INDEX idx_sentiment (sentiment),
    INDEX idx_is_opt_out (is_opt_out)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: system_logs
-- Logs de atividades do sistema
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    log_type ENUM('info', 'warning', 'error', 'debug', 'campaign', 'security') NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    campaign_id INT NULL,
    phone_number VARCHAR(20) NULL,
    session_name VARCHAR(50) NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    INDEX idx_log_type (log_type),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_campaign_id (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INSERIR DADOS INICIAIS
-- =====================================================

-- Campanha padrão para migração de dados existentes
INSERT INTO campaigns (
    campaign_name, 
    campaign_type, 
    message_template, 
    status, 
    created_at,
    notes
) VALUES (
    'Migração de Dados Existentes',
    'informativo',
    'Dados migrados do sistema anterior',
    'finalizada',
    NOW(),
    'Campanha criada automaticamente para migrar dados históricos'
);

-- =====================================================
-- VIEWS PARA RELATÓRIOS
-- =====================================================

-- View: Estatísticas resumidas por campanha
CREATE OR REPLACE VIEW campaign_summary AS
SELECT 
    c.id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.created_at,
    c.total_sent,
    c.total_delivered,
    c.total_failed,
    c.total_responded,
    c.total_blocked,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_delivered / c.total_sent) * 100, 2)
        ELSE 0 
    END as delivery_rate,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_responded / c.total_sent) * 100, 2)
        ELSE 0 
    END as response_rate,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_failed / c.total_sent) * 100, 2)
        ELSE 0 
    END as failure_rate
FROM campaigns c;

-- View: Números com múltiplos envios (possíveis duplicatas)
CREATE OR REPLACE VIEW duplicate_sends AS
SELECT 
    phone_number,
    COUNT(*) as send_count,
    GROUP_CONCAT(DISTINCT campaign_id) as campaign_ids,
    MIN(sent_at) as first_sent,
    MAX(sent_at) as last_sent
FROM sent_numbers 
GROUP BY phone_number 
HAVING COUNT(*) > 1;

-- View: Performance diária
CREATE OR REPLACE VIEW daily_performance AS
SELECT 
    DATE(sent_at) as send_date,
    COUNT(*) as total_sent,
    SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'falhou' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN response_received = TRUE THEN 1 ELSE 0 END) as responded,
    ROUND(AVG(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) * 100, 2) as delivery_rate,
    ROUND(AVG(CASE WHEN response_received = TRUE THEN 1 ELSE 0 END) * 100, 2) as response_rate
FROM sent_numbers 
GROUP BY DATE(sent_at)
ORDER BY send_date DESC;

-- =====================================================
-- PROCEDURES ÚTEIS
-- =====================================================

DELIMITER //

-- Procedure: Atualizar estatísticas da campanha
CREATE PROCEDURE UpdateCampaignStats(IN campaign_id_param INT)
BEGIN
    UPDATE campaigns SET
        total_sent = (
            SELECT COUNT(*) FROM sent_numbers 
            WHERE campaign_id = campaign_id_param
        ),
        total_delivered = (
            SELECT COUNT(*) FROM sent_numbers 
            WHERE campaign_id = campaign_id_param AND status = 'entregue'
        ),
        total_failed = (
            SELECT COUNT(*) FROM sent_numbers 
            WHERE campaign_id = campaign_id_param AND status = 'falhou'
        ),
        total_responded = (
            SELECT COUNT(*) FROM sent_numbers 
            WHERE campaign_id = campaign_id_param AND response_received = TRUE
        ),
        total_blocked = (
            SELECT COUNT(*) FROM sent_numbers 
            WHERE campaign_id = campaign_id_param AND status = 'bloqueado'
        )
    WHERE id = campaign_id_param;
END //

-- Procedure: Limpar dados antigos
CREATE PROCEDURE CleanOldData(IN days_to_keep INT)
BEGIN
    -- Remover logs antigos
    DELETE FROM system_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Remover estatísticas antigas
    DELETE FROM campaign_stats 
    WHERE date_recorded < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Marcar campanhas antigas como finalizadas
    UPDATE campaigns 
    SET status = 'finalizada' 
    WHERE status = 'ativa' 
    AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END //

DELIMITER ;

-- =====================================================
-- TRIGGERS PARA MANTER CONSISTÊNCIA
-- =====================================================

DELIMITER //

-- Trigger: Atualizar estatísticas quando número é inserido
CREATE TRIGGER after_sent_number_insert
    AFTER INSERT ON sent_numbers
    FOR EACH ROW
BEGIN
    CALL UpdateCampaignStats(NEW.campaign_id);
END //

-- Trigger: Atualizar estatísticas quando status muda
CREATE TRIGGER after_sent_number_update
    AFTER UPDATE ON sent_numbers
    FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status OR OLD.response_received != NEW.response_received THEN
        CALL UpdateCampaignStats(NEW.campaign_id);
    END IF;
END //

-- Trigger: Log de inserção na blacklist
CREATE TRIGGER after_blacklist_insert
    AFTER INSERT ON blacklist
    FOR EACH ROW
BEGIN
    INSERT INTO system_logs (log_type, action, details, phone_number, created_at)
    VALUES ('security', 'BLACKLIST_ADD', CONCAT('Número adicionado à blacklist. Motivo: ', NEW.reason), NEW.phone_number, NOW());
END //

DELIMITER ;

-- =====================================================
-- ÍNDICES COMPOSTOS PARA PERFORMANCE
-- =====================================================

-- Índice para consultas de campanhas ativas
CREATE INDEX idx_campaigns_active ON campaigns(status, created_at);

-- Índice para consultas de números por período
CREATE INDEX idx_sent_numbers_period ON sent_numbers(sent_at, campaign_id, status);

-- Índice para análise de respostas
CREATE INDEX idx_responses_analysis ON responses(campaign_id, sentiment, received_at);

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

-- Este schema foi projetado para:
-- 1. Rastrear todas as campanhas e seus envios
-- 2. Evitar duplicatas através de constraints UNIQUE
-- 3. Gerenciar blacklist de forma eficiente
-- 4. Fornecer análises detalhadas de performance
-- 5. Manter logs de auditoria completos
-- 6. Suportar escalabilidade para milhões de registros

-- Para otimização adicional em grandes volumes:
-- 1. Considere particionamento de tabelas por data
-- 2. Implemente cache Redis para consultas frequentes
-- 3. Use read replicas para relatórios
-- 4. Configure backup incremental automático

-- =====================================================
-- SCRIPT DE TABELAS DE PERSISTÊNCIA 
-- Para banco whatsapp_campaigns com usuário ticket
-- =====================================================

-- Primeira tentativa: criar tabelas básicas
CREATE TABLE IF NOT EXISTS campaign_batch_state (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(50) NOT NULL,
    campaign_id VARCHAR(100),
    total_numbers INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    current_batch INTEGER DEFAULT 1,
    processed_numbers INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 50,
    status VARCHAR(20) DEFAULT 'running',
    message TEXT NOT NULL,
    last_batch_time TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP DEFAULT NULL,
    interrupted_reason TEXT DEFAULT NULL
);

-- Tabela de detalhes de cada lote processado
CREATE TABLE IF NOT EXISTS campaign_batch_details (
    id SERIAL PRIMARY KEY,
    campaign_state_id INTEGER REFERENCES campaign_batch_state(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    numbers_in_batch INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP DEFAULT NULL,
    average_delay INTEGER DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'processing',
    notes TEXT DEFAULT NULL
);

-- Selecionar todas as tabelas para verificar se foram criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'campaign_batch%'
ORDER BY table_name;

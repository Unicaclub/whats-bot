-- =====================================================
-- SCRIPT SQL PARA SISTEMA DE CONTINUIDADE DE CAMPANHAS
-- =====================================================

-- Criar tabela para estado geral das campanhas
CREATE TABLE IF NOT EXISTS campaign_batch_state (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL DEFAULT 0,
    session_name VARCHAR(50) NOT NULL,
    total_numbers INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    current_batch INTEGER DEFAULT 0,
    processed_numbers INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
    message TEXT,
    batch_size INTEGER DEFAULT 300,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
);

-- Criar tabela para detalhes de cada lote processado
CREATE TABLE IF NOT EXISTS campaign_batch_details (
    id SERIAL PRIMARY KEY,
    campaign_state_id INTEGER REFERENCES campaign_batch_state(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    numbers_in_batch INTEGER NOT NULL,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_batch_state_session ON campaign_batch_state(session_name);
CREATE INDEX IF NOT EXISTS idx_campaign_batch_state_status ON campaign_batch_state(status);
CREATE INDEX IF NOT EXISTS idx_campaign_batch_state_created ON campaign_batch_state(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_batch_state_campaign ON campaign_batch_state(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_batch_details_campaign_state ON campaign_batch_details(campaign_state_id);
CREATE INDEX IF NOT EXISTS idx_campaign_batch_details_batch ON campaign_batch_details(batch_number);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaign_batch_state_updated_at 
    BEFORE UPDATE ON campaign_batch_state 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Visualizações úteis
CREATE OR REPLACE VIEW v_campaign_summary AS
SELECT 
    cbs.id,
    cbs.session_name,
    cbs.total_numbers,
    cbs.total_batches,
    cbs.current_batch,
    cbs.processed_numbers,
    cbs.success_count,
    cbs.failed_count,
    cbs.duplicate_count,
    cbs.status,
    ROUND((cbs.current_batch::NUMERIC / cbs.total_batches) * 100, 2) as progress_percentage,
    cbs.created_at,
    cbs.updated_at,
    EXTRACT(EPOCH FROM (cbs.updated_at - cbs.created_at)) / 60 as duration_minutes
FROM campaign_batch_state cbs
ORDER BY cbs.created_at DESC;

CREATE OR REPLACE VIEW v_interrupted_campaigns AS
SELECT * FROM v_campaign_summary 
WHERE status IN ('running', 'interrupted')
AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes';

-- Função para limpeza automática de campanhas antigas
CREATE OR REPLACE FUNCTION cleanup_old_campaigns(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar detalhes de campanhas antigas primeiro (devido ao foreign key)
    DELETE FROM campaign_batch_details 
    WHERE campaign_id IN (
        SELECT id FROM campaign_batch_state 
        WHERE status = 'completed' 
        AND updated_at < CURRENT_TIMESTAMP - (days_old || ' days')::INTERVAL
    );
    
    -- Deletar campanhas concluídas antigas
    DELETE FROM campaign_batch_state 
    WHERE status = 'completed' 
    AND updated_at < CURRENT_TIMESTAMP - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Consultas úteis para monitoramento
-- 
-- 1. Ver campanhas ativas:
-- SELECT * FROM v_campaign_summary WHERE status IN ('running', 'interrupted');
--
-- 2. Ver campanhas interrompidas:
-- SELECT * FROM v_interrupted_campaigns;
--
-- 3. Ver progresso de campanha específica:
-- SELECT 
--   cbd.*,
--   cbs.total_batches,
--   ROUND((cbd.batch_number::FLOAT / cbs.total_batches) * 100, 2) as batch_progress
-- FROM campaign_batch_details cbd
-- JOIN campaign_batch_state cbs ON cbd.campaign_id = cbs.id
-- WHERE cbd.campaign_id = [ID_DA_CAMPANHA]
-- ORDER BY cbd.batch_number;
--
-- 4. Estatísticas gerais:
-- SELECT 
--   status,
--   COUNT(*) as total_campaigns,
--   AVG(success_count) as avg_success,
--   AVG(failed_count) as avg_failed,
--   AVG(duration_minutes) as avg_duration_minutes
-- FROM v_campaign_summary 
-- GROUP BY status;
--
-- 5. Limpeza manual de campanhas antigas (30 dias):
-- SELECT cleanup_old_campaigns(30);

COMMENT ON TABLE campaign_batch_state IS 'Armazena o estado geral de cada campanha de mensagens em lote';
COMMENT ON TABLE campaign_batch_details IS 'Armazena detalhes específicos de cada lote processado';
COMMENT ON VIEW v_campaign_summary IS 'Visualização resumida de campanhas com estatísticas calculadas';
COMMENT ON VIEW v_interrupted_campaigns IS 'Campanhas que foram interrompidas e precisam de recuperação';
COMMENT ON FUNCTION cleanup_old_campaigns IS 'Remove campanhas concluídas mais antigas que X dias';

-- Inserir dados de teste (opcional - remover em produção)
-- INSERT INTO campaign_batch_state (session_name, total_numbers, total_batches, message) 
-- VALUES ('sales', 1000, 4, 'Mensagem de teste');

# 🔄 Sistema de Continuidade de Campanhas

## Visão Geral

O sistema de continuidade de campanhas garante que nenhuma campanha seja perdida em caso de:
- Desconexão do WhatsApp
- Reinicialização do servidor
- Falhas de rede
- Rate limiting do WhatsApp

## 📋 Componentes do Sistema

### 1. CampaignStateManager
**Arquivo:** `database/campaign-state-manager.js`

**Responsabilidades:**
- Persiste o estado de cada campanha no PostgreSQL
- Rastreia progresso lote por lote
- Armazena detalhes de cada batch processado
- Marca campanhas como concluídas ou interrompidas

**Tabelas PostgreSQL:**
```sql
-- Estado geral da campanha
campaign_batch_state:
- id (serial primary)
- session_name (varchar)
- total_numbers (integer)
- total_batches (integer) 
- current_batch (integer)
- processed_numbers (integer)
- success_count (integer)
- failed_count (integer)
- duplicate_count (integer)
- status (enum: 'running', 'completed', 'failed', 'interrupted')
- message (text)
- created_at, updated_at (timestamp)

-- Detalhes de cada lote
campaign_batch_details:
- id (serial primary)
- campaign_id (foreign key)
- batch_number (integer)
- sent_count (integer)
- failed_count (integer)
- duplicate_count (integer)
- success (boolean)
- error_message (text)
- processed_at (timestamp)
```

### 2. CampaignRecoveryManager
**Arquivo:** `database/campaign-recovery-manager.js`

**Responsabilidades:**
- Detecta campanhas interrompidas automaticamente
- Agenda recuperação quando sessão reconecta
- Executa resumo de campanha do ponto exato onde parou
- Evita duplicação de mensagens

**Fluxo de Recuperação:**
1. Identifica campanhas com status 'running' ou 'interrupted'
2. Calcula números já processados vs. números restantes
3. Cria novo processador configurado para resumir
4. Continua do lote exato onde parou

### 3. CampaignBatchProcessor (Aprimorado)
**Arquivo:** `modules/CampaignBatchProcessor.js`

**Novos Recursos:**
- Integração com StateManager para persistência automática
- Método `resumeCampaign()` para continuar do ponto de parada
- Estado persistido após cada lote processado
- Recuperação automática em caso de falha

## 🚀 Como Usar

### Campanhas Normais
```javascript
const processor = new CampaignBatchProcessor({
  batchSize: 300,
  minInterval: 5000,
  maxInterval: 15000,
  batchDelayMin: 15000,
  batchDelayMax: 30000
});

// Configurar persistência
processor.setStateManager(stateManager);

// Processar campanha (com persistência automática)
await processor.processLargeCampaignArray(numbers, message, 'sales', client);
```

### Recuperação Manual
```javascript
// Buscar campanhas interrompidas
const interrupted = await stateManager.findInterruptedCampaigns('sales');

// Recuperar campanha específica
await recoveryManager.recoverCampaign(campaignId, 'sales', client);
```

## 🔧 Configuração Automática

O sistema é configurado automaticamente no `app.js`:

```javascript
// 1. Instanciar gerenciadores
const stateManager = new CampaignStateManager();
const recoveryManager = new CampaignRecoveryManager(stateManager);

// 2. Configurar processador
const batchProcessor = new CampaignBatchProcessor(config);
batchProcessor.setStateManager(stateManager);

// 3. Recuperação automática ao conectar
sessions.sales.client = client;
setTimeout(async () => {
  await recoveryManager.checkForInterruptedCampaigns('sales', client);
}, 5000);
```

## ⚡ Fluxo de Execução

### Cenário 1: Campanha Normal
1. ✅ Campanha inicia → Estado criado no PostgreSQL
2. ✅ Cada lote processado → Estado atualizado
3. ✅ Campanha termina → Marcada como 'completed'

### Cenário 2: Desconexão Durante Campanha
1. ✅ Campanha rodando → Lotes 1-5 processados e salvos
2. ❌ Desconexão no lote 6 → Estado fica 'interrupted'
3. 🔄 Reconexão → Sistema detecta campanha interrompida
4. ✅ Recuperação automática → Continua do lote 6
5. ✅ Campanha termina → Marcada como 'completed'

### Cenário 3: Reinicialização do Servidor
1. ✅ Campanhas ativas salvas no PostgreSQL
2. ❌ Servidor reinicia → Todas instâncias perdidas
3. 🔄 Servidor volta → Verifica PostgreSQL
4. ✅ Campanhas detectadas → Recuperação automática
5. ✅ Continua do ponto exato onde parou

## 🛡️ Proteções Implementadas

### Anti-Duplicação
- Números já processados são excluídos na recuperação
- Verificação por batch_number e sent_count
- Estado persistido após cada envio bem-sucedido

### Rate Limiting
- Configurações conservadoras por padrão
- 300 números por lote (reduzido de 800)
- 4-10s entre mensagens (otimizado)
- 15-30s entre lotes (novo)

### Tratamento de Erros
- Falhas de lote não interrompem campanha
- Erros persistidos para análise
- Recuperação automática em caso de falha de rede

## 📊 Monitoramento

### Logs Detalhados
```
🔄 Resumindo campanha do lote 6...
📦 Processando 8 lotes restantes
✅ Lote 6 concluído: 298 enviadas, 2 falhas
⏳ Aguardando 22s antes do próximo lote...
📈 Progresso do recovery: 87.5% (7/8 lotes)
💾 Recovery da campanha 12 concluído
```

### Estado no PostgreSQL
- Progresso em tempo real
- Histórico completo de cada lote
- Estatísticas de envio e falha
- Timestamps para auditoria

## 🚨 Casos de Uso Críticos

### 1. Campanha de 16.000 números
- Duração: ~4-6 horas
- Risco de desconexão: Alto
- **Solução:** Estado persistido a cada lote (300 números)
- **Resultado:** Zero perda em caso de desconexão

### 2. Rate Limiting do WhatsApp
- Problema: Disconnection por envio rápido demais
- **Solução:** Configurações anti-spam + recuperação automática
- **Resultado:** Continua automaticamente após reconexão

### 3. Falha de Servidor Durante Madrugada
- Problema: Campanhas rodando em background
- **Solução:** Estado persistido + recuperação ao reiniciar
- **Resultado:** Zero interrupção visível para usuário

## 📝 Manutenção

### Limpeza de Campanhas Antigas
```sql
-- Campanhas concluídas há mais de 30 dias
DELETE FROM campaign_batch_details 
WHERE campaign_id IN (
  SELECT id FROM campaign_batch_state 
  WHERE status = 'completed' 
  AND updated_at < NOW() - INTERVAL '30 days'
);

DELETE FROM campaign_batch_state 
WHERE status = 'completed' 
AND updated_at < NOW() - INTERVAL '30 days';
```

### Monitoramento de Campanhas Presas
```sql
-- Campanhas rodando há mais de 24h
SELECT * FROM campaign_batch_state 
WHERE status = 'running' 
AND created_at < NOW() - INTERVAL '24 hours';
```

## ✅ Benefícios Implementados

1. **🔄 Zero Perda de Progresso** - Todas as campanhas são recuperáveis
2. **⚡ Recuperação Automática** - Sem intervenção manual necessária
3. **📊 Visibilidade Total** - Estado completo no PostgreSQL
4. **🛡️ Anti-Spam Protection** - Configurações seguras para evitar rate limit
5. **🚀 Escalabilidade** - Suporta campanhas de qualquer tamanho
6. **💪 Robustez Enterprise** - Sistema preparado para produção 24/7

O sistema está completamente implementado e pronto para uso em produção! 🎉

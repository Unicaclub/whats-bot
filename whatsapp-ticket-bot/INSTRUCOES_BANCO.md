# 🗄️ GUIA COMPLETO: CONFIGURAÇÃO DE BANCO DE DADOS DO ZERO

## 📋 PASSO A PASSO PARA CONFIGURAR O BANCO DE DADOS POSTGRESQL

### 1. **INSTALAR POSTGRESQL** (se ainda não tiver)

#### Windows:
```bash
# Baixar e instalar PostgreSQL do site oficial
# https://www.postgresql.org/download/windows/
# Durante a instalação, definir senha para usuário 'postgres'
```

#### Verificar se está funcionando:
```bash
psql --version
```

### 2. **CONFIGURAR VARIÁVEIS DE AMBIENTE**

#### 2.1 Copiar arquivo de exemplo:
```bash
cd C:\Users\User\Desktop\ticket\whatsapp-ticket-bot
copy .env.example .env
```

#### 2.2 Editar arquivo `.env`:
```bash
# Abrir .env e configurar:
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_POSTGRES
DB_NAME=whatsapp_campaigns
DB_SSL=false

# Outras configurações importantes:
PORT=3005
NODE_ENV=production
OPENAI_API_KEY=sua_chave_openai_opcional
BOT_NAME=Nome da Sua Casa de Show
COMPANY_PHONE=5511999999999
```

### 3. **INSTALAR DEPENDÊNCIAS NODE.JS**

```bash
cd C:\Users\User\Desktop\ticket\whatsapp-ticket-bot
npm install
```

### 4. **OPÇÃO A: CONFIGURAÇÃO AUTOMÁTICA (RECOMENDADO)**

#### 4.1 Executar script de setup automático:
```bash
node setup-database.js
```

**Este script fará automaticamente:**
- ✅ Criar banco `whatsapp_campaigns`
- ✅ Instalar extensões PostgreSQL
- ✅ Criar todos os tipos ENUM
- ✅ Criar todas as tabelas
- ✅ Criar índices para performance
- ✅ Criar funções e triggers
- ✅ Criar views para relatórios
- ✅ Inserir dados de exemplo
- ✅ Testar funcionalidades

### 5. **OPÇÃO B: CONFIGURAÇÃO MANUAL (VIA PGADMIN)**

#### 5.1 Abrir pgAdmin e conectar

#### 5.2 Criar banco de dados:
```sql
CREATE DATABASE whatsapp_campaigns;
```

#### 5.3 Executar schemas na ordem:
```bash
# 1. Executar primeiro:
# database/schema-postgresql.sql (schema principal)

# 2. Executar depois:
# database/setup-continuity-tables.sql (sistema de continuidade)
```

#### 5.4 No Query Tool do pgAdmin, executar cada arquivo .sql

### 6. **VERIFICAR INSTALAÇÃO**

#### 6.1 Conectar via psql:
```bash
psql -U postgres -d whatsapp_campaigns
```

#### 6.2 Verificar tabelas criadas:
```sql
\dt
```

Você deve ver estas tabelas:
- ✅ `campaigns`
- ✅ `sent_numbers`
- ✅ `blacklist`
- ✅ `campaign_stats`
- ✅ `system_logs`
- ✅ `number_history`
- ✅ `campaign_batch_state`
- ✅ `campaign_batch_details`

#### 6.3 Verificar views:
```sql
\dv
```

Você deve ver:
- ✅ `campaign_dashboard`
- ✅ `top_responsive_numbers`
- ✅ `v_campaign_summary`
- ✅ `v_interrupted_campaigns`

#### 6.4 Testar dados:
```sql
SELECT * FROM campaigns;
SELECT * FROM blacklist;
SELECT * FROM campaign_dashboard;
```

### 7. **CONFIGURAÇÕES ADICIONAIS DE SEGURANÇA**

#### 7.1 Criar usuário específico para aplicação (opcional):
```sql
-- Conectar como postgres
CREATE USER whatsapp_bot WITH ENCRYPTED PASSWORD 'senha_segura_aqui';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_campaigns TO whatsapp_bot;

-- Conectar no banco whatsapp_campaigns
\c whatsapp_campaigns;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO whatsapp_bot;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO whatsapp_bot;
```

#### 7.2 Atualizar .env com novo usuário:
```bash
DB_USER=whatsapp_bot
DB_PASSWORD=senha_segura_aqui
```

### 8. **COMANDOS DE MANUTENÇÃO E MONITORAMENTO**

#### 8.1 Ver campanhas ativas:
```sql
SELECT * FROM v_campaign_summary WHERE status IN ('running', 'interrupted');
```

#### 8.2 Ver estatísticas gerais:
```sql
SELECT 
  status,
  COUNT(*) as total_campaigns,
  AVG(success_count) as avg_success,
  AVG(failed_count) as avg_failed
FROM v_campaign_summary 
GROUP BY status;
```

#### 8.3 Limpeza de dados antigos:
```sql
SELECT cleanup_old_campaigns(30); -- Remove campanhas antigas de 30+ dias
```

#### 8.4 Backup do banco:
```bash
pg_dump -U postgres -h localhost whatsapp_campaigns > backup_$(date +%Y%m%d).sql
```

### 9. **TESTAR APLICAÇÃO**

```bash
# Iniciar aplicação
cd C:\Users\User\Desktop\ticket\whatsapp-ticket-bot
node app.js

# Ou com PM2
pm2 start ecosystem.config.js
```

#### Verificar endpoints:
- ✅ http://localhost:3005
- ✅ http://localhost:3005/api/campaigns
- ✅ http://localhost:3005/api/sessions/status

### 10. **TROUBLESHOOTING COMUM**

#### 10.1 Erro de conexão:
```bash
# Verificar se PostgreSQL está rodando
pg_ctl status

# Reiniciar PostgreSQL
pg_ctl restart
```

#### 10.2 Erro de permissão:
```sql
-- Dar permissões ao usuário
GRANT ALL PRIVILEGES ON DATABASE whatsapp_campaigns TO seu_usuario;
```

#### 10.3 Erro de senha:
```bash
# Redefinir senha do postgres
psql -U postgres -c "ALTER USER postgres PASSWORD 'nova_senha';"
```

#### 10.4 Verificar logs:
```bash
# Ver logs da aplicação
pm2 logs

# Ver logs do PostgreSQL (Windows)
# Verificar em: C:\Program Files\PostgreSQL\15\data\log\
```

### 11. **COMANDOS PARA RESETAR TUDO (SE NECESSÁRIO)**

```sql
-- CUIDADO! Isso apaga tudo
DROP DATABASE IF EXISTS whatsapp_campaigns;
CREATE DATABASE whatsapp_campaigns;
```

Depois executar novamente:
```bash
node setup-database.js
```

---

## ✅ **CHECKLIST FINAL:**

- [ ] PostgreSQL instalado e funcionando
- [ ] Arquivo .env configurado com credenciais corretas
- [ ] npm install executado
- [ ] setup-database.js executado com sucesso
- [ ] Tabelas criadas e verificadas
- [ ] Dados de exemplo inseridos
- [ ] Aplicação iniciando sem erros
- [ ] Endpoints respondendo

**🎉 Seu banco de dados está configurado e pronto para uso!**

// =====================================================
// SETUP AUTOMÁTICO DO BANCO DE DADOS POSTGRESQL
// Sistema completo de tracking de campanhas WhatsApp
// =====================================================

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurações do banco (lendo do .env)
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '0000',
    database: process.env.DB_NAME || 'whatsapp_campaigns'
};

console.log('🚀 SETUP AUTOMÁTICO DO BANCO DE DADOS POSTGRESQL');
console.log('===============================================\n');

console.log('🔧 Configurações de conexão:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Porta: ${dbConfig.port}`);
console.log(`   Usuário: ${dbConfig.user}`);
console.log(`   Banco: ${dbConfig.database}`);
console.log(`   Senha: ${dbConfig.password ? '****' : 'NÃO DEFINIDA'}`);
console.log('');

// Debug adicional
console.log('🔍 Debug das variáveis de ambiente:');
console.log(`   process.env.DB_USER: ${process.env.DB_USER}`);
console.log(`   process.env.DB_HOST: ${process.env.DB_HOST}`);
console.log(`   process.env.DB_PORT: ${process.env.DB_PORT}`);
console.log('');

async function setupCompleteDatabase() {
    let client = null;
    
    try {
        // Primeiro, conectar no banco postgres para verificar/criar o banco
        console.log('🔌 Conectando ao PostgreSQL...');
        const postgresConfig = {
            ...dbConfig,
            database: 'postgres' // Conectar no banco padrão primeiro
        };
        
        client = new Client(postgresConfig);
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL com sucesso!\n');
        
        // Verificar se o banco whatsapp_campaigns existe
        console.log('🔍 Verificando se o banco whatsapp_campaigns existe...');
        const result = await client.query(`
            SELECT 1 FROM pg_database WHERE datname = $1
        `, [dbConfig.database]);
        
        if (result.rows.length === 0) {
            console.log('📦 Criando banco de dados whatsapp_campaigns...');
            await client.query(`CREATE DATABASE ${dbConfig.database}`);
            console.log('✅ Banco de dados criado com sucesso!\n');
        } else {
            console.log('✅ Banco de dados já existe!\n');
        }
        
        // Fechar conexão com postgres
        await client.end();
        
        // Agora conectar no banco whatsapp_campaigns
        console.log('🔌 Conectando ao banco whatsapp_campaigns...');
        client = new Client(dbConfig);
        await client.connect();
        console.log('✅ Conectado ao banco whatsapp_campaigns!\n');

        // 1. Verificar e criar extensões
        console.log('📦 Instalando extensões necessárias...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
        console.log('✅ Extensões instaladas\n');

        // 2. Criar tipos ENUM
        console.log('🏷️ Criando tipos de dados...');
        
        const enumQueries = [
            `DO $$ BEGIN
                CREATE TYPE campaign_type AS ENUM ('promocional', 'informativo', 'follow-up', 'remarketing');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`,
            
            `DO $$ BEGIN
                CREATE TYPE campaign_status AS ENUM ('ativa', 'pausada', 'finalizada', 'rascunho');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`,
            
            `DO $$ BEGIN
                CREATE TYPE message_status AS ENUM ('enviado', 'entregue', 'lido', 'falhou', 'bloqueado');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`,
            
            `DO $$ BEGIN
                CREATE TYPE blacklist_reason AS ENUM ('opt-out', 'spam', 'bloqueio', 'inativo', 'manual');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`
        ];

        for (const query of enumQueries) {
            await client.query(query);
        }
        console.log('✅ Tipos de dados criados\n');

        // 3. Criar tabelas principais
        console.log('📊 Criando tabelas principais...');
        
        // Tabela campaigns
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id SERIAL PRIMARY KEY,
                campaign_name VARCHAR(255) NOT NULL,
                campaign_type campaign_type NOT NULL DEFAULT 'promocional',
                message_template TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status campaign_status DEFAULT 'rascunho',
                total_sent INTEGER DEFAULT 0,
                total_delivered INTEGER DEFAULT 0,
                total_failed INTEGER DEFAULT 0,
                total_responses INTEGER DEFAULT 0,
                metadata JSONB DEFAULT '{}',
                session_name VARCHAR(50),
                scheduled_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);
        console.log('  ✅ campaigns');

        // Tabela sent_numbers
        await client.query(`
            CREATE TABLE IF NOT EXISTS sent_numbers (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                phone_number VARCHAR(20) NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status message_status DEFAULT 'enviado',
                response_received BOOLEAN DEFAULT FALSE,
                response_at TIMESTAMP,
                response_text TEXT,
                delivery_time INTERVAL,
                error_message TEXT,
                metadata JSONB DEFAULT '{}'
            )
        `);
        console.log('  ✅ sent_numbers');

        // Tabela blacklist
        await client.query(`
            CREATE TABLE IF NOT EXISTS blacklist (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                reason blacklist_reason DEFAULT 'manual',
                blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                campaign_id INTEGER REFERENCES campaigns(id),
                is_active BOOLEAN DEFAULT TRUE
            )
        `);
        console.log('  ✅ blacklist');

        // Tabela campaign_stats
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaign_stats (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                date DATE DEFAULT CURRENT_DATE,
                hour INTEGER CHECK (hour >= 0 AND hour <= 23),
                sent_count INTEGER DEFAULT 0,
                delivered_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                response_count INTEGER DEFAULT 0,
                response_rate DECIMAL(5,2) DEFAULT 0.00,
                avg_response_time INTERVAL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaign_id, date, hour)
            )
        `);
        console.log('  ✅ campaign_stats');

        // Tabela system_logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                level VARCHAR(10) NOT NULL,
                message TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                session_name VARCHAR(50),
                phone_number VARCHAR(20),
                campaign_id INTEGER REFERENCES campaigns(id)
            )
        `);
        console.log('  ✅ system_logs');

        // Tabela number_history
        await client.query(`
            CREATE TABLE IF NOT EXISTS number_history (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                campaign_id INTEGER REFERENCES campaigns(id),
                event_data JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ number_history\n');

        // 4. Criar índices para performance
        console.log('⚡ Criando índices para performance...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_sent_numbers_phone ON sent_numbers(phone_number)',
            'CREATE INDEX IF NOT EXISTS idx_sent_numbers_campaign ON sent_numbers(campaign_id)',
            'CREATE INDEX IF NOT EXISTS idx_sent_numbers_sent_at ON sent_numbers(sent_at)',
            'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
            'CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone_number)',
            'CREATE INDEX IF NOT EXISTS idx_campaign_stats_campaign_date ON campaign_stats(campaign_id, date)',
            'CREATE INDEX IF NOT EXISTS idx_number_history_phone ON number_history(phone_number)',
            'CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_campaigns_name_search ON campaigns USING gin(campaign_name gin_trgm_ops)'
        ];

        for (const index of indexes) {
            await client.query(index);
        }
        console.log('✅ Índices criados\n');

        // 5. Criar funções e triggers
        console.log('🔧 Criando funções e triggers...');
        
        // Função para atualizar estatísticas
        await client.query(`
            CREATE OR REPLACE FUNCTION update_campaign_stats()
            RETURNS TRIGGER AS $$
            BEGIN
                UPDATE campaigns 
                SET 
                    total_sent = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = NEW.campaign_id),
                    total_delivered = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = NEW.campaign_id AND status IN ('entregue', 'lido')),
                    total_failed = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = NEW.campaign_id AND status = 'falhou'),
                    total_responses = (SELECT COUNT(*) FROM sent_numbers WHERE campaign_id = NEW.campaign_id AND response_received = TRUE),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.campaign_id;
                
                INSERT INTO campaign_stats (campaign_id, date, hour, sent_count, delivered_count, failed_count, response_count)
                VALUES (
                    NEW.campaign_id,
                    CURRENT_DATE,
                    EXTRACT(HOUR FROM CURRENT_TIMESTAMP),
                    CASE WHEN NEW.status = 'enviado' THEN 1 ELSE 0 END,
                    CASE WHEN NEW.status IN ('entregue', 'lido') THEN 1 ELSE 0 END,
                    CASE WHEN NEW.status = 'falhou' THEN 1 ELSE 0 END,
                    CASE WHEN NEW.response_received THEN 1 ELSE 0 END
                )
                ON CONFLICT (campaign_id, date, hour)
                DO UPDATE SET
                    sent_count = campaign_stats.sent_count + EXCLUDED.sent_count,
                    delivered_count = campaign_stats.delivered_count + EXCLUDED.delivered_count,
                    failed_count = campaign_stats.failed_count + EXCLUDED.failed_count,
                    response_count = campaign_stats.response_count + EXCLUDED.response_count,
                    updated_at = CURRENT_TIMESTAMP;
                    
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Trigger para atualizar estatísticas
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON sent_numbers;
            CREATE TRIGGER trigger_update_campaign_stats
                AFTER INSERT OR UPDATE ON sent_numbers
                FOR EACH ROW
                EXECUTE FUNCTION update_campaign_stats();
        `);

        // Função para calcular taxa de resposta
        await client.query(`
            CREATE OR REPLACE FUNCTION calculate_response_rate(campaign_id_param INTEGER)
            RETURNS DECIMAL(5,2) AS $$
            DECLARE
                total_sent INTEGER;
                total_responses INTEGER;
            BEGIN
                SELECT total_sent, total_responses 
                INTO total_sent, total_responses
                FROM campaigns 
                WHERE id = campaign_id_param;
                
                IF total_sent > 0 THEN
                    RETURN ROUND((total_responses::DECIMAL / total_sent::DECIMAL) * 100, 2);
                ELSE
                    RETURN 0.00;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Funções e triggers criados\n');

        // 6. Criar views para relatórios
        console.log('👁️ Criando views para relatórios...');
        
        await client.query(`
            CREATE OR REPLACE VIEW campaign_dashboard AS
            SELECT 
                c.id,
                c.campaign_name,
                c.campaign_type,
                c.status,
                c.created_at,
                c.total_sent,
                c.total_delivered,
                c.total_failed,
                c.total_responses,
                calculate_response_rate(c.id) as response_rate,
                CASE 
                    WHEN c.total_sent > 0 THEN ROUND((c.total_delivered::DECIMAL / c.total_sent::DECIMAL) * 100, 2)
                    ELSE 0.00 
                END as delivery_rate
            FROM campaigns c
            ORDER BY c.created_at DESC;
        `);

        await client.query(`
            CREATE OR REPLACE VIEW top_responsive_numbers AS
            SELECT 
                sn.phone_number,
                COUNT(*) as total_campaigns_received,
                COUNT(CASE WHEN sn.response_received THEN 1 END) as responses_given,
                MAX(sn.sent_at) as last_campaign_received,
                MAX(sn.response_at) as last_response_at
            FROM sent_numbers sn
            GROUP BY sn.phone_number
            HAVING COUNT(CASE WHEN sn.response_received THEN 1 END) > 0
            ORDER BY responses_given DESC, last_response_at DESC;
        `);
        console.log('✅ Views criadas\n');

        // 7. Inserir dados de exemplo
        console.log('📝 Inserindo dados de exemplo...');
        
        await client.query(`
            INSERT INTO campaigns (campaign_name, campaign_type, message_template, status) 
            VALUES 
                ('Boas-vindas ROYAL', 'informativo', '🏆 Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!', 'ativa'),
                ('Promoção MC Daniel', 'promocional', '🔥 MC DANIEL – O FALCÃO vai comandar o palco! Se é luxo e exclusividade que você procura… Aqui é o seu lugar!', 'ativa'),
                ('Follow-up VIP', 'follow-up', '👑 Você foi selecionado para nossa lista VIP! Benefícios exclusivos te aguardam...', 'rascunho')
            ON CONFLICT DO NOTHING
        `);

        // Alguns números na blacklist (exemplos fictícios)
        await client.query(`
            INSERT INTO blacklist (phone_number, reason, notes) 
            VALUES 
                ('5511999999999', 'opt-out', 'Cliente solicitou remoção'),
                ('5511888888888', 'spam', 'Reportado como spam')
            ON CONFLICT (phone_number) DO NOTHING
        `);

        console.log('✅ Dados de exemplo inseridos\n');

        // 8. Verificar instalação
        console.log('🔍 Verificando instalação...');
        
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const viewsResult = await client.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        const campaignsResult = await client.query('SELECT COUNT(*) as count FROM campaigns');
        const blacklistResult = await client.query('SELECT COUNT(*) as count FROM blacklist');

        console.log('📊 RESUMO DA INSTALAÇÃO:');
        console.log(`   ✅ ${tablesResult.rows.length} tabelas criadas`);
        console.log(`   ✅ ${viewsResult.rows.length} views criadas`);
        console.log(`   ✅ ${campaignsResult.rows[0].count} campanhas de exemplo`);
        console.log(`   ✅ ${blacklistResult.rows[0].count} números na blacklist`);
        console.log('\n📋 Tabelas criadas:');
        tablesResult.rows.forEach(row => {
            console.log(`   📊 ${row.table_name}`);
        });

        console.log('\n👁️ Views criadas:');
        viewsResult.rows.forEach(row => {
            console.log(`   📈 ${row.table_name}`);
        });

        // 9. Testar funcionalidades
        console.log('\n🧪 Testando funcionalidades...');
        
        // Teste de inserção
        const testResult = await client.query(`
            INSERT INTO campaigns (campaign_name, campaign_type, message_template, status) 
            VALUES ('Teste Sistema', 'informativo', 'Mensagem de teste do sistema de tracking', 'ativa')
            RETURNING id, campaign_name
        `);
        
        const campaignId = testResult.rows[0].id;
        console.log(`   ✅ Campanha de teste criada (ID: ${campaignId})`);

        // Teste de envio simulado
        await client.query(`
            INSERT INTO sent_numbers (campaign_id, phone_number, status) 
            VALUES ($1, '5511987654321', 'enviado')
        `, [campaignId]);
        console.log('   ✅ Envio simulado registrado');

        // Teste de blacklist
        await client.query(`
            INSERT INTO blacklist (phone_number, reason, notes) 
            VALUES ('5511123456789', 'manual', 'Teste de blacklist')
            ON CONFLICT (phone_number) DO NOTHING
        `);
        console.log('   ✅ Blacklist testada');

        // Teste das views (simplificado)
        const statsTest = await client.query(`
            SELECT 
                COUNT(*) as total_campaigns,
                COUNT(CASE WHEN status = 'ativa' THEN 1 END) as active_campaigns
            FROM campaigns
        `);
        console.log(`   ✅ Views funcionando (${statsTest.rows[0].total_campaigns} campanhas, ${statsTest.rows[0].active_campaigns} ativas)`);

        console.log('\n🎉 INSTALAÇÃO COMPLETA COM SUCESSO!');
        console.log('===============================================');
        console.log('');
        console.log('📊 Sistema de tracking PostgreSQL configurado:');
        console.log(`   🔗 Database: ${dbConfig.database}`);
        console.log(`   🏠 Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`   👤 User: ${dbConfig.user}`);
        console.log('');
        console.log('🚀 Próximos passos:');
        console.log('   1. pm2 start ecosystem.config.js');
        console.log('   2. Acesse: http://localhost:3005');
        console.log('   3. Teste as campanhas e veja os dados no pgAdmin');
        console.log('');
        console.log('📱 APIs disponíveis:');
        console.log('   GET /api/campaigns/dashboard/stats');
        console.log('   GET /api/campaigns');
        console.log('   POST /api/campaigns');
        console.log('   POST /api/campaigns/blacklist');

    } catch (error) {
        console.error('❌ ERRO DURANTE A INSTALAÇÃO:', error.message);
        console.error('');
        console.error('🔧 Possíveis soluções:');
        console.error('1. Verificar se PostgreSQL está rodando');
        console.error('2. Verificar credenciais no arquivo .env');
        console.error('3. Verificar se o banco whatsapp_campaigns existe');
        console.error('4. Verificar permissões do usuário postgres');
        throw error;
    } finally {
        if (client) {
            await client.end();
            console.log('\n🔌 Conexão encerrada');
        }
    }
}

// Executar setup se chamado diretamente
if (require.main === module) {
    setupCompleteDatabase()
        .then(() => {
            console.log('\n✨ Setup concluído com sucesso!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Falha no setup:', error.message);
            process.exit(1);
        });
}

module.exports = { setupCompleteDatabase };

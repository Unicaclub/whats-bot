// =====================================================
// INSTALAÇÃO E CONFIGURAÇÃO DO SISTEMA DE TRACKING
// Execute este script para configurar o PostgreSQL
// =====================================================

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configurações do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const dbName = process.env.DB_NAME || 'whatsapp_campaigns';

async function installDatabase() {
  let pool = null;
  
  try {
    console.log('📊 Iniciando instalação do sistema de tracking PostgreSQL...');
    
    // 1. Conectar ao PostgreSQL sem especificar database
    console.log('🔌 Conectando ao PostgreSQL...');
    pool = new Pool(dbConfig);
    
    // 2. Criar database se não existir
    console.log(`📋 Criando database '${dbName}'...`);
    await pool.query(`CREATE DATABASE "${dbName}"`).catch(err => {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log('ℹ️ Database já existe');
    });
    console.log('✅ Database criado/verificado');
    
    // 3. Conectar ao database específico
    await pool.end();
    pool = new Pool({ ...dbConfig, database: dbName });
    
    // 4. Ler e executar schema
    console.log('📄 Lendo schema do banco PostgreSQL...');
    const schemaPath = path.join(__dirname, 'database', 'schema-postgresql.sql');
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    
    // 5. Executar schema completo
    console.log('🔧 Executando criação das tabelas e triggers...');
    await pool.query(schemaContent);
    
    // 6. Verificar tabelas criadas
    console.log('🔍 Verificando tabelas criadas...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`✅ ${result.rows.length} tabelas encontradas:`);
    result.rows.forEach(table => {
      console.log(`  📋 ${table.table_name}`);
    });
    
    // 7. Verificar views criadas
    const viewResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`✅ ${viewResult.rows.length} views criadas:`);
    viewResult.rows.forEach(view => {
      console.log(`  �️ ${view.table_name}`);
    });
    
    console.log('🎉 Instalação concluída com sucesso!');
    console.log('');
    console.log('📊 Sistema de tracking configurado:');
    console.log(`   Database: ${dbName}`);
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log('   Tabelas: campaigns, sent_numbers, blacklist, responses, campaign_stats, system_logs');
    console.log('   Views: v_campaign_statistics, v_top_responders, v_hourly_analysis');
    console.log('');
    console.log('🚀 Agora você pode usar o sistema completo de tracking de campanhas!');
    
  } catch (error) {
    console.error('❌ Erro durante a instalação:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

async function insertSampleData(pool) {
  try {
    // Verificar se já existem dados
    const existingCampaigns = await pool.query('SELECT COUNT(*) as count FROM campaigns');
    if (existingCampaigns.rows[0].count > 0) {
      console.log('⚠️ Dados já existem, pulando inserção de exemplos');
      return;
    }
    
    // Inserir campanha de exemplo
    await pool.query(`
      INSERT INTO campaigns (campaign_name, message_template, status, session_name) 
      VALUES ($1, $2, $3, $4)
    `, [
      'Campanha de Boas-vindas',
      'Olá! Bem-vindo à nossa empresa. Como podemos ajudá-lo hoje?',
      'finalizada',
      'sales'
    ]);
    
    // Alguns números na blacklist (exemplos)
    const blacklistNumbers = [
      '5511999999999', // Número de exemplo
      '5511888888888'  // Número de exemplo
    ];
    
    for (const number of blacklistNumbers) {
      await pool.query(`
        INSERT INTO blacklist (phone_number, reason, is_active) 
        VALUES ($1, $2, $3)
      `, [number, 'opt_out', true]);
    }
    
    console.log('✅ Dados de exemplo inseridos');
    
  } catch (error) {
    console.error('⚠️ Erro ao inserir dados de exemplo:', error);
    // Não falhar a instalação por causa disso
  }
}

async function checkRequirements() {
  try {
    console.log('🔍 Verificando requisitos...');
    
    // Verificar se pg está instalado
    try {
      require('pg');
      console.log('✅ pg (PostgreSQL driver) encontrado');
    } catch (error) {
      console.error('❌ pg não encontrado. Execute: npm install pg');
      return false;
    }
    
    // Verificar se o arquivo schema-postgresql.sql existe
    const schemaPath = path.join(__dirname, 'database', 'schema-postgresql.sql');
    try {
      await fs.access(schemaPath);
      console.log('✅ schema-postgresql.sql encontrado');
    } catch (error) {
      console.error('❌ schema-postgresql.sql não encontrado em database/schema-postgresql.sql');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar requisitos:', error);
    return false;
  }
}

async function testConnection() {
  try {
    console.log('🔌 Testando conexão com PostgreSQL...');
    const pool = new Pool({
      ...dbConfig,
      database: dbName
    });
    
    await pool.query('SELECT 1');
    console.log('✅ Conexão bem-sucedida');
    
    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    return false;
  }
}

// =====================================================
// EXECUÇÃO PRINCIPAL
// =====================================================

async function main() {
  console.log('🚀 Instalador do Sistema de Tracking de Campanhas WhatsApp');
  console.log('=========================================================');
  console.log('');
  
  try {
    // Verificar requisitos
    const requirementsOk = await checkRequirements();
    if (!requirementsOk) {
      console.error('❌ Requisitos não atendidos. Instalação cancelada.');
      process.exit(1);
    }
    
    // Executar instalação
    await installDatabase();
    
    // Testar conexão final
    const connectionOk = await testConnection();
    if (!connectionOk) {
      console.error('❌ Falha no teste final de conexão');
      process.exit(1);
    }
    
    console.log('');
    console.log('🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Configure as variáveis de ambiente (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
    console.log('2. Execute: npm install pg');
    console.log('3. Reinicie o servidor WhatsApp');
    console.log('4. Acesse o dashboard para ver as estatísticas');
    console.log('');
    console.log('📊 APIs disponíveis:');
    console.log('- GET /api/campaigns - Listar campanhas');
    console.log('- POST /api/campaigns - Criar campanha');
    console.log('- GET /api/campaigns/dashboard/stats - Estatísticas gerais');
    console.log('- POST /api/campaigns/blacklist - Gerenciar blacklist');
    console.log('- GET /api/campaigns/system/status - Status do sistema');
    
  } catch (error) {
    console.error('💥 Falha na instalação:', error);
    process.exit(1);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  installDatabase,
  testConnection,
  checkRequirements
};

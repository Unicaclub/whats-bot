// =====================================================
// APIS DE GERENCIAMENTO DE CAMPANHAS E TRACKING
// Endpoints para controle completo do sistema
// =====================================================

const express = require('express');
const { getCampaignTracker } = require('../modules/campaignTracker');

const router = express.Router();

// =====================================================
// MIDDLEWARE DE INICIALIZAÇÃO
// =====================================================

router.use(async (req, res, next) => {
  try {
    if (!req.campaignTracker) {
      req.campaignTracker = getCampaignTracker();
    }
    next();
  } catch (error) {
    console.error('❌ Erro ao inicializar tracker nas APIs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do sistema de tracking'
    });
  }
});

// =====================================================
// APIS DE CAMPANHAS
// =====================================================

// Criar nova campanha
router.post('/campaigns', async (req, res) => {
  try {
    const { name, message, targets, sessionName } = req.body;
    
    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: 'Nome e mensagem são obrigatórios'
      });
    }
    
    const campaignId = await req.campaignTracker.createCampaign({
      name,
      message,
      sessionName: sessionName || 'sales',
      totalTargets: Array.isArray(targets) ? targets.length : 0
    });
    
    res.json({
      success: true,
      campaignId,
      message: 'Campanha criada com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar campanha:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Listar campanhas
router.get('/campaigns', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM campaigns';
    let params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const campaigns = await req.campaignTracker.db.query(query, params);
    
    res.json({
      success: true,
      campaigns,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: campaigns.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar campanhas:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Obter detalhes de campanha
router.get('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await req.campaignTracker.db.getCampaign(id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }
    
    // Obter estatísticas detalhadas
    const stats = await req.campaignTracker.db.getCampaignStats(id);
    const recentSends = await req.campaignTracker.db.query(`
      SELECT phone_number, sent_at, status, error_message
      FROM sent_numbers 
      WHERE campaign_id = $1 
      ORDER BY sent_at DESC 
      LIMIT 10
    `, [id]);
    
    res.json({
      success: true,
      campaign: {
        ...campaign,
        stats,
        recentSends
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter campanha:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Relatório completo de campanha
router.get('/campaigns/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await req.campaignTracker.getCampaignReport(id);
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Exportar dados de campanha
router.get('/campaigns/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'csv' } = req.query;
    
    const data = await req.campaignTracker.exportCampaignData(id, format);
    const filename = `campanha_${id}_${Date.now()}.${format}`;
    
    switch (format.toLowerCase()) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        break;
      default:
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.send(data);
    
  } catch (error) {
    console.error('❌ Erro ao exportar campanha:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================================
// APIS DE BLACKLIST
// =====================================================

// Adicionar à blacklist
router.post('/blacklist', async (req, res) => {
  try {
    const { phoneNumber, reason } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone é obrigatório'
      });
    }
    
    const result = await req.campaignTracker.addToBlacklist(phoneNumber, reason || 'manual');
    
    if (result) {
      res.json({
        success: true,
        message: 'Número adicionado à blacklist'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Número já está na blacklist ou erro ao adicionar'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao adicionar à blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Remover da blacklist
router.delete('/blacklist/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await req.campaignTracker.removeFromBlacklist(phone);
    
    if (result) {
      res.json({
        success: true,
        message: 'Número removido da blacklist'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Número não encontrado na blacklist'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao remover da blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Listar blacklist
router.get('/blacklist', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const blacklist = await req.campaignTracker.db.query(`
      SELECT phone_number, reason, created_at, campaign_id
      FROM blacklist 
      WHERE is_active = TRUE 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    
    const total = await req.campaignTracker.db.queryOne(`
      SELECT COUNT(*) as count FROM blacklist WHERE is_active = TRUE
    `);
    
    res.json({
      success: true,
      blacklist,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: total?.count || 0,
        hasMore: blacklist.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar blacklist:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================================
// APIS DE VERIFICAÇÃO E VALIDAÇÃO
// =====================================================

// Verificar se pode enviar para um número
router.post('/validate/send', async (req, res) => {
  try {
    const { phoneNumber, campaignId, checkDuplicates = true } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone é obrigatório'
      });
    }
    
    const validation = await req.campaignTracker.canSendToNumber(
      campaignId, 
      phoneNumber, 
      checkDuplicates
    );
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error) {
    console.error('❌ Erro na validação:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Verificar limite diário
router.get('/validate/daily-limit/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit = 3 } = req.query;
    
    const dailyCheck = await req.campaignTracker.checkDailyLimit(phone, parseInt(limit));
    
    res.json({
      success: true,
      dailyLimit: dailyCheck
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar limite diário:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================================
// APIS DE ESTATÍSTICAS E RELATÓRIOS
// =====================================================

// Dashboard geral
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await req.campaignTracker.getDashboardStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Atividade recente
router.get('/dashboard/activity', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const activity = await req.campaignTracker.getRecentActivity(parseInt(limit));
    
    res.json({
      success: true,
      activity
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter atividade:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Top respondedores
router.get('/reports/top-responders', async (req, res) => {
  try {
    const { campaignId, limit = 20 } = req.query;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'ID da campanha é obrigatório'
      });
    }
    
    const topResponders = await req.campaignTracker.db.getTopResponders(
      campaignId, 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      topResponders
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter top responders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Estatísticas por horário
router.get('/reports/hourly-stats', async (req, res) => {
  try {
    const { campaignId, date } = req.query;
    
    let query = `
      SELECT 
        HOUR(sent_at) as hour,
        COUNT(*) as sent_count,
        SUM(CASE WHEN response_received = TRUE THEN 1 ELSE 0 END) as response_count,
        AVG(CASE WHEN response_received = TRUE THEN 1 ELSE 0 END) * 100 as response_rate
      FROM sent_numbers 
      WHERE 1=1
    `;
    
    const params = [];
    
    if (campaignId) {
      query += ' AND campaign_id = $1';
      params.push(campaignId);
    }
    
    if (date) {
      query += ` AND DATE(sent_at) = $${params.length + 1}`;
      params.push(date);
    }
    
    query += ' GROUP BY EXTRACT(HOUR FROM sent_at) ORDER BY EXTRACT(HOUR FROM sent_at)';
    
    const hourlyStats = await req.campaignTracker.db.query(query, params);
    
    res.json({
      success: true,
      hourlyStats
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas horárias:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================================
// APIS DE TESTE E DEBUG
// =====================================================

// Status do sistema
router.get('/system/status', async (req, res) => {
  try {
    const dbStatus = await req.campaignTracker.db.testConnection();
    const cacheStatus = {
      blacklistSize: req.campaignTracker.blacklistCache.size,
      activeCampaigns: req.campaignTracker.activeCampaigns.size,
      recentSends: req.campaignTracker.recentSends.size
    };
    
    res.json({
      success: true,
      system: {
        database: dbStatus ? 'connected' : 'disconnected',
        cache: cacheStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

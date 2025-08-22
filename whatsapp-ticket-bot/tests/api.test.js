// ================================================
// TESTES PARA API ENDPOINTS
// Testa todas as rotas principais da aplicação
// ================================================

const request = require('supertest');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

// Importar a aplicação Express
// Note: Você precisará refatorar app.js para exportar o app Express
const app = require('../app'); // Assumindo que app.js exportará o Express app

describe('API Endpoints', () => {
  let server;

  beforeAll(async () => {
    // Iniciar servidor para testes
    server = app.listen(3007);
  });

  afterAll(async () => {
    // Fechar servidor após testes
    await server.close();
  });

  // ================================================
  // TESTES DE HEALTH CHECK
  // ================================================
  describe('Health Check', () => {
    test('GET /health deve retornar status 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  // ================================================
  // TESTES DE UPLOAD
  // ================================================
  describe('Upload de Arquivos', () => {
    test('POST /api/upload/numbers deve aceitar arquivo CSV', async () => {
      const csvContent = 'numero,nome\n5511999999999,Teste\n5511888888888,Teste2';
      
      const response = await request(app)
        .post('/api/upload/numbers')
        .attach('numbersFile', Buffer.from(csvContent), 'test.csv')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fileInfo');
    });

    test('POST /api/upload/numbers deve rejeitar arquivo inválido', async () => {
      const response = await request(app)
        .post('/api/upload/numbers')
        .attach('numbersFile', Buffer.from('invalid content'), 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ================================================
  // TESTES DE CAMPANHAS
  // ================================================
  describe('Campanhas', () => {
    test('POST /api/campaigns/send deve iniciar campanha', async () => {
      const campaignData = {
        sessionName: 'sales',
        message: 'Mensagem de teste',
        numbers: ['5511999999999@c.us']
      };

      const response = await request(app)
        .post('/api/campaigns/send')
        .send(campaignData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    test('POST /api/campaigns/send deve rejeitar dados inválidos', async () => {
      const response = await request(app)
        .post('/api/campaigns/send')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ================================================
  // TESTES DE SESSÕES
  // ================================================
  describe('Controle de Sessões', () => {
    test('POST /api/sessions/sales/start deve iniciar sessão de vendas', async () => {
      const response = await request(app)
        .post('/api/sessions/sales/start')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('POST /api/sessions/invalid/start deve retornar erro', async () => {
      const response = await request(app)
        .post('/api/sessions/invalid/start')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

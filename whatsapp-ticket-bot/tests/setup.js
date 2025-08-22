// ================================================
// SETUP PARA TESTES JEST
// Configuração global para todos os testes
// ================================================

// Configurar timeout para testes que fazem requisições externas
jest.setTimeout(30000);

// Mock das variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'test_db';
process.env.PORT = '3007'; // Porta diferente para testes

// Mock do OpenAI para não fazer requisições reais
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'Mock response from OpenAI'
              }
            }]
          })
        }
      }
    }))
  };
});

// Mock do wppconnect para não inicializar WhatsApp real
jest.mock('@wppconnect-team/wppconnect', () => ({
  create: jest.fn().mockResolvedValue({
    onMessage: jest.fn(),
    sendText: jest.fn().mockResolvedValue({ id: 'mock-message-id' }),
    sendSeen: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
    checkNumberStatus: jest.fn().mockResolvedValue({ numberExists: true }),
    close: jest.fn()
  })
}));

// Configurar limpeza após cada teste
afterEach(() => {
  jest.clearAllMocks();
});

// Configurar limpeza após todos os testes
afterAll(async () => {
  // Fechar conexões de banco se houver
  if (global.__db__) {
    await global.__db__.end();
  }
});

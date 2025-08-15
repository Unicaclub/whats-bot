# 🛠️ GUIA DE SOLUÇÃO DE PROBLEMAS
# Bot WhatsApp - Vendas de Ingressos

## 🚨 PROBLEMAS MAIS COMUNS

### ❌ 1. BOT NÃO CONECTA AO WHATSAPP

#### Sintomas:
- QR Code não aparece
- QR Code expira rapidamente
- Erro "Session Unpaired"
- Bot fica em loop de conexão

#### Soluções:
```bash
# 1. Limpar sessão anterior
rm -rf tokens/

# 2. Reiniciar completamente
Ctrl+C (parar bot)
node app.js (reiniciar)

# 3. Verificar WhatsApp Web
- Abra web.whatsapp.com no navegador
- Se funcionar, o bot deve funcionar

# 4. Limpar cache do navegador
- Dados do WhatsApp Web podem conflitar
```

#### Checklist de Verificação:
- ✅ WhatsApp está funcionando no celular?
- ✅ Internet está estável?
- ✅ Apenas um dispositivo conectado ao WhatsApp Web?
- ✅ Firewall/antivírus não está bloqueando?

---

### ❌ 2. MENSAGENS NÃO SÃO ENVIADAS

#### Sintomas:
- Bot conectado mas não envia mensagens
- Erro "Failed to send message"
- Mensagens ficam pendentes

#### Diagnóstico:
```bash
# Verificar logs em tempo real
tail -f logs/bot-$(date +%Y-%m-%d).log

# Buscar erros específicos
grep "Erro ao enviar" logs/bot-*.log
```

#### Soluções:
```javascript
// 1. Verificar formato dos números
Correto: 5511999999999@c.us
Errado: +55 (11) 99999-9999

// 2. Aumentar delay
DEFAULT_DELAY=5000  // 5 segundos

// 3. Reduzir limite por minuto
MAX_MESSAGES_PER_MINUTE=10
```

#### Testes:
```bash
# Teste com um número só
1. Carregue lista com apenas 1 número
2. Envie mensagem simples
3. Verifique se chegou
```

---

### ❌ 3. INTERFACE WEB NÃO CARREGA

#### Sintomas:
- Página não abre em localhost:3000
- Erro "Cannot connect to server"
- Página carrega mas está em branco

#### Soluções:
```bash
# 1. Verificar se porta está em uso
netstat -ano | findstr :3000

# 2. Usar porta alternativa
# No arquivo .env:
PORT=3001

# 3. Verificar firewall
# Windows: Permitir node.exe no firewall

# 4. Testar em navegador diferente
# Chrome, Firefox, Edge
```

#### Logs para Verificar:
```bash
# Bot deve mostrar:
"🌐 Interface web disponível em: http://localhost:3000"

# Se não aparecer, há erro no Express
```

---

### ❌ 4. UPLOAD DE LISTA FALHA

#### Sintomas:
- Erro ao processar arquivo
- "Nenhum número encontrado"
- Upload trava na metade

#### Formatos Corretos:
```csv
# CSV (recomendado)
numero,nome
5511999999999,João
5511888888888,Maria
```

```txt
# TXT (simples)
5511999999999
5511888888888
5511777777777
```

#### Verificações:
- ✅ Arquivo tem extensão .csv ou .txt?
- ✅ Números estão no formato correto?
- ✅ Arquivo não está corrompido?
- ✅ Tamanho menor que 10MB?
- ✅ Codificação UTF-8?

#### Teste:
```bash
# Use o arquivo exemplo incluído
exemplo-numeros.csv
```

---

### ❌ 5. IA OPENAI NÃO FUNCIONA

#### Sintomas:
- Respostas genéricas sempre
- Erro "OpenAI API error"
- Bot usa fallback automático

#### Verificações:
```bash
# 1. Chave API válida
curl -H "Authorization: Bearer SUA_CHAVE" \
https://api.openai.com/v1/models

# 2. Créditos disponíveis
# Verificar em: platform.openai.com/usage

# 3. Logs de erro
grep "OpenAI" logs/bot-*.log
```

#### Soluções:
```env
# .env - Verificar chave
OPENAI_API_KEY=sua_chave_openai_aqui

# Se não funcionar, o bot usa respostas automáticas
# (funcionalidade não é perdida)
```

---

### ❌ 6. CAMPANHA PARA EM NÚMEROS ESPECÍFICOS

#### Sintomas:
- Campanha para em determinados números
- Alguns números não recebem
- Taxa de falha alta

#### Diagnóstico:
```bash
# Verificar quais números falharam
grep "Falha na campanha" logs/bot-*.log
```

#### Causas Comuns:
- 📱 Número inexistente ou inválido
- 🚫 Usuário bloqueou o bot
- 📵 WhatsApp desinstalado
- 🔒 Configurações de privacidade

#### Soluções:
```bash
# 1. Limpar lista de números inválidos
# Remover números que sempre falham

# 2. Aumentar delay entre mensagens
DEFAULT_DELAY=5000

# 3. Enviar em lotes menores
# Dividir lista grande em várias pequenas
```

---

### ❌ 7. BOT TRAVA OU CONGELA

#### Sintomas:
- Bot para de responder
- Interface web não atualiza
- Processo ainda está rodando mas inativo

#### Diagnóstico:
```bash
# Verificar se processo está ativo
ps aux | grep node

# Verificar uso de memória
top -p $(pgrep node)
```

#### Soluções:
```bash
# 1. Reiniciar bot
Ctrl+C
node app.js

# 2. Aumentar memória
node --max-old-space-size=4096 app.js

# 3. Limpar logs antigos
find logs/ -name "*.log" -mtime +7 -delete
```

---

### ❌ 8. ERRO "Cannot find module"

#### Sintomas:
- Erro ao iniciar bot
- "Cannot find module 'xyz'"

#### Solução:
```bash
# Reinstalar dependências
rm -rf node_modules
rm package-lock.json
npm install
```

---

### ❌ 9. QR CODE NÃO APARECE OU É ILEGÍVEL

#### Sintomas:
- Terminal não mostra QR
- QR aparece cortado
- Caracteres estranhos

#### Soluções:
```bash
# 1. Redimensionar terminal
# Fazer terminal maior (mínimo 80x24)

# 2. Usar arquivo PNG
# Bot salva QR como qr-TIMESTAMP.png
# Abrir arquivo de imagem

# 3. Verificar encoding do terminal
# Windows: chcp 65001 (UTF-8)
```

---

### ❌ 10. BOT RESPONDE INCORRETAMENTE

#### Sintomas:
- Respostas não fazem sentido
- Bot não entende perguntas simples
- Sempre direciona para site

#### Configuração IA:
```javascript
// Editar no app.js - função classifyMessageIntent
// Adicionar mais palavras-chave:

if (lowerMessage.includes('preço') || 
    lowerMessage.includes('quanto') || 
    lowerMessage.includes('valor') ||
    lowerMessage.includes('custo')) {
  return 'PRECO';
}
```

#### Personalizar Respostas:
```javascript
// Editar respostas nos cases do switch
case 'PRECO':
  response = {
    text: `SUA RESPOSTA PERSONALIZADA AQUI`,
    link: process.env.COMPANY_WEBSITE
  };
```

---

## 🔧 FERRAMENTAS DE DIAGNÓSTICO

### 1. Verificação Completa do Sistema
```bash
# Executar no diretório do bot
node -e "
console.log('Node.js:', process.version);
console.log('Diretório:', process.cwd());
console.log('Arquivo app.js existe:', require('fs').existsSync('app.js'));
console.log('Arquivo .env existe:', require('fs').existsSync('.env'));
console.log('node_modules existe:', require('fs').existsSync('node_modules'));
"
```

### 2. Teste de Dependências
```bash
# Verificar se todas as dependências estão instaladas
npm ls
```

### 3. Teste de Conectividade
```bash
# Testar conexão com OpenAI
curl -H "Authorization: Bearer $(grep OPENAI_API_KEY .env | cut -d= -f2)" \
https://api.openai.com/v1/models
```

### 4. Monitor em Tempo Real
```bash
# Acompanhar logs em tempo real
tail -f logs/bot-$(date +%Y-%m-%d).log

# Filtrar apenas erros
tail -f logs/bot-*.log | grep -i error
```

---

## 📞 QUANDO BUSCAR AJUDA

### Colete Essas Informações:
1. **Sistema Operacional**: Windows 10/11
2. **Versão Node.js**: `node --version`
3. **Mensagem de erro completa**
4. **Logs relevantes** (últimas 50 linhas)
5. **Configurações do .env** (sem a chave API)

### Logs Úteis para Diagnóstico:
```bash
# Últimas atividades
tail -n 50 logs/bot-$(date +%Y-%m-%d).log

# Apenas erros
grep -i "erro\|error" logs/bot-*.log

# Status de conexão
grep -i "conectado\|connected" logs/bot-*.log
```

---

## ✅ TESTE FINAL DO SISTEMA

### Checklist Completo:
```bash
# 1. Bot inicia sem erros
node app.js
# Deve mostrar: "🚀 Iniciando Bot WhatsApp..."

# 2. QR Code aparece
# Deve mostrar código ASCII no terminal

# 3. Interface web carrega
# Abrir: http://localhost:3000

# 4. WhatsApp conecta
# Status deve ficar verde na interface

# 5. Teste de mensagem
# Enviar "teste" para o bot

# 6. Upload funciona
# Usar exemplo-numeros.csv

# 7. Campanha envia
# Teste com 1-2 números apenas
```

Se todos os passos funcionarem, o sistema está **100% operacional**! 🎫✅

---

**💡 Dica**: Mantenha sempre um backup das configurações e teste mudanças em ambiente separado antes de aplicar em produção.

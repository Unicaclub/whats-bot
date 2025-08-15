@echo off
echo ========================================
echo    WHATSAPP TICKET BOT - SETUP PM2
echo ========================================
echo.

echo [1/6] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js primeiro.
    pause
    exit /b 1
)
echo ✅ Node.js OK

echo.
echo [2/6] Instalando PM2 globalmente...
npm install -g pm2
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar PM2
    pause
    exit /b 1
)
echo ✅ PM2 instalado

echo.
echo [3/6] Instalando dependencias do projeto...
npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias
    pause
    exit /b 1
)
echo ✅ Dependências instaladas

echo.
echo [4/6] Instalando driver PostgreSQL...
npm install pg
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar PostgreSQL driver
    pause
    exit /b 1
)
echo ✅ PostgreSQL driver instalado

echo.
echo [5/6] Criando diretorios necessarios...
if not exist "logs" mkdir logs
if not exist "temp" mkdir temp
if not exist "uploads" mkdir uploads
echo ✅ Diretórios criados

echo.
echo [6/6] Configurando banco de dados PostgreSQL...
echo.
echo ATENÇÃO: Certifique-se de que o PostgreSQL está rodando!
echo Configure as variáveis de ambiente antes de continuar:
echo.
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_USER=postgres
echo DB_PASSWORD=sua_senha
echo DB_NAME=whatsapp_campaigns
echo.
set /p install_db="Deseja instalar o banco agora? (s/N): "
if /i "%install_db%"=="s" (
    node install.js
    if %errorlevel% neq 0 (
        echo ERRO: Falha na instalação do banco
        echo Configure manualmente e tente novamente
        pause
        exit /b 1
    )
    echo ✅ Banco de dados configurado
) else (
    echo ⚠️ Lembre-se de executar 'node install.js' mais tarde
)

echo.
echo [FINAL] Configurando PM2 para inicio automatico...
pm2 startup
echo.
echo ATENCAO: Execute o comando mostrado acima como Administrador
echo para configurar o inicio automatico do PM2.
echo.

echo ========================================
echo           INSTALACAO COMPLETA!
echo ========================================
echo.
echo Para iniciar o bot:
echo   pm2 start ecosystem.config.js
echo.
echo Para monitorar:
echo   pm2 monit
echo.
echo Para ver logs:
echo   pm2 logs whatsapp-ticket-bot
echo.
echo Para parar:
echo   pm2 stop whatsapp-ticket-bot
echo.
echo Para restart:
echo   pm2 restart whatsapp-ticket-bot
echo.
echo Para salvar configuracao:
echo   pm2 save
echo.
echo 📊 Sistema de tracking ativo com PostgreSQL!
echo APIs disponíveis em: http://localhost:3005/api/campaigns
echo.
pause

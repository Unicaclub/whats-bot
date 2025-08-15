@echo off
echo.
echo ================================================================
echo  BOT WHATSAPP VENDAS DE INGRESSOS - INSTALACAO AUTOMATICA
echo ================================================================
echo.

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js nao encontrado! 
    echo 📥 Baixe em: https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js encontrado

echo.
echo [2/4] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Erro na instalacao das dependencias
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas

echo.
echo [3/4] Criando diretorios necessarios...
if not exist "public" mkdir public
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs
echo ✅ Diretorios criados

echo.
echo [4/4] Configuracao finalizada!
echo.
echo ================================================================
echo  PROXIMOS PASSOS:
echo ================================================================
echo 1. Configure o arquivo .env com suas informacoes
echo 2. Execute: npm start
echo 3. Escaneie o QR Code no terminal
echo 4. Acesse: http://localhost:3000
echo ================================================================
echo.
pause

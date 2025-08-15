@echo off
echo.
echo ================================================================
echo  🔄 REINICIANDO BOT COM CORREÇÕES
echo ================================================================
echo.

echo 🛑 Parando processos Node.js existentes...
taskkill /f /im node.exe >nul 2>&1

echo.
echo ⏳ Aguardando 3 segundos...
timeout /t 3 >nul

echo.
echo 🚀 Reiniciando bot na porta 3001...
echo 📱 Interface web: http://localhost:3001
echo.

node app.js

echo.
echo ================================================================
echo  Bot finalizado. Pressione qualquer tecla para sair.
echo ================================================================
pause

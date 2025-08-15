@echo off
echo ================================================
echo    🚀 SCRIPT DE UPLOAD PARA NOVO REPOSITORIO
echo ================================================
echo.

echo ✅ Verificando diretorio...
if not exist "app.js" (
    echo ❌ Execute este script na pasta do projeto!
    pause
    exit /b 1
)

echo ✅ Projeto encontrado!
echo.

echo 📝 Inicializando Git...
git init

echo 📁 Adicionando arquivos...
git add .

echo 💾 Criando commit inicial...
git commit -m "🎫 Bot WhatsApp com Sistema Anti-Ban Completo - Upload Inicial"

echo.
echo ================================================
echo  ✅ REPOSITORIO LOCAL CRIADO COM SUCESSO!
echo ================================================
echo.
echo 🔗 PRÓXIMOS PASSOS:
echo.
echo 1. Crie um novo repositorio no GitHub
echo 2. Copie a URL do repositorio
echo 3. Execute o comando:
echo    git remote add origin URL_DO_SEU_REPOSITORIO
echo 4. Depois execute:
echo    git push -u origin main
echo.
echo ================================================
echo   🎯 PROJETO PRONTO PARA UPLOAD PUBLICO!
echo ================================================
pause

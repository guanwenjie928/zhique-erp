@echo off
chcp 65001 >nul
title 知雀进销存ERP训练系统

echo ============================================
echo   知雀进销存ERP训练系统 - 启动中...
echo ============================================
echo.

:: 启动后端
echo [1/2] 启动后端服务...
cd /d "%~dp0backend"
start /b python -m uvicorn main:app --host 127.0.0.1 --port 8000

:: 等待后端就绪
timeout /t 3 /nobreak >nul

:: 启动前端
echo [2/2] 启动前端服务...
cd /d "%~dp0frontend"
start /b npx vite --host 127.0.0.1 --port 5173

:: 等待前端就绪
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   启动成功！
echo ============================================
echo.
echo   请在浏览器中访问: http://localhost:5173
echo.
echo   默认用户: zhangming (采购员张明)
echo   管理员:   admin
echo.
echo   按任意键关闭所有服务...
pause >nul

:: 关闭服务
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1

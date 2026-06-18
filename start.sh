#!/bin/bash
# 知雀ERP一键启动脚本 (Linux/Mac)
cd "$(dirname "$0")"

echo "🐦 知雀进销存ERP训练系统 - 启动中..."

# 启动后端
echo "[1/2] 启动后端..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 等待后端就绪
sleep 3

# 启动前端
echo "[2/2] 启动前端..."
cd frontend
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 启动成功！"
echo "   前端: http://localhost:5173"
echo "   后端API: http://localhost:8000"
echo "   API文档: http://localhost:8000/docs"
echo ""
echo "   默认用户: zhangming (采购员张明)"
echo "   管理员:   admin"
echo ""
echo "   按 Ctrl+C 关闭所有服务"

# 捕获退出信号
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait

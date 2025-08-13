#!/bin/bash

# Load environment variables from backend .env file
if [ -f backend/.env ]; then
  export $(cat backend/.env | sed 's/#.*//g' | xargs)
fi

# Load environment variables from frontend .env file
if [ -f frontend/.env ]; then
  export $(cat frontend/.env | sed 's/#.*//g' | xargs)
fi

# Use environment variables or default values
FRONTEND_PORT=${REACT_APP_FRONTEND_PORT:-3000}
BACKEND_PORT=${BACKEND_PORT:-5001}

# 清理前端和后端可能占用的端口
echo "正在清理端口 $FRONTEND_PORT 和 $BACKEND_PORT..."
kill -9 $(lsof -t -i:$FRONTEND_PORT) 2>/dev/null || echo "端口$FRONTEND_PORT上没有找到进程"
kill -9 $(lsof -t -i:$BACKEND_PORT) 2>/dev/null || echo "端口$BACKEND_PORT上没有找到进程"

# 启动后端服务
echo "正在启动后端服务..."
cd backend
python3 app.py &
BACKEND_PID=$!
cd ..

# 启动前端开发服务器
echo "正在启动前端开发服务器..."
cd frontend
npm start &
FRONTEND_PID=$!

# 等待进程结束
wait $BACKEND_PID
wait $FRONTEND_PID
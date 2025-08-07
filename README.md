# AI知识库管理助手

这是一个基于飞书知识库API的AI知识库管理助手，包含前端和后端两个部分。

该应用可以帮助用户分析文档内容，判断是否适合导入知识库，并提供导入建议。

## 项目结构

- `frontend/` - React前端应用
- `backend/` - Python Flask后端服务
- `start.sh` - 一键启动脚本

## 环境变量配置

### 前端环境变量配置

在项目根目录复制 `.env.example` 文件为 `.env`，并配置以下环境变量：

```env
REACT_APP_FEISHU_APP_ID=your_feishu_app_id
REACT_APP_ENABLE_BACKEND_LOGGING=true # 可选，用于启用后端日志
```

### 后端环境变量配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
```

## 安装依赖

### 后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 前端依赖

```bash
cd frontend
npm install
```

## 启动项目

### 方法一：使用一键启动脚本（推荐）

```bash
./start.sh
```

该脚本会自动清理端口3000和5001上的进程，然后同时启动前端和后端服务。

### 方法二：分别启动

1. 启动后端服务：
   ```bash
   cd backend
   python app.py
   ```

2. 启动前端开发服务器：
   ```bash
   cd frontend
   npm start
   ```

## 端口信息

- 前端开发服务器运行在 `http://localhost:3000`
- 后端服务运行在 `http://localhost:5001`

## 测试应用

### 手动测试

1. 在浏览器中打开 http://localhost:3000
2. 使用界面与应用交互
3. 或者，您可以直接使用curl测试API：

```bash
curl -X POST http://localhost:5001/api/llm/doc_import_analysis \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "model": "your-model-id",
    "doc_content": "Your document content here",
    "wiki_node_md": "# Knowledge Base\n- Node 1\n- Node 2"
  }'
```

## API 端点

### 文档导入分析

- **端点**: `POST /api/llm/doc_import_analysis`
- **描述**: 分析文档以确定是否应将其导入知识库
- **参数**:
  - `api_key` (string, required): 用于认证的API密钥
  - `model` (string, required): 用于分析的模型ID
  - `doc_content` (string, required): 要分析的文档内容
  - `wiki_node_md` (string, required): 以markdown格式表示的当前知识库结构

## 故障排除

1. 如果应用启动失败，请检查端口3000和5001是否空闲
2. 确保所有依赖都已正确安装
3. 检查终端输出中的任何错误信息

## 清理端口进程

如果遇到端口占用问题，可以手动清理相关端口的进程：

```bash
# 清理前端端口
kill -9 $(lsof -t -i:3000) 2>/dev/null || echo "端口3000上没有找到进程"

# 清理后端端口
kill -9 $(lsof -t -i:5001) 2>/dev/null || echo "端口5001上没有找到进程"
```

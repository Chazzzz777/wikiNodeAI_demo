# 知识库 AI 增强工具

本项目是一个基于飞书知识库的 AI 增强工具，旨在通过大语言模型（LLM）提升知识管理和利用的效率。它能够对新文档进行智能分析，提出归档建议，并对知识库中的现有内容进行 AI 评估和优化。

## ✨ 功能特性

- **飞书授权登录**：通过飞书 OAuth 2.0 实现安全的用户身份认证。
- **知识空间浏览**：支持分页浏览用户授权范围内的所有知识空间。
- **知识库节点树**：递归获取并展示知识库的完整层级结构。
- **文档导入 AI 分析**：
    - 支持 `docx`、`doc`、`wiki` 多种飞书文档链接导入。
    - 提取文档内容，结合知识库现有结构，由 LLM 给出专业评估：
        - **内容匹配度分析**：评估导入文档与知识库的相关性。
        - **归属节点建议**：推荐最适合的 1-3 个存放位置。
        - **导入决策**：给出“建议导入”或“暂不建议导入”的最终决策。
- **当前文档 AI 评估**：
    - 对知识库中的现有文档进行 AI 分析。
    - 支持自定义 Prompt 模板，灵活调整评估维度。
- **流式响应**：所有 LLM 的分析和评估结果均以流式（Streaming）方式实时返回，提升用户体验。
- **健壮的日志系统**：
    - **日志轮转**：按大小自动分割日志文件，防止单个文件过大。
    - **自动清理**：限制日志文件总数和备份数量，避免磁盘空间无限增长。
    - **后台监控**：定期检查日志目录大小，并在超过阈值时发出警告。
    - **管理 API**：提供手动触发日志清理和状态查询的接口。
- **前后端分离架构**：采用 React 前端与 Flask 后端，职责清晰，易于维护和扩展。
- **详细的日志记录**：所有关键操作、接口请求和第三方 API 调用均有详细日志，便于问题排查。

## 🏗️ 系统架构

本项目采用经典的前后端分离架构：

- **前端 (Frontend)**：
    - 使用 `React` 构建的用户界面。
    - 负责用户交互、数据展示和 API 请求。
    - 通过 `setupProxy.js` 将 `/api` 请求代理到后端，解决跨域问题。
- **后端 (Backend)**：
    - 使用 `Flask` 搭建的 RESTful API 服务器。
    - 负责业务逻辑处理、与飞书开放平台和 LLM 服务交互。
    - 提供用户认证、知识库数据获取、AI 分析等核心功能。

## 🛠️ 技术栈

- **前端**:
    - [React](https://reactjs.org/)
    - [Ant Design](https://ant.design/)
    - [axios](https://axios-http.com/)
- **后端**:
    - [Flask](https://flask.palletsprojects.com/)
    - [requests](https://requests.readthedocs.io/)
    - [python-dotenv](https://github.com/theskumar/python-dotenv)
    - [OpenAI SDK](https://github.com/openai/openai-python)
- **数据库**: 无，数据实时从飞书 API 获取。
- **LLM**: 支持兼容 OpenAI API 协议的各类大语言模型。

## 🔐 飞书接口权限

为了确保应用所有功能正常运行，您需要在飞书开放平台的应用配置中，为您的应用添加以下权限。应用在请求授权时，会申请以下范围的权限：

| 权限 (Scope)             | 描述               |
| ------------------------ | ------------------ |
| `docx:document:readonly` | 读取云文档内容     |
| `wiki:node:move`         | 移动知识库节点     |
| `wiki:node:retrieve`     | 获取知识库节点信息 |
| `wiki:space:read`        | 读取知识空间列表   |
| `wiki:space:retrieve`    | 获取知识空间信息   |
| `wiki:node:read`         | 读取知识库节点内容 |

请在您的飞书应用配置的“权限管理”页面，确保以上所有权限都已被添加并启用。

## ⚙️ 环境准备

在开始之前，请确保您的开发环境中已安装以下软件：

- [Node.js](https://nodejs.org/) (v14.x 或更高版本)
- [Python](https://www.python.org/) (v3.8 或更高版本)
- [npm](https://www.npmjs.com/) 或 [yarn](https://yarnpkg.com/)

## 🚀 安装与启动

### 1. 克隆项目

```bash
git clone <your-repository-url>
cd wikiNodeAI_demo
```

### 2. 后端配置

#### a. 创建并配置虚拟环境

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows
```

#### b. 安装依赖

```bash
pip install -r requirements.txt
```

#### c. 配置环境变量

在 `backend` 目录下，复制 `.env.example` 文件并重命名为 `.env`：

```bash
cp .env.example .env
```

然后，编辑 `.env` 文件，填入您的配置信息：

```ini
# 飞书应用配置 (请在飞书开放平台创建应用获取)
FEISHU_APP_ID=your_feishu_app_id_here
FEISHU_APP_SECRET=your_feishu_app_secret_here

# 大语言模型 API Key
OPENAI_API_KEY=your_openai_api_key_here

# 服务器配置
BACKEND_PORT=5001
REACT_APP_FRONTEND_PORT=3001

# 日志配置
LOG_LEVEL=INFO
MAX_LOG_SIZE=10
BACKUP_COUNT=5
MAX_LOG_FILES=10

# 管理员配置
ADMIN_TOKEN=your_secure_admin_token # 用于访问管理API，请设置为强密码
```

### 3. 前端配置

#### a. 安装依赖

```bash
cd ../frontend
npm install
```

### 4. 启动应用

本项目提供了一个 `start.sh` 脚本来一键启动前后端服务。

```bash
./start.sh
```

该脚本会：
1. 在后台启动 Flask 后端服务。
2. 启动 React 前端开发服务器。

启动成功后，您可以在浏览器中访问 `http://localhost:3001` 来使用本应用。

## 📖 使用说明

### 1. 登录

- 首次访问应用，会被引导至飞书授权登录页面。
- 使用您的飞书账号登录并授权。
- 授权成功后，应用将获取您的用户信息并展示知识空间列表。

### 2. 浏览知识库

- 在左侧的知识空间列表中，选择您想要操作的知识空间。
- 点击后，右侧将展示该知识库的完整节点树结构。

### 3. 文档导入 AI 分析

- 点击“导入文档 AI 评估”按钮，会弹出一个对话框。
- 输入一个飞书文档链接（支持 `docx`, `doc`, `wiki` 格式）。
- 输入您的 LLM API Key。
- （可选）选择模型、修改 Prompt 模板和占位符。
- 点击“开始分析”，右侧将实时展示 LLM 的分析结果。

### 4. 现有文档 AI 评估

- 在知识库节点树中，选中一个您想要评估的文档节点。
- 点击“当前文档 AI 评估”按钮。
- 输入您的 LLM API Key。
- （可选）修改 Prompt 模板。
- 点击“开始分析”，右侧将实时展示 LLM 的评估结果。

## 📝 API 端点

所有 API 均以 `/api` 为前缀。

- `POST /api/auth/token`: 使用授权码获取 `user_access_token`。
- `GET /api/wiki/spaces`: 获取知识空间列表。
- `GET /api/wiki/<space_id>/nodes/all`: 获取指定知识空间的全量节点树。
- `GET /api/wiki/doc/<obj_token>`: 获取文档的原始内容。
- `POST /api/llm/stream_analysis`: 对指定知识库节点进行流式 AI 分析。
- `POST /api/llm/doc_import_analysis`: 对导入的飞书文档进行流式 AI 分析。
- `GET /api/admin/logs/status`: (需认证) 获取日志系统状态。
- `POST /api/admin/logs/cleanup`: (需认证) 手动触发日志清理。

## 🪵 日志与监控

本项目的日志系统详细说明请参考 `backend/LOG_MANAGEMENT.md`。

- **日志位置**: `backend/logs/`
- **配置文件**: `backend/.env`
- **核心功能**:
    - 通过环境变量 `LOG_LEVEL` 控制日志级别。
    - `RotatingFileHandler` 实现日志轮转与清理。
    - 后台线程自动监控和清理日志。
- **管理**:
    - 使用 `GET /api/admin/logs/status` 查看状态。
    - 使用 `POST /api/admin/logs/cleanup` 手动清理。
    - 访问管理 API 需要在请求头中携带 `Authorization: Bearer <your_admin_token>`。

## 🔍 问题排查

- **401 Unauthorized 错误**:
    - 检查您的飞书 `user_access_token` 是否过期或无效。
    - 检查后端的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确。
    - 对于管理 API，请检查 `ADMIN_TOKEN` 是否正确配置并携带。
- **前端无法连接到后端**:
    - 确认后端服务已在 `http://localhost:5001` (或您配置的端口) 正常运行。
    - 检查浏览器开发者工具的网络请求，看是否有跨域或其他网络错误。
- **LLM 请求失败**:
    - 检查您的 `OPENAI_API_KEY` 是否正确。
    - 检查后端日志 (`backend/logs/app.log`)，查看从 LLM 服务返回的具体错误信息。
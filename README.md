# wikiNodeAI_demo

这是一个基于飞书多维表格和AI技术的智能文档分析系统，旨在帮助团队更高效地管理和分析文档内容。

## 功能特性

- **飞书多维表格集成**：无缝连接飞书多维表格，实现数据的实时同步和管理。
- **AI文档分析**：利用AI技术对文档内容进行深度分析，提取关键信息和洞察。
- **智能问答**：基于文档内容提供智能问答功能，快速解答用户疑问。
- **文档导入**：支持多种格式的文档导入，方便快捷地将现有文档整合到系统中。
- **可视化展示**：通过图表和报告的形式直观展示文档分析结果。

## 技术架构

项目采用前后端分离的架构设计：

- **前端**：使用React框架构建用户界面，提供流畅的交互体验。
- **后端**：基于Python Flask框架开发，提供RESTful API接口。
- **AI服务**：集成OpenAI API，实现文档分析和智能问答功能。
- **数据存储**：利用飞书多维表格作为主要数据存储和管理平台。

## 目录结构

```
wikiNodeAI_demo/
├── backend/          # 后端代码
│   ├── app.py        # Flask应用主文件
│   ├── requirements.txt # Python依赖包列表
│   └── logs/         # 日志文件目录
├── frontend/         # 前端代码
│   ├── public/       # 静态资源
│   ├── src/          # 源代码
│   │   ├── components/ # React组件
│   │   ├── pages/     # 页面组件
│   │   └── utils/     # 工具函数
│   ├── package.json  # npm依赖配置
│   └── package-lock.json # npm依赖锁定文件
└── start.sh          # 项目启动脚本
```

## 环境变量配置

项目使用环境变量来管理配置信息，需要在`backend`和`frontend`目录下分别创建`.env`文件。

### 后端环境变量 (backend/.env)

```env
# OpenAI API密钥
OPENAI_API_KEY=your_openai_api_key_here

# 飞书应用凭证
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret

# Flask配置
FLASK_APP=app.py
FLASK_ENV=development

# 服务器配置
HOST=localhost
PORT=5001

# 日志配置
LOG_LEVEL=INFO
LOG_FILE=logs/backend.log
```

### 前端环境变量 (frontend/.env)

```env
# 飞书应用凭证
REACT_APP_FEISHU_APP_ID=your_feishu_app_id
REACT_APP_FEISHU_APP_SECRET=your_feishu_app_secret

# 后端API配置
REACT_APP_BACKEND_URL=http://localhost:5001

# 日志配置
REACT_APP_ENABLE_BACKEND_LOGGING=false
```

## 快速开始

1. 克隆项目代码：
   ```bash
   git clone https://github.com/Chazzzz777/wikiNodeAI_demo.git
   cd wikiNodeAI_demo
   ```

2. 安装后端依赖：
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. 安装前端依赖：
   ```bash
   cd ../frontend
   npm install
   ```

4. 配置环境变量：
   在`backend`和`frontend`目录下分别创建`.env`文件，并填入相应的配置信息。

5. 启动后端服务：
   ```bash
   cd ../backend
   python app.py
   ```

6. 启动前端服务：
   ```bash
   cd ../frontend
   npm start
   ```

7. 访问应用：
   打开浏览器访问`http://localhost:3000`。

## 开发指南

### 后端开发

后端使用Python Flask框架开发，主要文件为`app.py`。开发时需要注意：

- 所有API接口都应有详细的日志记录，便于调试和问题排查。
- 与飞书多维表格的交互应通过官方SDK进行，确保数据安全和稳定性。
- AI分析功能应考虑性能优化，避免长时间等待。

### 前端开发

前端使用React框架开发，采用函数组件和Hooks。开发时需要注意：

- 组件设计应遵循单一职责原则，提高代码复用性。
- 状态管理应合理使用React的useState和useEffect。
- 与后端的API交互应统一处理错误和加载状态。

## 部署说明

项目可以通过Docker容器化部署，也可以直接部署在服务器上。

### Docker部署

1. 构建Docker镜像：
   ```bash
   docker build -t wikinodeai_demo .
   ```

2. 运行容器：
   ```bash
   docker run -d -p 3000:3000 -p 5001:5001 wikinodeai_demo
   ```

### 服务器部署

1. 确保服务器已安装Python和Node.js环境。
2. 克隆项目代码并安装依赖。
3. 配置环境变量。
4. 使用进程管理工具（如PM2）启动应用。

## 贡献指南

欢迎提交Issue和Pull Request来改进项目。

## 许可证

本项目采用MIT许可证。

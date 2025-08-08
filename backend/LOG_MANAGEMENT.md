# 日志管理系统

## 概述

本系统提供了健壮的日志管理功能，包括日志轮转、自动清理、监控告警和管理API，确保在生产环境中日志不会无限增长占用存储空间。

## 功能特性

### 1. 日志轮转
- 自动轮转日志文件，防止单个日志文件过大
- 基于文件大小触发轮转（默认10MB）
- 保留指定数量的备份文件（默认5个）

### 2. 自动清理
- 启动时自动清理过期的日志文件
- 限制日志文件总数（默认最多10个文件）
- 按修改时间排序，保留最新的日志文件

### 3. 后台监控
- 生产环境自动启动后台监控线程
- 每6小时检查一次日志状态
- 当日志目录超过100MB时发出警告
- 自动执行日志清理任务

### 4. 管理API
提供两个管理接口用于手动管理日志：

#### 获取日志状态
```bash
GET /api/admin/logs/status
Authorization: Bearer <admin_token>
```

响应示例：
```json
{
  "log_directory": "logs",
  "total_files": 3,
  "total_size_mb": 15.2,
  "log_files": [
    {
      "name": "app.log",
      "path": "logs/app.log",
      "size_bytes": 10485760,
      "size_mb": 10.0,
      "modified": 1634567890,
      "created": 1634567890
    }
  ],
  "config": {
    "log_level": "INFO",
    "max_log_size_mb": 10,
    "backup_count": 5,
    "max_log_files": 10
  }
}
```

#### 手动清理日志
```bash
POST /api/admin/logs/cleanup
Authorization: Bearer <admin_token>
```

响应示例：
```json
{
  "message": "Log cleanup completed",
  "deleted_files": ["logs/app.log.3"],
  "files_deleted_count": 1,
  "size_before_mb": 25.5,
  "size_after_mb": 15.2,
  "space_freed_mb": 10.3
}
```

## 环境变量配置

在 `.env` 文件中配置以下参数：

```bash
# 日志级别：DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_LEVEL=INFO

# 单个日志文件最大大小（MB）
MAX_LOG_SIZE=10

# 保留的备份文件数量
BACKUP_COUNT=5

# 最多保留的日志文件总数
MAX_LOG_FILES=10

# 管理员API访问令牌
ADMIN_TOKEN=your_secure_admin_token
```

## 部署建议

### 1. 生产环境配置
```bash
# 生产环境推荐配置
LOG_LEVEL=WARNING          # 减少日志量，只记录重要信息
MAX_LOG_SIZE=20            # 适当增大单个文件大小
BACKUP_COUNT=3             # 减少备份文件数量
MAX_LOG_FILES=5            # 严格控制总文件数
ADMIN_TOKEN=very_secure_token  # 使用强密码
```

### 2. 开发环境配置
```bash
# 开发环境推荐配置
LOG_LEVEL=DEBUG            # 记录详细调试信息
MAX_LOG_SIZE=5             # 小文件便于查看
BACKUP_COUNT=10            # 保留更多备份
MAX_LOG_FILES=20           # 允许更多文件
ADMIN_TOKEN=dev_token      # 简单的开发token
```

### 3. 高负载环境配置
```bash
# 高负载环境推荐配置
LOG_LEVEL=ERROR            # 只记录错误
MAX_LOG_SIZE=50            # 大文件减少轮转频率
BACKUP_COUNT=2             # 最少备份
MAX_LOG_FILES=3            # 最严格控制
ADMIN_TOKEN=secure_token    # 强密码
```

## 监控和告警

### 1. 内置监控
- 后台线程每6小时检查日志状态
- 自动记录日志目录大小和文件数量
- 超过100MB时发出警告日志

### 2. 建议的外部监控
```bash
# 使用cron任务定期检查日志大小
0 */6 * * * /path/to/your/app/check_logs.sh

# 检查脚本示例
#!/bin/bash
LOG_DIR="/path/to/logs"
MAX_SIZE_MB=100

CURRENT_SIZE=$(du -m "$LOG_DIR" | cut -f1)
if [ "$CURRENT_SIZE" -gt "$MAX_SIZE_MB" ]; then
    echo "Warning: Log directory size ${CURRENT_SIZE}MB exceeds limit ${MAX_SIZE_MB}MB"
    # 发送告警邮件或通知
fi
```

## 故障排除

### 1. 日志文件不轮转
- 检查 `MAX_LOG_SIZE` 配置是否正确
- 确认应用有写入日志目录的权限
- 查看启动日志是否有错误信息

### 2. 管理API返回401
- 检查 `ADMIN_TOKEN` 环境变量是否设置
- 确认Authorization头格式正确：`Bearer <token>`
- 验证token值是否匹配

### 3. 后台监控未启动
- 确认 `FLASK_ENV` 不是 `development`
- 检查应用启动日志是否有 "Started log monitor thread"
- 查看是否有线程相关的错误信息

### 4. 日志清理失败
- 检查日志目录权限
- 确认没有其他进程占用日志文件
- 查看错误日志了解具体失败原因

## 最佳实践

### 1. 日志级别使用
- **DEBUG**: 开发调试，记录详细信息
- **INFO**: 正常运行信息，记录关键操作
- **WARNING**: 警告信息，可能的问题
- **ERROR**: 错误信息，需要关注
- **CRITICAL**: 严重错误，立即处理

### 2. 存储规划
- 根据应用负载预估日志增长速度
- 定期检查磁盘空间使用情况
- 设置合理的日志保留策略

### 3. 安全考虑
- 定期更换管理员token
- 限制管理API的访问来源
- 敏感信息不要记录到日志中

### 4. 性能优化
- 高负载环境使用更高的日志级别
- 合理设置轮转大小，避免频繁轮转
- 使用异步日志记录（如需要）

## 版本历史

- **v1.0**: 基础日志轮转功能
- **v1.1**: 添加自动清理和后台监控
- **v1.2**: 添加管理API和状态查询
- **v1.3**: 增强错误处理和配置灵活性
import os
import requests
import json
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

load_dotenv() # Load environment variables from .env file

# --- Environment Variables ---
FRONTEND_PORT = os.getenv('REACT_APP_FRONTEND_PORT', 3001)
BACKEND_PORT = os.getenv('BACKEND_PORT', 5001)
FEISHU_APP_ID = os.getenv('FEISHU_APP_ID')
FEISHU_APP_SECRET = os.getenv('FEISHU_APP_SECRET')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": f"http://localhost:{FRONTEND_PORT}", "supports_credentials": True}})

# --- Logging Configuration ---
import os
from logging.handlers import RotatingFileHandler
import glob

# 确保日志目录存在
log_dir = 'logs'
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# 日志配置函数
def setup_logging():
    # 从环境变量获取日志级别，默认为INFO
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_levels = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    
    # 日志轮转配置
    max_log_size = int(os.getenv('MAX_LOG_SIZE', '10')) * 1024 * 1024  # 默认10MB
    backup_count = int(os.getenv('BACKUP_COUNT', '5'))  # 默认保留5个备份
    max_log_files = int(os.getenv('MAX_LOG_FILES', '10'))  # 默认最多保留10个日志文件
    
    # 日志格式
    log_format = '%(asctime)s %(levelname)s %(name)s [%(filename)s:%(lineno)d] %(message)s'
    formatter = logging.Formatter(log_format)
    
    # 清理过期的日志文件
    def cleanup_old_logs():
        try:
            log_files = glob.glob(os.path.join(log_dir, 'app.log.*'))
            log_files.extend(glob.glob(os.path.join(log_dir, 'app.log')))
            
            # 按修改时间排序
            log_files.sort(key=os.path.getmtime, reverse=True)
            
            # 删除超过最大数量的日志文件
            for log_file in log_files[max_log_files:]:
                try:
                    os.remove(log_file)
                    print(f"Deleted old log file: {log_file}")
                except Exception as e:
                    print(f"Failed to delete log file {log_file}: {e}")
        except Exception as e:
            print(f"Failed to cleanup old logs: {e}")
    
    # 执行清理
    cleanup_old_logs()
    
    # 配置根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(log_levels.get(log_level, logging.INFO))
    
    # 清除现有的处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_levels.get(log_level, logging.INFO))
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # 文件处理器（带轮转）
    file_handler = RotatingFileHandler(
        filename=os.path.join(log_dir, 'app.log'),
        maxBytes=max_log_size,
        backupCount=backup_count,
        encoding='utf-8'
    )
    file_handler.setLevel(log_levels.get(log_level, logging.INFO))
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # 配置应用日志记录器
    app.logger.setLevel(log_levels.get(log_level, logging.INFO))
    
    # 记录日志配置信息
    app.logger.info(f"Logging configured - Level: {log_level}, Max size: {max_log_size//1024//1024}MB, Backups: {backup_count}, Max files: {max_log_files}")

# 初始化日志配置
setup_logging()

# --- 日志监控和清理任务 ---
import threading
import time

def log_monitor_task():
    """后台日志监控任务，定期检查日志状态并清理过期文件"""
    while True:
        try:
            # 每6小时执行一次清理
            time.sleep(6 * 60 * 60)
            app.logger.info("Running scheduled log cleanup task")
            
            # 重新执行日志清理
            setup_logging()
            
            # 检查日志目录大小
            log_dir_size = 0
            log_file_count = 0
            for root, dirs, files in os.walk(log_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        log_dir_size += os.path.getsize(file_path)
                        log_file_count += 1
                    except Exception as e:
                        app.logger.warning(f"Failed to get size of {file_path}: {e}")
            
            # 如果日志目录超过100MB，记录警告
            if log_dir_size > 100 * 1024 * 1024:
                app.logger.warning(f"Log directory size is {log_dir_size//1024//1024}MB with {log_file_count} files, consider adjusting log retention settings")
            else:
                app.logger.info(f"Log directory status: {log_dir_size//1024//1024}MB, {log_file_count} files")
                
        except Exception as e:
            app.logger.error(f"Error in log monitor task: {e}")
            # 出错后等待1小时再重试
            time.sleep(60 * 60)

# 启动日志监控线程（仅在生产环境）
if os.getenv('FLASK_ENV') != 'development':
    monitor_thread = threading.Thread(target=log_monitor_task, daemon=True)
    monitor_thread.start()
    app.logger.info("Started log monitor thread")

@app.route('/api/admin/logs/cleanup', methods=['POST'])
def manual_log_cleanup():
    """手动触发日志清理的管理接口"""
    try:
        # 简单的认证检查（生产环境中应该使用更严格的认证）
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        
        # 这里可以添加更复杂的权限检查
        # 现在只是简单的token验证
        token = auth_header.split(' ')[1]
        if token != os.getenv('ADMIN_TOKEN', 'admin-secret'):
            return jsonify({"error": "Invalid admin token"}), 401
        
        app.logger.info("Manual log cleanup triggered")
        
        # 执行日志清理
        before_cleanup = {}
        after_cleanup = {}
        
        # 清理前状态
        for root, dirs, files in os.walk(log_dir):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    size = os.path.getsize(file_path)
                    before_cleanup[file_path] = size
                except Exception as e:
                    app.logger.warning(f"Failed to get size of {file_path}: {e}")
        
        # 重新设置日志配置（会触发清理）
        setup_logging()
        
        # 清理后状态
        for root, dirs, files in os.walk(log_dir):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    size = os.path.getsize(file_path)
                    after_cleanup[file_path] = size
                except Exception as e:
                    app.logger.warning(f"Failed to get size of {file_path}: {e}")
        
        # 计算清理结果
        deleted_files = set(before_cleanup.keys()) - set(after_cleanup.keys())
        size_before = sum(before_cleanup.values())
        size_after = sum(after_cleanup.values())
        
        result = {
            "message": "Log cleanup completed",
            "deleted_files": list(deleted_files),
            "files_deleted_count": len(deleted_files),
            "size_before_mb": round(size_before / 1024 / 1024, 2),
            "size_after_mb": round(size_after / 1024 / 1024, 2),
            "space_freed_mb": round((size_before - size_after) / 1024 / 1024, 2)
        }
        
        app.logger.info(f"Manual cleanup result: {result}")
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error in manual log cleanup: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/logs/status', methods=['GET'])
def get_log_status():
    """获取日志状态信息"""
    try:
        # 简单的认证检查
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        
        token = auth_header.split(' ')[1]
        if token != os.getenv('ADMIN_TOKEN', 'admin-secret'):
            return jsonify({"error": "Invalid admin token"}), 401
        
        # 收集日志状态信息
        log_files = []
        total_size = 0
        
        for root, dirs, files in os.walk(log_dir):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    stat = os.stat(file_path)
                    file_info = {
                        "name": file,
                        "path": file_path,
                        "size_bytes": stat.st_size,
                        "size_mb": round(stat.st_size / 1024 / 1024, 2),
                        "modified": stat.st_mtime,
                        "created": stat.st_ctime
                    }
                    log_files.append(file_info)
                    total_size += stat.st_size
                except Exception as e:
                    app.logger.warning(f"Failed to get info for {file_path}: {e}")
        
        # 按修改时间排序
        log_files.sort(key=lambda x: x['modified'], reverse=True)
        
        status = {
            "log_directory": log_dir,
            "total_files": len(log_files),
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "log_files": log_files[:20],  # 只返回最新的20个文件信息
            "config": {
                "log_level": os.getenv('LOG_LEVEL', 'INFO'),
                "max_log_size_mb": int(os.getenv('MAX_LOG_SIZE', '10')),
                "backup_count": int(os.getenv('BACKUP_COUNT', '5')),
                "max_log_files": int(os.getenv('MAX_LOG_FILES', '10'))
            }
        }
        
        return jsonify(status)
        
    except Exception as e:
        app.logger.error(f"Error getting log status: {e}")
        return jsonify({"error": str(e)}), 500

# --- Global Request Logger ---

@app.before_request
def log_request_info():
    app.logger.info('--- Incoming Request ---')
    app.logger.info(f'Method: {request.method}')
    app.logger.info(f'Path: {request.path}')
    app.logger.info(f'Headers: {request.headers}')

# --- Helper Functions ---

def get_user_access_token(code, redirect_uri):
    url = "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": FEISHU_APP_ID,
        "client_secret": FEISHU_APP_SECRET,
        "redirect_uri": redirect_uri
    }
    headers = {
        "Content-Type": "application/json"
    }

    app.logger.info("="*20 + " Feishu user_access_token Request " + "="*20)
    app.logger.info(f"POST {url}")
    app.logger.info("HEADERS: " + json.dumps(headers, indent=2))
    app.logger.info("BODY: " + json.dumps(payload, indent=2))
    app.logger.info("="*60)

    response = requests.post(url, json=payload, headers=headers)

    app.logger.info("--- Received response from Feishu ---")
    app.logger.info(f"Status Code: {response.status_code}")
    app.logger.info(f"Response Content: {response.text}")
        
    response.raise_for_status()
    data = response.json()
    if data.get("code", -1) != 0:
        app.logger.error(f"Failed to get user_access_token from feishu, response: {data}")
        return None
    return data.get("access_token")


# --- API Routes ---

@app.route('/api/auth/callback')
def auth_callback():
    code = request.args.get('code')
    # 重定向回前端，并带上 code
    return f'<script>window.location.href = "http://localhost:{FRONTEND_PORT}/?code={code}";</script>'

@app.route('/api/auth/token', methods=['POST'])
def get_token():
    app.logger.info("--- Received /api/auth/token request ---")
    data = request.get_json()
    app.logger.info(f"Request data: {data}")
    code = data.get('code')
    redirect_uri = data.get('redirect_uri')
    app.logger.info(f"Extracted code: {code}")
    app.logger.info(f"Extracted redirect_uri: {redirect_uri}")

    if not code or not redirect_uri:
        app.logger.error("Error: Code and redirect_uri are required")
        response = jsonify({"error": "Code and redirect_uri are required"})
        response.status_code = 400
    else:
        try:
            user_access_token = get_user_access_token(code, redirect_uri)
            if not user_access_token:
                app.logger.error("Failed to get user_access_token")
                response = jsonify({"error": "Failed to get user_access_token"})
                response.status_code = 500
            else:
                response = jsonify({"user_access_token": user_access_token})
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Request error: {str(e)}")
            if e.response:
                app.logger.error(f"Response status: {e.response.status_code}")
                app.logger.error(f"Response content: {e.response.text}")
            try:
                error_data = e.response.json()
                response = jsonify({"error": error_data})
                response.status_code = e.response.status_code
            except (ValueError, AttributeError):
                response = jsonify({"error": str(e)})
                response.status_code = 500
    
    return response

@app.route('/api/wiki/spaces', methods=['GET'])
def get_wiki_spaces():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    user_access_token = auth_header.split(' ')[1]

    page_token = request.args.get('page_token')
    # 限制 page_size 最大为 50，符合飞书 API 限制
    page_size = min(int(request.args.get('page_size', 20)), 50)

    url = "https://open.feishu.cn/open-apis/wiki/v2/spaces"
    headers = {"Authorization": f"Bearer {user_access_token}"}
    params = {
        "page_size": page_size
    }
    if page_token:
        params['page_token'] = page_token

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return jsonify(response.json().get("data", {}))
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Request error: {str(e)}")
        if e.response is not None:
            app.logger.error(f"Response status: {e.response.status_code}")
            app.logger.error(f"Response content: {e.response.text}")
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500


# --- Node Fetching Logic ---

# 速率限制器
class RateLimiter:
    def __init__(self, max_calls, per_seconds):
        self.max_calls = max_calls
        self.per_seconds = per_seconds
        self.calls = []
        # 添加安全系数，实际限制比理论值更严格
        self.safety_factor = 0.8  # 只使用80%的理论限制
        self.effective_max_calls = int(max_calls * self.safety_factor)

    def __call__(self, f):
        def wrapped(*args, **kwargs):
            now = time.time()
            # 移除指定时间前的调用记录
            self.calls = [c for c in self.calls if c > now - self.per_seconds]
            
            # 使用更严格的有效限制
            if len(self.calls) >= self.effective_max_calls:
                # 计算需要等待的时间
                sleep_time = (self.calls[0] + self.per_seconds) - now
                if sleep_time > 0:
                    # 添加额外缓冲时间
                    buffer_time = 0.5
                    total_sleep = sleep_time + buffer_time
                    app.logger.warning(f"Rate limit reached (effective: {self.effective_max_calls}/{self.max_calls}). Sleeping for {total_sleep:.2f} seconds.")
                    time.sleep(total_sleep)
            
            # 记录请求时间
            self.calls.append(time.time())
            
            # 添加小延迟确保请求间隔
            if len(self.calls) > 1:
                time_since_last = now - self.calls[-2]
                min_interval = self.per_seconds / self.effective_max_calls
                if time_since_last < min_interval:
                    additional_delay = min_interval - time_since_last
                    app.logger.debug(f"Adding delay {additional_delay:.3f}s to maintain rate limit")
                    time.sleep(additional_delay)
            
            return f(*args, **kwargs)
        return wrapped

# 带有指数退避的请求函数
def request_with_backoff(url, headers, params=None, max_retries=5):
    retry_count = 0
    backoff_factor = 1  # 初始退避时间（秒）
    
    while retry_count <= max_retries:
        try:
            response = requests.get(url, headers=headers, params=params)
            
            # 检查是否是飞书API频率限制错误（错误码99991400）
            try:
                response_data = response.json()
                if response_data.get('code') == 99991400:
                    if retry_count < max_retries:
                        # 飞书频率限制，使用更长的退避时间
                        backoff_time = backoff_factor * (3 ** retry_count) + random.uniform(1, 3)  # 更长的退避
                        app.logger.warning(f"Feishu rate limit hit (code 99991400). Retrying in {backoff_time:.2f} seconds. Retry count: {retry_count + 1}")
                        time.sleep(backoff_time)
                        retry_count += 1
                        continue
                    else:
                        # 达到最大重试次数
                        app.logger.error("Max retries reached for Feishu rate limit. Raising exception.")
                        response.raise_for_status()
            except ValueError:
                # 响应不是JSON格式，继续正常处理
                pass
            
            # 处理HTTP 429速率限制错误
            if response.status_code == 429:  # 速率限制错误
                if retry_count < max_retries:
                    # 计算退避时间
                    backoff_time = backoff_factor * (2 ** retry_count) + random.uniform(0, 1)
                    app.logger.warning(f"HTTP rate limit hit. Retrying in {backoff_time:.2f} seconds. Retry count: {retry_count + 1}")
                    time.sleep(backoff_time)
                    retry_count += 1
                    continue
                else:
                    # 达到最大重试次数
                    app.logger.error("Max retries reached for HTTP rate limit. Raising exception.")
                    response.raise_for_status()
            else:
                response.raise_for_status()
                return response
        except requests.exceptions.RequestException as e:
            if retry_count < max_retries:
                backoff_time = backoff_factor * (2 ** retry_count) + random.uniform(0, 1)
                app.logger.warning(f"Request failed. Retrying in {backoff_time:.2f} seconds. Error: {str(e)}")
                time.sleep(backoff_time)
                retry_count += 1
            else:
                app.logger.error(f"Max retries reached. Raising exception. Error: {str(e)}")
                raise
    
    # 如果循环结束仍未成功，抛出异常
    raise requests.exceptions.RequestException("Max retries reached without successful response")

# 限制请求频率为 100 次/分钟，防止超频报错
rate_limiter = RateLimiter(max_calls=100, per_seconds=60)

def fetch_node_children(space_id, node_token, user_access_token, page_token=None):
    url = f"https://open.feishu.cn/open-apis/wiki/v2/spaces/{space_id}/nodes"
    headers = {"Authorization": f"Bearer {user_access_token}"}
    params = {"page_size": 50}
    if node_token:
        params['parent_node_token'] = node_token
    if page_token:
        params['page_token'] = page_token

    @rate_limiter
    def fetch_with_rate_limit():
        # 使用带有指数退避的请求函数，更好地处理频率限制
        return request_with_backoff(url, headers, params)

    response = fetch_with_rate_limit()
    return response.json().get("data", {})



def fetch_all_nodes_recursively(space_id, user_access_token, parent_node_token=None, page_token=None, progress_callback=None):
    nodes = []
    total_count = 0  # 用于累计节点总数
    while True:
        url = f"https://open.feishu.cn/open-apis/wiki/v2/spaces/{space_id}/nodes?page_size=50"
        headers = {
            "Authorization": f"Bearer {user_access_token}"
        }
        params = {}
        if parent_node_token:
            params['parent_node_token'] = parent_node_token
        if page_token:
            params['page_token'] = page_token

        try:
            # 使用带有指数退避的请求函数
            response = request_with_backoff(url, headers, params)
            data = response.json().get("data", {})
            items = data.get("items", [])
            # 过滤掉缺少node_token的节点
            valid_items = [item for item in items if item.get('node_token')]
            nodes.extend(valid_items)
            
            # 更新总节点数并调用进度回调
            total_count += len(items)
            if progress_callback:
                try:
                    # 调用进度回调函数
                    progress_callback(total_count)
                except Exception as e:
                    # 记录错误但不中断主流程
                    app.logger.error(f"Progress callback error: {str(e)}")

            # 限制并发数为2，避免触发飞书API频率限制
            with ThreadPoolExecutor(max_workers=2) as executor:
                # 为每个子节点请求添加小延迟，避免同时发送大量请求
                futures = []
                for item in items:
                    if item.get('has_child'):
                        # 添加小延迟避免频率限制
                        time.sleep(0.1)
                        future = executor.submit(fetch_all_nodes_recursively, space_id, user_access_token, item['node_token'], None, progress_callback)
                        futures.append((future, item))
                
                for future, item in futures:
                    try:
                        children = future.result()
                        # Find the node in the list and add its children
                        for n in nodes:
                            if n['node_token'] == item['node_token']:
                                n['children'] = children
                                break
                    except Exception as exc:
                        app.logger.error(f'{item["node_token"]} generated an exception: {exc}')
                        # 继续处理其他节点，不中断整个过程
                        continue

            if not data.get('has_more'):
                break
            page_token = data.get('page_token')
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Failed to fetch nodes: {str(e)}")
            # 如果是速率限制错误，重新抛出异常以便上层处理
            if e.response is not None and e.response.status_code == 429:
                raise
            # 对于其他错误，可以选择继续或者抛出异常
            # 这里我们选择继续，以确保尽可能多地获取数据
            break
    return nodes

@app.route('/api/wiki/<space_id>/nodes/all', methods=['GET'])
def get_all_wiki_nodes(space_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    user_access_token = auth_header.split(' ')[1]

    try:
        all_nodes = fetch_all_nodes_recursively(space_id, user_access_token)
        return jsonify(all_nodes)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Request error: {str(e)}")
        if e.response is not None:
            app.logger.error(f"Response status: {e.response.status_code}")
            app.logger.error(f"Response content: {e.response.text}")
            # 特别处理速率限制错误
            if e.response.status_code == 429:
                return jsonify({"error": "Rate limit exceeded. Please try again later.", "retry_after": 60}), 429
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

# 兼容旧版本的API端点，用于导出全量导航数据
@app.route('/api/wiki/nodes/export', methods=['GET'])
def export_wiki_nodes():
    # 从查询参数获取space_id
    space_id = request.args.get('space_id')
    if not space_id:
        return jsonify({"error": "Missing space_id parameter"}), 400
    
    # 从查询参数或Authorization头获取token
    user_access_token = request.args.get('token')
    if not user_access_token:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        user_access_token = auth_header.split(' ')[1]

    app.logger.info(f"SSE export connection attempt started for space_id: {space_id}")
    
    # 创建一个队列来传递进度更新
    import queue
    progress_queue = queue.Queue()
    result = []

    def generate():
        try:
            app.logger.info(f"SSE export stream generation started for space_id: {space_id}")
            
            # 定义进度回调函数
            def progress_callback(count):
                progress_queue.put(count)
            
            # 在另一个线程中获取所有节点
            import threading
            def fetch_nodes():
                try:
                    nonlocal result
                    app.logger.info(f"Starting to fetch all nodes for export, space_id: {space_id}")
                    all_nodes = fetch_all_nodes_recursively(space_id, user_access_token, progress_callback=progress_callback)
                    result.extend(all_nodes)
                    app.logger.info(f"Finished fetching all nodes for export, space_id: {space_id}, node count: {len(result)}")
                    # 发送完成信号
                    progress_queue.put(None)
                except Exception as e:
                    app.logger.error(f"Error while fetching nodes for export, space_id: {space_id}, error: {str(e)}")
                    # 发送错误信号
                    progress_queue.put(e)
            
            fetch_thread = threading.Thread(target=fetch_nodes)
            fetch_thread.start()
            
            # 实时发送进度更新
            while True:
                try:
                    # 从队列中获取进度更新
                    item = progress_queue.get(timeout=1)
                    
                    # 检查是否完成
                    if item is None:
                        break
                    
                    # 检查是否出错
                    if isinstance(item, Exception):
                        raise item
                    
                    # 发送进度更新
                    yield f"data: {{\"type\": \"progress\", \"count\": {item}}}\n\n"
                except queue.Empty:
                    # 检查线程是否还在运行
                    if not fetch_thread.is_alive():
                        break
                    continue
            
            # 等待线程完成
            fetch_thread.join()
            
            # 发送最终结果
            app.logger.info(f"Sending final export result for space_id: {space_id}, node count: {len(result)}")
            yield f"data: {{\"type\": \"result\", \"data\": {json.dumps(result)}}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE export stream ended normally for space_id: {space_id}")
            yield "data: \n\n"
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Request error in export: {str(e)}")
            if e.response is not None:
                app.logger.error(f"Response status: {e.response.status_code}")
                app.logger.error(f"Response content: {e.response.text}")
                # 特别处理速率限制错误
                if e.response.status_code == 429:
                    app.logger.info(f"Rate limit exceeded for export, space_id: {space_id}")
                    yield f"data: {{\"type\": \"error\", \"message\": \"Rate limit exceeded. Please try again later.\", \"retry_after\": 60}}\n\n"
                    return
            app.logger.info(f"Sending request error for export, space_id: {space_id}")
            yield f"data: {{\"type\": \"error\", \"message\": \"{str(e)}\"}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE export stream ended with request error for space_id: {space_id}")
            yield "data: \n\n"
        except Exception as e:
            app.logger.error(f"Unexpected error in export: {str(e)}")
            app.logger.info(f"Sending unexpected error for export, space_id: {space_id}")
            yield f"data: {{\"type\": \"error\", \"message\": \"{str(e)}\"}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE export stream ended with unexpected error for space_id: {space_id}")
            yield "data: \n\n"
    
    app.logger.info(f"SSE export connection established for space_id: {space_id}")
    return Response(generate(), content_type='text/event-stream')

@app.route('/api/wiki/<space_id>/nodes/all/stream', methods=['GET'])
def get_all_wiki_nodes_stream(space_id):
    # 从查询参数或Authorization头获取token
    user_access_token = request.args.get('token')
    if not user_access_token:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Unauthorized"}), 401
        user_access_token = auth_header.split(' ')[1]

    app.logger.info(f"SSE connection attempt started for space_id: {space_id}")
    
    # 创建一个队列来传递进度更新
    import queue
    progress_queue = queue.Queue()
    result = []

    def generate():
        try:
            app.logger.info(f"SSE stream generation started for space_id: {space_id}")
            
            # 定义进度回调函数
            def progress_callback(count):
                progress_queue.put(count)
            
            # 在另一个线程中获取所有节点
            import threading
            def fetch_nodes():
                try:
                    nonlocal result
                    app.logger.info(f"Starting to fetch all nodes for space_id: {space_id}")
                    all_nodes = fetch_all_nodes_recursively(space_id, user_access_token, progress_callback=progress_callback)
                    result.extend(all_nodes)
                    app.logger.info(f"Finished fetching all nodes for space_id: {space_id}, node count: {len(result)}")
                    # 发送完成信号
                    progress_queue.put(None)
                except Exception as e:
                    app.logger.error(f"Error while fetching nodes for space_id: {space_id}, error: {str(e)}")
                    # 发送错误信号
                    progress_queue.put(e)
            
            fetch_thread = threading.Thread(target=fetch_nodes)
            fetch_thread.start()
            
            # 实时发送进度更新
            while True:
                try:
                    # 从队列中获取进度更新
                    item = progress_queue.get(timeout=1)
                    
                    # 检查是否完成
                    if item is None:
                        break
                    
                    # 检查是否出错
                    if isinstance(item, Exception):
                        raise item
                    
                    # 发送进度更新
                    yield f"data: {{\"type\": \"progress\", \"count\": {item}}}\n\n"
                except queue.Empty:
                    # 检查线程是否还在运行
                    if not fetch_thread.is_alive():
                        break
                    continue
            
            # 等待线程完成
            fetch_thread.join()
            
            # 发送最终结果
            app.logger.info(f"Sending final result for space_id: {space_id}, node count: {len(result)}")
            yield f"data: {{\"type\": \"result\", \"data\": {json.dumps(result)}}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE stream ended normally for space_id: {space_id}")
            yield "data: \n\n"
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Request error: {str(e)}")
            if e.response is not None:
                app.logger.error(f"Response status: {e.response.status_code}")
                app.logger.error(f"Response content: {e.response.text}")
                # 特别处理速率限制错误
                if e.response.status_code == 429:
                    app.logger.info(f"Rate limit exceeded for space_id: {space_id}")
                    yield f"data: {{\"type\": \"error\", \"message\": \"Rate limit exceeded. Please try again later.\", \"retry_after\": 60}}\n\n"
                    return
            app.logger.info(f"Sending request error for space_id: {space_id}")
            yield f"data: {{\"type\": \"error\", \"message\": \"{str(e)}\"}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE stream ended with request error for space_id: {space_id}")
            yield "data: \n\n"
        except Exception as e:
            app.logger.error(f"Unexpected error: {str(e)}")
            app.logger.info(f"Sending unexpected error for space_id: {space_id}")
            yield f"data: {{\"type\": \"error\", \"message\": \"{str(e)}\"}}\n\n"
            
            # 显式结束流
            app.logger.info(f"SSE stream ended with unexpected error for space_id: {space_id}")
            yield "data: \n\n"
    
    app.logger.info(f"SSE connection established for space_id: {space_id}")
    return Response(generate(), content_type='text/event-stream')

@app.route('/api/wiki/<space_id>/nodes', methods=['GET'])
def get_wiki_nodes(space_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    user_access_token = auth_header.split(' ')[1]

    # Get parameters
    parent_node_token = request.args.get('parent_node_token')
    page_token = request.args.get('page_token')
    
    # Validate parameters
    if parent_node_token is not None and not isinstance(parent_node_token, str):
        return jsonify({"error": "Invalid parent_node_token"}), 400
    if page_token is not None and not isinstance(page_token, str):
        return jsonify({"error": "Invalid page_token"}), 400

    try:
        # Fetch nodes with pagination
        data = fetch_node_children(space_id, parent_node_token, user_access_token, page_token)
        return jsonify(data)

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Request error: {str(e)}")
        if e.response is not None:
            app.logger.error(f"Response status: {e.response.status_code}")
            app.logger.error(f"Response content: {e.response.text}")
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/wiki/doc/<obj_token>', methods=['GET'])
def get_wiki_document(obj_token):
    # 记录请求信息，便于调试
    app.logger.info(f"=== Incoming /api/wiki/doc/{obj_token} Request ===")
    app.logger.info(f"Request headers: {dict(request.headers)}")
    
    # 支持多种认证方式，增强健壮性
    user_access_token = None
    auth_header = request.headers.get('Authorization')
    user_access_token_header = request.headers.get('user-access-token')
    
    # 优先使用 Authorization 头（标准Bearer Token）
    if auth_header and auth_header.startswith('Bearer '):
        user_access_token = auth_header.split(' ')[1]
        app.logger.info("Using Authorization header for authentication")
    # 兼容 user-access-token 头
    elif user_access_token_header:
        user_access_token = user_access_token_header
        app.logger.info("Using user-access-token header for authentication")
    
    # 如果没有找到任何认证信息
    if not user_access_token:
        app.logger.error("No valid authentication token found in request headers")
        app.logger.error(f"Available headers: {list(request.headers.keys())}")
        return jsonify({"error": "Authentication required. Please provide valid token in Authorization or user-access-token header"}), 401
    
    # 记录token信息（脱敏处理）
    token_preview = user_access_token[:10] + "..." if len(user_access_token) > 10 else user_access_token
    app.logger.info(f"Authentication successful, token preview: {token_preview}")
    
    url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{obj_token}/raw_content"
    headers = {
        "Authorization": f"Bearer {user_access_token}"
    }
    
    app.logger.info(f"Fetching document content from Feishu with URL: {url}")
    app.logger.info(f"Document obj_token: {obj_token}")

    try:
        response = requests.get(url, headers=headers)
        app.logger.info(f"Feishu API response status: {response.status_code}")
        app.logger.info(f"Feishu API response headers: {dict(response.headers)}")
        
        response.raise_for_status()
        data = response.json()
        app.logger.info(f"Feishu API response data: {data}")
        
        if data.get("code") == 0:
            document_data = data.get("data", {})
            content_length = len(document_data.get('content', ''))
            app.logger.info(f"Successfully fetched document content, length: {content_length}")
            return jsonify(document_data)
        else:
            error_msg = data.get("msg", "Failed to fetch document")
            app.logger.error(f"Feishu API returned error: {error_msg}")
            app.logger.error(f"Feishu API error code: {data.get('code')}")
            return jsonify({"error": error_msg}), 500
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to fetch document content: {e}"
        app.logger.error(error_msg)
        if e.response is not None:
            app.logger.error(f"Response status: {e.response.status_code}")
            app.logger.error(f"Response headers: {dict(e.response.headers)}")
            app.logger.error(f"Response content: {e.response.text}")
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    data = request.json
    api_key = data.get('api_key')
    model = data.get('model', 'doubao-seed-1-6-250615')  # 默认模型参数
    messages = data.get('messages')

    if not all([api_key, messages]):
        return jsonify({"error": "Missing required parameters"}), 400

    def generate():
        try:
            # 使用OpenAI SDK进行流式调用
            client = OpenAI(
                base_url="https://ark.cn-beijing.volces.com/api/v3",
                api_key=api_key
            )
            
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
            )
            
            for chunk in stream:
                if not chunk.choices:
                    continue
                
                # 处理 reasoning_content
                reasoning_content = ""
                if hasattr(chunk.choices[0].delta, 'reasoning_content'):
                    reasoning_content = chunk.choices[0].delta.reasoning_content or ""
                if reasoning_content:
                    # 按照SSE格式返回推理内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"reasoning\", \"content\": {json.dumps(reasoning_content)}}}\n\n"
                
                # 处理 content
                content = ""
                if hasattr(chunk.choices[0].delta, 'content'):
                    content = chunk.choices[0].delta.content or ""
                if content:
                    # 按照SSE格式返回内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"content\", \"content\": {json.dumps(content)}}}\n\n"
            
            # 发送结束信号
            yield "data: [DONE]\n\n"
        except Exception as e:
            app.logger.error(f"LLM request error: {e}")
            # 使用 json.dumps 确保错误信息被正确转义
            import json
            yield f"data: {{\"error\": {json.dumps(str(e))}}}\n\n"

    return Response(generate(), content_type='text/event-stream')


def replace_placeholders(prompt_template, placeholders):
    """
    统一的占位符替换函数
    :param prompt_template: 提示词模板
    :param placeholders: 占位符字典
    :return: 替换后的提示词
    """
    app.logger.info(f"Starting placeholder replacement with template length: {len(prompt_template) if prompt_template else 0}")
    app.logger.debug(f"Placeholders to replace: {placeholders}")
    
    if not prompt_template:
        app.logger.warning("Empty prompt_template provided to replace_placeholders")
        return prompt_template
    
    if not isinstance(placeholders, dict):
        app.logger.error(f"Invalid placeholders type: {type(placeholders)}, expected dict")
        return prompt_template
    
    result = prompt_template
    replaced_count = 0
    
    for placeholder, value in placeholders.items():
        if not isinstance(placeholder, str):
            app.logger.warning(f"Invalid placeholder type: {type(placeholder)}, skipping")
            continue
            
        placeholder_pattern = f'{{{placeholder}}}'
        if placeholder_pattern in result:
            # 确保占位符被正确替换，即使值为None也替换为空字符串
            replacement_value = str(value) if value is not None else ''
            result = result.replace(placeholder_pattern, replacement_value)
            replaced_count += 1
            app.logger.debug(f"Replaced placeholder '{placeholder}' with value (length: {len(replacement_value)})")
        else:
            app.logger.debug(f"Placeholder '{placeholder}' not found in template")
    
    # 检查是否还有未替换的占位符
    import re
    remaining_placeholders = re.findall(r'\{([^}]+)\}', result)
    if remaining_placeholders:
        app.logger.warning(f"Found unreplaced placeholders: {remaining_placeholders}")
    
    app.logger.info(f"Placeholder replacement completed: {replaced_count} placeholders replaced")
    app.logger.debug(f"Final prompt length after replacement: {len(result)}")
    return result

@app.route('/api/llm/stream_analysis', methods=['POST'])
def stream_analysis():
    data = request.json
    app.logger.info(f"Received stream_analysis request with data: {data}")
    
    api_key = data.get('api_key')
    model = data.get('model', 'doubao-seed-1-6-250615')  # 默认模型参数
    messages = data.get('messages')
    prompt_template = data.get('prompt_template')  # 获取提示词模板
    placeholders = data.get('placeholders', {})  # 获取占位符字典

    # 检查必需参数：api_key 是必须的，messages 或 (prompt_template 和 placeholders) 之一必须提供
    if not api_key:
        error_msg = "Missing api_key"
        app.logger.error(error_msg)
        return jsonify({"error": error_msg}), 400

    # 如果提供了提示词模板和占位符，则进行替换以生成 messages
    if prompt_template:
        # 合并默认占位符和传入的占位符
        all_placeholders = {}
        # 可以在这里添加一些默认的占位符
        all_placeholders.update(placeholders)
        prompt = replace_placeholders(prompt_template, all_placeholders)
        # 使用替换后的提示词
        messages = [{'role': 'user', 'content': prompt}]
        app.logger.info(f"Prompt after placeholder replacement: {prompt}")
    
    # 如果到这里还没有 messages，则报错
    if not messages:
        error_msg = "Missing messages or (prompt_template and placeholders)"
        app.logger.error(error_msg)
        return jsonify({"error": error_msg}), 400

    # 处理额外参数
    extra_params = {}
    temperature = data.get('temperature')
    max_tokens = data.get('max_tokens')

    if temperature is not None:
        extra_params['temperature'] = temperature
    if max_tokens is not None:
        extra_params['max_tokens'] = max_tokens

    def generate():
        try:
            # 使用OpenAI SDK进行流式调用
            client = OpenAI(
                base_url="https://ark.cn-beijing.volces.com/api/v3",
                api_key=api_key
            )
            
            # 准备调用参数
            call_params = {
                "model": model,
                "messages": messages,
                "stream": True,
                **extra_params  # 展开额外参数
            }
            
            app.logger.info(f"Calling LLM with params: {call_params}")
            app.logger.info(f"Prompt sent to LLM (first 500 chars): {call_params['messages'][0]['content'][:500]}...")
            
            stream = client.chat.completions.create(**call_params)
            
            for chunk in stream:
                if not chunk.choices:
                    continue
                
                # 处理 reasoning_content
                reasoning_content = ""
                if hasattr(chunk.choices[0].delta, 'reasoning_content'):
                    reasoning_content = chunk.choices[0].delta.reasoning_content or ""
                if reasoning_content:
                    # 按照SSE格式返回推理内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"reasoning\", \"content\": {json.dumps(reasoning_content)}}}\n\n"
                
                # 处理 content
                content = ""
                if hasattr(chunk.choices[0].delta, 'content'):
                    content = chunk.choices[0].delta.content or ""
                if content:
                    # 按照SSE格式返回内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"content\", \"content\": {json.dumps(content)}}}\n\n"
            
            # 发送结束信号
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"LLM Request error: {str(e)}"
            app.logger.error(error_msg)
            # 使用 json.dumps 确保错误信息被正确转义
            import json
            yield f"data: {{\"error\": {json.dumps(str(e))}}}\n\n"

    app.logger.info("Starting stream response for LLM analysis")
    return Response(generate(), content_type='text/event-stream')

@app.route('/api/llm/doc_import_analysis', methods=['POST'])
def doc_import_analysis():
    data = request.json
    app.logger.info(f"Received doc_import_analysis request with data: {data}")
    
    doc_token = data.get('doc_token')
    doc_type = data.get('doc_type', 'docx')  # 获取文档类型，默认为docx
    wiki_node_md = data.get('wiki_node_md')
    api_key = data.get('api_key')
    model = data.get('model', 'doubao-seed-1-6-250615')  # 从请求参数获取模型名称，使用新的默认值
    prompt_template = data.get('prompt_template')  # 从请求参数获取提示词模板
    wiki_title = data.get('wiki_title')  # 从请求参数获取知识库标题
    placeholders = data.get('placeholders', {})  # 获取占位符字典
    user_access_token = request.headers.get('Authorization')
    if user_access_token:
        user_access_token = user_access_token.replace('Bearer ', '')

    if not all([doc_token, wiki_node_md, api_key, user_access_token]):
        error_msg = "Missing required parameters"
        app.logger.error(error_msg)
        return jsonify({"error": error_msg}), 400

    # 1. Get document content from Feishu
    doc_content = ''
    try:
        # 如果是wiki类型，需要先获取实际的obj_type和obj_token
        if doc_type == 'wiki':
            app.logger.info(f"Processing wiki type document with token: {doc_token}")
            # 调用获取知识空间节点接口
            node_url = f"https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token={doc_token}"
            headers = {"Authorization": f"Bearer {user_access_token}"}
            app.logger.info(f"Fetching wiki node info with URL: {node_url}")
            
            node_response = requests.get(node_url, headers=headers)
            node_response.raise_for_status()
            node_data = node_response.json()
            app.logger.info(f"Received wiki node info: {node_data}")
            
            if node_data.get("code") == 0:
                node_info = node_data.get("data", {})
                # 从嵌套的node对象中获取obj_type和obj_token
                node_detail = node_info.get("node", {})
                actual_obj_type = node_detail.get("obj_type")
                actual_obj_token = node_detail.get("obj_token")
                
                # 添加详细的调试日志，记录完整的数据结构
                app.logger.info(f"Wiki node data structure - node_info: {node_info}")
                app.logger.info(f"Wiki node detail - node_detail: {node_detail}")
                app.logger.info(f"Wiki node resolved - obj_type: {actual_obj_type}, obj_token: {actual_obj_token}")
                
                # 配置化的支持文档类型，便于扩展
                SUPPORTED_DOC_TYPES = ['doc', 'docx']
                
                # 检查obj_type是否为支持的文档类型
                if not actual_obj_type:
                    error_msg = f"Failed to extract document type from wiki node. Response structure may have changed."
                    app.logger.error(error_msg)
                    app.logger.error(f"Available fields in node_detail: {list(node_detail.keys()) if node_detail else 'None'}")
                    return jsonify({"error": error_msg}), 400
                
                # 检查obj_token是否存在
                if not actual_obj_token:
                    error_msg = f"Failed to extract document token from wiki node. Document token is required."
                    app.logger.error(error_msg)
                    app.logger.error(f"Document type: {actual_obj_type}, Available fields: {list(node_detail.keys()) if node_detail else 'None'}")
                    return jsonify({"error": error_msg}), 400
                
                if actual_obj_type not in SUPPORTED_DOC_TYPES:
                    error_msg = f"Unsupported document type: {actual_obj_type}. Only {', '.join(SUPPORTED_DOC_TYPES)} types are supported."
                    app.logger.error(error_msg)
                    app.logger.error(f"Document token: {actual_obj_token}, Available types: {list(node_detail.keys()) if node_detail else 'None'}")
                    return jsonify({"error": error_msg}), 400
                
                # 根据文档类型构建不同的API URL，增强可扩展性
                if actual_obj_type == 'docx':
                    doc_url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{actual_obj_token}/raw_content"
                elif actual_obj_type == 'doc':
                    doc_url = f"https://open.feishu.cn/open-apis/doc/v1/documents/{actual_obj_token}/raw_content"
                else:
                    # 理论上不会执行到这里，因为前面已经检查了支持的类型
                    error_msg = f"Document type {actual_obj_type} not implemented yet."
                    app.logger.error(error_msg)
                    return jsonify({"error": error_msg}), 500
                app.logger.info(f"Fetching document content for wiki with resolved URL: {doc_url}")
            else:
                error_msg = node_data.get("msg", "Failed to fetch wiki node info")
                app.logger.error(error_msg)
                return jsonify({"error": error_msg}), 500
        else:
            # 直接使用doc_token获取文档内容
            doc_url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{doc_token}/raw_content"
            app.logger.info(f"Fetching document content from Feishu with URL: {doc_url}")
        
        # 获取文档内容
        headers = {"Authorization": f"Bearer {user_access_token}"}
        response = requests.get(doc_url, headers=headers)
        response.raise_for_status()
        doc_data = response.json()
        app.logger.info(f"Received response from Feishu: {doc_data}")
        
        if doc_data.get("code") == 0:
            doc_content = doc_data.get("data", {}).get('content', '')
            app.logger.info(f"Successfully fetched document content, length: {len(doc_content)}")
        else:
            error_msg = doc_data.get("msg", "Failed to fetch document content")
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 500
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to fetch document content: {e}"
        app.logger.error(error_msg)
        return jsonify({"error": str(e)}), 500

    # 2. Construct prompt and call LLM
    # 如果提供了提示词模板，则使用模板替换占位符，否则使用默认提示词
    # 优化占位符命名以提高可维护性
    if prompt_template:
        # 合并默认占位符和传入的占位符
        all_placeholders = {
            'IMPORTED_DOCUMENT_CONTENT': doc_content,
            'KNOWLEDGE_BASE_STRUCTURE': wiki_node_md,
            'WIKI_TITLE': wiki_title or ''
        }
        all_placeholders.update(placeholders)
        prompt = replace_placeholders(prompt_template, all_placeholders)
        # 记录占位符替换前后的对比，便于调试
        app.logger.info(f"Placeholder replacement debug:")
        app.logger.info(f"  - IMPORTED_DOCUMENT_CONTENT length: {len(doc_content)}")
        app.logger.info(f"  - KNOWLEDGE_BASE_STRUCTURE length: {len(wiki_node_md)}")
        app.logger.info(f"  - WIKI_TITLE: {wiki_title}")
        app.logger.info(f"  - Received placeholders: {placeholders}")
        app.logger.info(f"Prompt after placeholder replacement (first 200 chars): {prompt[:200]}...")
    else:
        prompt = f"""你是一位专业的知识管理专家，具备以下能力：
1. 深入理解文档内容，分析其主题、关键信息和潜在价值。
2. 熟悉知识库的现有结构，能够准确判断文档的最佳归属节点。
3. 提供清晰、有说服力的分析和建议，帮助用户做出决策。

## 评估材料
**知识库标题**：
{wiki_title or ''}

**导入文档内容**：
{doc_content}

**当前知识库结构**：
{wiki_node_md}

## 评估任务
请根据以上材料，完成以下三个任务：

### 1. 内容匹配度分析
分析导入文档与知识库现有节点的相关性，评估其在知识库中的潜在价值。

### 2. 归属节点建议
基于内容分析，推荐1-3个最适合的现有节点作为文档的归属位置，并简要说明理由。

### 3. 导入决策
综合以上分析，给出是否建议导入该文档的最终决策（建议导入/暂不建议导入），并提供简要说明。"""
        app.logger.info(f"Using default prompt template")

    def generate():
        try:
            # 使用OpenAI SDK进行流式调用
            client = OpenAI(
                base_url="https://ark.cn-beijing.volces.com/api/v3",
                api_key=api_key
            )
            
            call_params = {
                "model": model,
                "messages": [{'role': 'user', 'content': prompt}],
                "stream": True,
            }
            app.logger.info(f"Calling LLM with params: {call_params}")
            
            stream = client.chat.completions.create(**call_params)
            
            for chunk in stream:
                if not chunk.choices:
                    continue
                
                # 处理 reasoning_content
                reasoning_content = ""
                if hasattr(chunk.choices[0].delta, 'reasoning_content'):
                    reasoning_content = chunk.choices[0].delta.reasoning_content or ""
                if reasoning_content:
                    # 按照SSE格式返回推理内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"reasoning\", \"content\": {json.dumps(reasoning_content)}}}\n\n"
                
                # 处理 content
                content = ""
                if hasattr(chunk.choices[0].delta, 'content'):
                    content = chunk.choices[0].delta.content or ""
                if content:
                    # 按照SSE格式返回内容，并添加前缀以区分
                    # 使用 json.dumps 确保内容被正确转义
                    import json
                    yield f"data: {{\"type\": \"content\", \"content\": {json.dumps(content)}}}\n\n"
            
            # 发送结束信号
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"LLM Request error: {str(e)}"
            app.logger.error(error_msg)
            # 使用 json.dumps 确保错误信息被正确转义
            import json
            yield f"data: {{\"error\": {json.dumps(str(e))}}}\n\n"
        finally:
            app.logger.info("Finished stream response for document import analysis")

    app.logger.info("Starting stream response for document import analysis")
    return Response(generate(), content_type='text/event-stream')

if __name__ == '__main__':
    load_dotenv()
    app.run(port=BACKEND_PORT, debug=False, use_reloader=False)
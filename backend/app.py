import os
import uuid
import requests
import logging
from flask import Flask, request, jsonify, Response, stream_with_context, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
from urllib.parse import urlencode
from functools import wraps
from aily_service import AilyService

# 加载 .env 文件中的环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)  # 允许所有来源的跨域请求

# 设置日志
logging.basicConfig(filename='app.log', level=logging.INFO, 
                    format='%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')

# 从环境变量中获取配置
APP_ID = os.getenv("APP_ID")
APP_SECRET = os.getenv("APP_SECRET")
AILY_APP_ID = os.getenv("AILY_APP_ID")
SKILL_ID = os.getenv("SKILL_ID")

# 实例化 AilyService
aily_service = AilyService(APP_ID, APP_SECRET, AILY_APP_ID, SKILL_ID)

# 存储用户会话和 token
user_sessions = {}

@app.route('/api/auth/login', methods=['GET'])
def login():
    """
    引导用户到飞书进行 OAuth 授权。
    """
    redirect_uri = url_for('callback', _external=True, _scheme='http')
    # 确保在生产环境中使用 https
    if not app.debug:
        redirect_uri = redirect_uri.replace('http://', 'https://')

    auth_url = f"https://open.feishu.cn/open-apis/authen/v1/index?app_id={APP_ID}&redirect_uri={redirect_uri}"
    return redirect(auth_url)

@app.route('/api/auth/callback', methods=['GET'])
def callback():
    """
    处理飞书 OAuth 回调，获取用户信息和访问令牌。
    """
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "Authorization code not found"}), 400

    # 获取 app_access_token
    try:
        token_url = "https://open.feishu.cn/open-apis/authen/v1/access_token"
        headers = {"Content-Type": "application/json"}
        payload = {
            "app_id": APP_ID,
            "app_secret": APP_SECRET,
            "grant_type": "authorization_code",
            "code": code
        }
        response = requests.post(token_url, headers=headers, json=payload)
        response.raise_for_status()
        token_data = response.json().get('data', {})
        
        user_access_token = token_data.get('access_token')
        if not user_access_token:
            return jsonify({"error": "Failed to get user access token"}), 500

        # 使用 user_access_token 获取用户信息
        user_info_url = "https://open.feishu.cn/open-apis/authen/v1/user_info"
        user_headers = {"Authorization": f"Bearer {user_access_token}"}
        user_response = requests.get(user_info_url, headers=user_headers)
        user_response.raise_for_status()
        user_info = user_response.json().get('data', {})
        user_id = user_info.get('user_id')

        if not user_id:
            return jsonify({"error": "Failed to get user_id"}), 500

        # 存储会话信息
        session_id = str(uuid.uuid4())
        user_sessions[user_access_token] = {
            "user_id": user_id,
            "session_id": session_id
        }

        # 重定向到前端，并携带 token
        # 在生产环境中，应重定向到更安全的页面
        frontend_url = f"http://localhost:80/auth?token={user_access_token}"
        return redirect(frontend_url)

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error during Feishu API call: {e}")
        return jsonify({"error": "Failed to communicate with Feishu API", "details": str(e)}), 502
    except Exception as e:
        app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        if token not in user_sessions:
            return jsonify({'message': 'Token is invalid or expired!'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/aily/run', methods=['POST'])
@token_required
def run_aily_skill():
    """
    接收前端请求，调用 Aily Service 的 run_skill_stream 方法。
    """
    data = request.get_json()
    prompt = data.get('prompt')
    token = request.headers['Authorization'].split(" ")[1]
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    user_id = user_sessions[token]['user_id']
    session_id = user_sessions[token]['session_id']

    # 使用 stream_with_context 和生成器函数来处理流式响应
    def generate():
        try:
            for chunk in aily_service.run_skill_stream(session_id, user_id, prompt):
                yield chunk
        except Exception as e:
            app.logger.error(f"Error streaming from Aily service: {e}")
            # 如果流中断，可以考虑返回一个错误事件
            error_event = {"error": "Stream failed"}
            yield f"data: {json.dumps(error_event)}\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)

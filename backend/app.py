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
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000", "supports_credentials": True}})

# --- Logging Configuration ---
if __name__ == '__main__':
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)

# 请替换为你的 App ID 和 App Secret
APP_ID = "cli_a8e91e9639bd1013"
APP_SECRET = "OmjLOJ40ISFTQyEE47wjzKiSdGsUVf6d"

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
        "client_id": APP_ID,
        "client_secret": APP_SECRET,
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
    return f'<script>window.location.href = "http://localhost:3000/?code={code}";</script>'

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
    page_size = request.args.get('page_size', 20)

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

    def __call__(self, f):
        def wrapped(*args, **kwargs):
            now = time.time()
            # 移除一分钟前的调用记录
            self.calls = [c for c in self.calls if c > now - self.per_seconds]
            if len(self.calls) >= self.max_calls:
                # 计算需要等待的时间
                sleep_time = (self.calls[0] + self.per_seconds) - now
                if sleep_time > 0:
                    app.logger.warning(f"Rate limit reached. Sleeping for {sleep_time:.2f} seconds.")
                    time.sleep(sleep_time)
            self.calls.append(time.time())
            return f(*args, **kwargs)
        return wrapped

rate_limiter = RateLimiter(max_calls=90, per_seconds=60)

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
        return requests.get(url, headers=headers, params=params)

    response = fetch_with_rate_limit()
    response.raise_for_status()
    return response.json().get("data", {})



def fetch_all_nodes_recursively(space_id, user_access_token, parent_node_token=None):
    nodes = []
    page_token = None
    while True:
        url = f"https://open.feishu.cn/open-apis/wiki/v2/spaces/{space_id}/nodes"
        headers = {"Authorization": f"Bearer {user_access_token}"}
        params = {"page_size": 50}
        if parent_node_token:
            params['parent_node_token'] = parent_node_token
        if page_token:
            params['page_token'] = page_token

        @RateLimiter(max_calls=90, per_seconds=60)
        def fetch_with_rate_limit():
            return requests.get(url, headers=headers, params=params)

        response = fetch_with_rate_limit()
        response.raise_for_status()
        data = response.json().get("data", {})
        items = data.get("items", [])
        nodes.extend(items)

        with ThreadPoolExecutor() as executor:
            future_to_node = {executor.submit(fetch_all_nodes_recursively, space_id, user_access_token, item['node_token']): item for item in items if item.get('has_child')}
            for future in as_completed(future_to_node):
                node = future_to_node[future]
                try:
                    children = future.result()
                    # Find the node in the list and add its children
                    for n in nodes:
                        if n['node_token'] == node['node_token']:
                            n['children'] = children
                            break
                except Exception as exc:
                    app.logger.error(f'{node["node_token"]} generated an exception: {exc}')

        if not data.get('has_more'):
            break
        page_token = data.get('page_token')
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
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/wiki/<space_id>/nodes', methods=['GET'])
def get_wiki_nodes(space_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Unauthorized"}), 401
    user_access_token = auth_header.split(' ')[1]

    fetch_all = request.args.get('fetch_all', 'false').lower() == 'true'

    try:
        if fetch_all:
            nodes = fetch_all_nodes_recursively(space_id, user_access_token)
            return jsonify({"items": nodes})
        else:
            parent_node_token = request.args.get('parent_node_token')
            page_token = request.args.get('page_token')
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
    user_access_token = request.headers.get('user-access-token')
    if not user_access_token:
        return jsonify({"error": "User Access Token is required"}), 401

    url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{obj_token}/raw_content"
    headers = {
        "Authorization": f"Bearer {user_access_token}"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data.get("code") == 0:
            return jsonify(data.get("data", {}))
        else:
            return jsonify({"error": data.get("msg", "Failed to fetch document")}), 500
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Request error: {str(e)}")
        if e.response is not None:
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
    model = data.get('model')
    messages = data.get('messages')

    if not all([api_key, model, messages]):
        return jsonify({"error": "Missing required parameters"}), 400

    def generate():
        url = "https://volc.aipa.bytedance.net/api/chat/stream"
        payload = {
            "api_key": api_key,
            "model": model,
            "messages": messages,
            "parameters": {
                "stream": True
            }
        }
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        }

        try:
            with requests.post(url, json=payload, headers=headers, stream=True) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=None):
                    if chunk:
                        yield chunk
        except requests.exceptions.RequestException as e:
            app.logger.error(f"LLM request error: {e}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return Response(generate(), content_type='text/event-stream')


@app.route('/api/llm/stream_analysis', methods=['POST'])
def stream_analysis():
    data = request.json
    api_key = data.get('api_key')
    model = data.get('model', 'doubao-1.5-pro-32k-250115')
    messages = data.get('messages')

    if not api_key or not messages:
        return jsonify({"error": "Missing api_key or messages"}), 400

    payload = {
        'api_key': api_key,
        'model': model,
        'messages': messages
    }

    parameters = {}
    temperature = data.get('temperature')
    max_tokens = data.get('max_tokens')

    if temperature is not None:
        parameters['temperature'] = temperature
    if max_tokens is not None:
        parameters['max_tokens'] = max_tokens

    if parameters:
        payload['parameters'] = parameters

    headers = {
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(
            'https://volc.aipa.bytedance.net/api/chat/stream',
            data=json.dumps(payload),
            headers=headers,
            stream=True
        )
        response.raise_for_status()

        def generate():
            for chunk in response.iter_content(chunk_size=None):
                if chunk:
                    yield chunk
        
        return Response(generate(), content_type='text/event-stream')

    except requests.exceptions.RequestException as e:
        app.logger.error(f"LLM Request error: {str(e)}")
        if e.response is not None:
            app.logger.error(f"LLM Response status: {e.response.status_code}")
            app.logger.error(f"LLM Response content: {e.response.text}")
            try:
                error_data = e.response.json()
                return jsonify({"error": error_data}), e.response.status_code
            except ValueError:
                return jsonify({"error": e.response.text}), e.response.status_code
        return jsonify({"error": str(e)}), 500

@app.route('/api/llm/doc_import_analysis', methods=['POST'])
def doc_import_analysis():
    data = request.json
    doc_token = data.get('doc_token')
    wiki_node_md = data.get('wiki_node_md')
    api_key = data.get('api_key')
    user_access_token = request.headers.get('user-access-token')

    if not all([doc_token, wiki_node_md, api_key, user_access_token]):
        return jsonify({"error": "Missing required parameters"}), 400

    # 1. Get document content from Feishu
    doc_content = ''
    try:
        doc_url = f"https://open.feishu.cn/open-apis/docx/v1/documents/{doc_token}/raw_content"
        headers = {"Authorization": f"Bearer {user_access_token}"}
        response = requests.get(doc_url, headers=headers)
        response.raise_for_status()
        doc_data = response.json()
        if doc_data.get("code") == 0:
            doc_content = doc_data.get("data", {}).get('content', '')
        else:
            return jsonify({"error": doc_data.get("msg", "Failed to fetch document content")}), 500
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Failed to fetch document content: {e}")
        return jsonify({"error": str(e)}), 500

    # 2. Construct prompt and call LLM
    prompt = f"""你是一位知识管理专家，负责评估一篇外部文档是否适合导入当前的知识库中。请根据文档内容和知识库的现有结构，进行全面评估，并以Markdown格式输出结果。

## 评估材料

### 待导入文档内容：
{doc_content}

### 当前知识库结构：
{wiki_node_md}

## 评估任务

1.  **内容匹配度分析**：
    -   分析文档主题是否与知识库的整体定位相符。
    -   评估文档内容在知识库中是否已有类似或重复的内容。

2.  **归属节点建议**：
    -   如果文档适合导入，请建议一个最合适的存放节点（请从“当前知识库结构”中选择一个最相关的节点token）。
    -   并详细说明为什么建议放在该节点下。

3.  **导入决策**：
    -   明确给出“建议导入”或“不建议导入”的结论。

请严格按照以上结构进行分析和输出。
"""

    payload = {
        'api_key': api_key,
        'model': 'doubao-seed-1-6-thinking-250615',
        'messages': [{'role': 'user', 'content': prompt}]
    }

    headers = {
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(
            'https://volc.aipa.bytedance.net/api/chat/stream',
            data=json.dumps(payload),
            headers=headers,
            stream=True
        )
        response.raise_for_status()

        def generate():
            for chunk in response.iter_content(chunk_size=None):
                if chunk:
                    yield chunk
        
        return Response(generate(), content_type='text/event-stream')

    except requests.exceptions.RequestException as e:
        app.logger.error(f"LLM Request error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    load_dotenv()
    port = int(os.getenv('FLASK_RUN_PORT', 5001))
    app.run(port=port, debug=False, use_reloader=False)
import requests
import json

class AilyService:
    def __init__(self, app_id, app_secret, aily_app_id, skill_id):
        self.app_id = app_id
        self.app_secret = app_secret
        self.aily_app_id = aily_app_id
        self.skill_id = skill_id
        self.tenant_access_token = self._get_tenant_access_token()

    def _get_tenant_access_token(self):
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json"}
        payload = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["tenant_access_token"]

    def run_skill_stream(self, session_id, user_id, prompt):
        url = f"https://open.feishu.cn/open-apis/aily/v1/apps/{self.aily_app_id}/skills/{self.skill_id}/run?run_mode=stream"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.tenant_access_token}"
        }
        payload = {
            "session_id": session_id,
            "user_id": user_id,
            "skill_input": prompt
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, stream=True)
            response.raise_for_status() # 检查请求是否成功
            
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    yield decoded_line + '\n\n' # 确保每个事件后有两个换行符

        except requests.exceptions.RequestException as e:
            # 捕获请求相关的异常
            error_message = f'Error making request to Aily service: {e}'
            print(error_message)
            # 将错误信息以 SSE 格式返回
            error_event = {"error": error_message}
            yield f"data: {json.dumps(error_event)}\n\n"
        except Exception as e:
            # 捕获其他所有异常
            error_message = f'An unexpected error occurred: {e}'
            print(error_message)
            error_event = {"error": error_message}
            yield f"data: {json.dumps(error_event)}\n\n"

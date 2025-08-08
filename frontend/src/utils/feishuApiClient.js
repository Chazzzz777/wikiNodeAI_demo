import axios from 'axios';

// 创建飞书 API 客户端实例
const feishuApiClient = axios.create({
  // 飞书 API 的基础 URL
  baseURL: 'https://open.feishu.cn/open-apis',
  // 设置默认的请求头
  headers: {
    'Content-Type': 'application/json',
    'charset': 'utf-8'
  }
});

// 请求拦截器
feishuApiClient.interceptors.request.use(
  config => {
    // 记录请求日志
    console.log('Feishu API Request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data
    });
    
    // 如果有用户访问令牌，则添加到请求头中
    const userAccessToken = localStorage.getItem('user_access_token');
    if (userAccessToken) {
      config.headers.Authorization = `Bearer ${userAccessToken}`;
    }
    
    return config;
  },
  error => {
    // 记录请求错误日志
    console.error('Feishu API Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
feishuApiClient.interceptors.response.use(
  response => {
    // 记录响应日志
    console.log('Feishu API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    
    // 检查响应状态码
    if (response.status === 200) {
      // 飞书 API 通常使用 code 字段表示业务状态
      if (response.data.code === 0) {
        // 业务成功，返回数据
        return response.data;
      } else {
        // 业务失败，抛出错误
        const error = new Error(response.data.msg || 'Feishu API request failed');
        error.code = response.data.code;
        error.response = response;
        console.error('Feishu API Business Error:', error);
        return Promise.reject(error);
      }
    } else {
      // HTTP 状态码错误
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.response = response;
      console.error('Feishu API HTTP Error:', error);
      return Promise.reject(error);
    }
  },
  error => {
    // 记录响应错误日志
    console.error('Feishu API Response Error:', error);
    
    // 处理网络错误等
    if (!error.response) {
      // 网络错误
      console.error('Feishu API Network Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default feishuApiClient;
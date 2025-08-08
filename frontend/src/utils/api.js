import axios from 'axios';

const apiClient = axios.create({
  baseURL: `http://localhost:${process.env.REACT_APP_BACKEND_PORT || 5001}`,
});

// 重试机制的请求函数
const requestWithRetry = async (requestFn, maxRetries = 3, retryDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      lastError = error;
      
      // 如果是429错误且还有重试次数，则等待后重试
      if (error.response && error.response.status === 429 && i < maxRetries) {
        const retryAfter = error.response.data.retry_after || retryDelay;
        console.log(`Rate limit hit. Retrying in ${retryAfter}ms. Attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      
      // 其他错误或达到最大重试次数时，直接抛出错误
      throw error;
    }
  }
  
  throw lastError;
};

apiClient.interceptors.request.use(config => {
  console.log('Request URL in interceptor:', config.url);
  const token = localStorage.getItem('user_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }
  // 如果是登录请求，则不进行拦截
  if (config.url === '/api/auth/token') {
    return config;
  }
  window.location.href = '/';
  return Promise.reject(new Error('No token found, redirecting to login.'));
}, error => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('user_access_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// 为apiClient添加重试功能
const originalGet = apiClient.get;
const originalPost = apiClient.post;

apiClient.get = function(url, config = {}) {
  return requestWithRetry(() => originalGet.call(this, url, config));
};

apiClient.post = function(url, data, config = {}) {
  return requestWithRetry(() => originalPost.call(this, url, data, config));
};

export default apiClient;
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5001',
});

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
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('user_access_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
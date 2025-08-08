import axios from 'axios';
import { flushSync } from 'react-dom';

// 创建 LLM API 客户端实例
const llmApiClient = axios.create({
  baseURL: '/api/llm',
  // 设置默认的请求头
  headers: {
    'Content-Type': 'application/json',
    'charset': 'utf-8'
  },
  // 配置响应类型为流
  responseType: 'stream'
});

// 请求拦截器
llmApiClient.interceptors.request.use(
  config => {
    // 记录请求日志
    console.log('LLM API Request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
    
    return config;
  },
  error => {
    // 记录请求错误日志
    console.error('LLM API Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
llmApiClient.interceptors.response.use(
  response => {
    // 对于流式响应，不记录响应体日志以避免干扰流式处理
    if (response.config.responseType === 'stream') {
      console.log('LLM API Stream Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } else {
      // 记录响应日志
      console.log('LLM API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });
    }
    
    return response;
  },
  error => {
    // 记录响应错误日志
    console.error('LLM API Response Error:', error);
    
    // 处理网络错误等
    if (!error.response) {
      // 网络错误
      console.error('LLM API Network Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * 处理流式响应的通用函数
 * @param {Object} config - 请求配置对象
 * @param {Function} onChunk - 处理每个数据块的回调函数
 * @param {Function} onDone - 处理完成事件的回调函数
 * @param {Function} onError - 处理错误的回调函数
 * @param {Function} forceUpdate - 强制更新UI的函数
 */
export const handleStreamResponse = async (config, onChunk, onDone, onError, forceUpdate) => {
  try {
    // 使用 fetch API 处理流式响应
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: config.headers,
      body: JSON.stringify(config.data),
      signal: controller.signal
    });
    
    // 清除超时计时器
    clearTimeout(timeoutId);
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    // 检查响应状态
  if (!response.ok) {
    // 尝试从响应中提取错误信息
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorText = await response.text();
      if (errorText) {
        errorMessage = `HTTP error! status: ${response.status}, message: ${errorText}`;
      }
    } catch (e) {
      // 如果无法提取错误信息，则使用默认错误信息
    }
    throw new Error(errorMessage);
  }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) {
        if (onDone) onDone();
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      
      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const data = part.substring(6).trim();
          if (data === '[DONE]') {
            if (onDone) onDone();
            return;
          }
          
          // 检查数据是否为JSON格式
          if (data.startsWith('{') && data.endsWith('}')) {
            try {
              const json = JSON.parse(data);
              
              // 检查是否有错误信息
              if (json.error) {
                throw new Error(json.error);
              }
              
              // 直接将解析出的 JSON 对象传递给 onChunk
              // 不再递归解析 content 字段，因为这会导致 type 为 'content' 的数据被错误处理
              if (onChunk) {
                onChunk(json);
              }
              // 强制更新UI
              if (forceUpdate) {
                forceUpdate();
              }
            } catch (e) {
              console.error('Error parsing JSON chunk:', data, e);
              // 如果JSON解析失败，将原始数据作为文本处理
              if (onChunk) onChunk({ text: data });
            }
          } else {
            // 处理纯文本数据块
            if (onChunk) onChunk({ text: data });
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream response error:', error);
    if (onError) onError(error);
    // 重新抛出错误，让调用者能够处理
    throw error;
  }
};

export default llmApiClient;
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Typography } from 'antd';
import apiClient from '../utils/api';
import './Auth.css';

const { Title, Text } = Typography;

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('user_access_token');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const REDIRECT_URI = 'http://localhost:3000';

    if (token) {
      navigate('/wiki');
      return;
    }

    if (code) {
      apiClient.post('/api/auth/token', { code, redirect_uri: REDIRECT_URI })
        .then(response => {
          const { user_access_token } = response.data;
          if (user_access_token) {
            localStorage.setItem('user_access_token', user_access_token);
            navigate('/wiki');
          } else {
            setError('未能从响应中获取授权令牌。');
            setLoading(false);
          }
        })
        .catch(err => {
          let errorMsg = '无法获取授权，请稍后重试或联系管理员。';
          if (err.response) {
            errorMsg = `授权请求失败 [${err.response.status}]: ${JSON.stringify(err.response.data || err.response.statusText)}`;
          } else if (err.message) {
            errorMsg = `网络错误: ${err.message}`;
          }
          setError(errorMsg);
          setLoading(false);
        });
    } else {
      const APP_ID = 'cli_a8e91e9639bd1013';
      const scope = 'docx:document:readonly wiki:node:move wiki:node:retrieve wiki:space:read wiki:space:retrieve';
      const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
      window.location.href = `https://open.feishu.cn/open-apis/authen/v1/index?redirect_uri=${encodedRedirectUri}&app_id=${APP_ID}&scope=${scope}`;
    }
  }, [navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Title level={3} className="auth-title">知识库管理助手</Title>
        {loading && (
          <>
            <Spin size="large" />
            <p className="auth-tip">正在跳转至飞书授权...</p>
          </>
        )}
        {error && <Text type="danger">{error}</Text>}
      </div>
    </div>
  );
};

export default Auth;
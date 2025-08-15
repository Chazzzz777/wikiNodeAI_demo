import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #121212;
    color: #e8e6e3;
    position: relative;
    overflow-x: hidden;

    /* 强制禁用系统深色/浅色模式适配 */
    color-scheme: dark;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at center, rgba(66, 71, 85, 0.5) 0%, rgba(66, 71, 85, 0) 40%),
                  radial-gradient(circle at 20% 20%, rgba(120, 80, 180, 0.4) 0%, rgba(120, 80, 180, 0) 30%),
                  radial-gradient(circle at 80% 70%, rgba(70, 150, 150, 0.4) 0%, rgba(70, 150, 150, 0) 30%);
      z-index: -1;
    }
  }

  /* 强制覆盖系统主题设置 */
  html {
    color-scheme: dark;
  }

  /* 确保在所有模式下都使用深色主题 */
  @media (prefers-color-scheme: light) {
    body {
      background: #121212;
      color: #e8e6e3;
    }
  }

  code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
      monospace;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  * {
    box-sizing: border-box;
  }

  /* 覆盖antd默认样式以适应深色主题 */
  .ant-card {
    background: #2a2d31;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e8e6e3;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border-radius: 16px;
    overflow: hidden;
  }

  .ant-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  }

  .ant-card-head {
    background: transparent;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .ant-card-head-title {
    color: #e8e6e3;
  }

  .ant-card-body {
    color: #e8e6e3;
  }

  .ant-card-meta-title {
    color: #e8e6e3 !important;
  }

  .ant-card-meta-description {
    color: #a0a0a0 !important;
  }

  .ant-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #e8e6e3;
    transition: all 0.3s ease;
    border-radius: 8px;
  }

  .ant-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .ant-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e8e6e3;
    border-radius: 8px;
  }

  .ant-input:focus {
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }

  .ant-list-item-meta-title a {
    color: #e8e6e3;
    transition: color 0.3s ease;
  }

  .ant-list-item-meta-title a:hover {
    color: #ffffff;
  }

  .ant-spin-text {
    color: #a0a0a0;
  }

  .ant-typography {
    color: #e8e6e3;
  }

  .ant-typography h1,
  .ant-typography h2,
  .ant-typography h3,
  .ant-typography h4,
  .ant-typography h5,
  .ant-typography h6 {
    color: #e8e6e3;
  }

  /* 动画效果 */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export default GlobalStyle;
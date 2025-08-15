import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { List, Spin, Typography, Button, message, Input, Card, Space } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import { initCardSpotlight, destroyCardSpotlight } from '../utils/cardSpotlight';
import { initResponsiveGrid, getResponsiveGrid } from '../utils/responsiveGrid';
import { generateCardColor } from '../utils/randomColors';
import { getAnimationManager, getGradientFlowAnimation } from '../utils/animationConfig';
import { getPerformanceMonitor } from '../utils/performanceMonitor';
import './Wiki.css';

const { Title } = Typography;

function Wiki() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);

  const [hasMore, setHasMore] = useState(true);
  const [pageToken, setPageToken] = useState(null);
  const loading = useRef(false);
  
  // 响应式网格配置状态
  const [gridConfig, setGridConfig] = useState({
    gutter: 24,
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    xxl: 6
  });
  
  // 卡片颜色缓存
  const [cardColors, setCardColors] = useState(new Map());
  
  // 动画配置状态
  const [animationConfig, setAnimationConfig] = useState({
    gradientFlow: 'gradientFlow 8s linear infinite',
    isAnimationEnabled: true,
    performanceLevel: 'HIGH'
  });
  
  // 动画管理器引用
  const animationManagerRef = useRef(null);
  
  // 性能监控引用
  const performanceMonitorRef = useRef(null);
  
  // 性能状态
  const [performanceStatus, setPerformanceStatus] = useState({
    level: 'good',
    fps: 60,
    memory: 0,
    isMonitoring: false
  });



  const loadMoreData = useCallback(() => {
    if (loading.current || !hasMore) return;
    loading.current = true;

    const params = { page_size: 20 };
    if (pageToken) {
      params.page_token = pageToken;
    }

    apiClient.get('/api/wiki/spaces', { params })
      .then(response => {
        const { items = [], has_more, page_token } = response.data;
        setSpaces(prevSpaces => [...prevSpaces, ...items]);
        setHasMore(has_more);
        setPageToken(page_token);
      })
      .catch(error => {
        console.error('Error fetching wiki spaces:', error);
        message.error('加载知识空间失败，请稍后重试。');
      })
      .finally(() => {
        loading.current = false;
      });
  }, [pageToken, hasMore]);

  useEffect(() => {
    if (spaces.length === 0) {
      loadMoreData();
    }
  }, [loadMoreData, spaces.length]);

  // 初始化卡片聚光灯效果
  useEffect(() => {
    // 初始化聚光灯效果
    const spotlightInstance = initCardSpotlight({
      selector: '.wiki-list .ant-card',
      spotlightOpacity: 0.15,
      spotlightSize: 200,
      transitionDuration: 0.3,
      enableOnMobile: false
    });

    // 组件卸载时清理资源
    return () => {
      destroyCardSpotlight();
    };
  }, []);

  // 初始化动画配置管理器
  useEffect(() => {
    // 获取动画管理器实例
    const animationManager = getAnimationManager();
    animationManagerRef.current = animationManager;
    
    // 处理动画配置变化
    const handleAnimationConfigChange = (performanceLevel, performanceConfig) => {
      const gradientFlowAnimation = getGradientFlowAnimation();
      
      setAnimationConfig({
        gradientFlow: gradientFlowAnimation,
        isAnimationEnabled: performanceConfig.enabled,
        performanceLevel: performanceLevel
      });
      
      // 记录动画配置变化日志
      console.log('Animation config updated:', {
        performanceLevel,
        enabled: performanceConfig.enabled,
        reducedMotion: performanceConfig.reducedMotion,
        gradientFlowAnimation,
        timestamp: new Date().toISOString()
      });
    };
    
    // 添加观察者
    animationManager.addObserver(handleAnimationConfigChange);
    
    // 初始设置
    const initialPerformanceLevel = animationManager.currentPerformanceLevel;
    const initialPerformanceConfig = animationManager.getCurrentPerformanceConfig();
    handleAnimationConfigChange(initialPerformanceLevel, initialPerformanceConfig);
    
    // 记录初始性能统计
    console.log('Initial animation performance stats:', animationManager.getPerformanceStats());
    
    // 组件卸载时清理资源
    return () => {
      animationManager.removeObserver(handleAnimationConfigChange);
    };
  }, []);

  // 初始化性能监控
  useEffect(() => {
    // 获取性能监控实例
    const performanceMonitor = getPerformanceMonitor();
    performanceMonitorRef.current = performanceMonitor;
    
    // 处理性能问题
    const handlePerformanceIssue = (issue) => {
      console.warn('Performance issue detected:', issue);
      
      // 更新性能状态
      setPerformanceStatus(prev => ({
        ...prev,
        level: issue.level,
        lastIssue: issue
      }));
      
      // 根据问题类型采取相应措施
      switch (issue.type) {
        case 'fps':
          if (issue.fps < 20) {
            // FPS过低，考虑禁用动画
            if (animationManagerRef.current) {
              animationManagerRef.current.setPerformanceLevel('LOW');
            }
          }
          break;
        case 'memory':
          if (issue.usage.percentage > 0.9) {
            // 内存使用过高，清理缓存
            setCardColors(new Map());
          }
          break;
        case 'longtask':
          // 长任务影响用户体验，记录详细信息
          console.error('Long task affecting user experience:', issue);
          break;
      }
    };
    
    // 添加性能问题观察者
    performanceMonitor.addObserver(handlePerformanceIssue);
    
    // 开始性能监控
    performanceMonitor.startMonitoring();
    
    // 更新状态
    setPerformanceStatus(prev => ({
      ...prev,
      isMonitoring: true
    }));
    
    // 记录初始系统信息
    console.log('Performance monitoring initialized:', {
      systemInfo: performanceMonitor.getSystemInfo(),
      supportedFeatures: performanceMonitor.supportedFeatures
    });
    
    // 组件卸载时清理资源
    return () => {
      performanceMonitor.removeObserver(handlePerformanceIssue);
      performanceMonitor.stopMonitoring();
      
      setPerformanceStatus(prev => ({
        ...prev,
        isMonitoring: false
      }));
    };
  }, []);

  // 获取性能优化建议
  const getPerformanceRecommendations = (report) => {
    const recommendations = [];
    const { summary, details } = report;
    
    // FPS相关建议
    if (details.fps.level === 'critical' || details.fps.level === 'poor') {
      recommendations.push({
        type: 'fps',
        priority: 'high',
        message: 'FPS过低，建议禁用动画效果',
        action: 'disable_animations'
      });
    }
    
    // 内存相关建议
    if (details.memory.level === 'critical' || details.memory.level === 'poor') {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: '内存使用过高，建议清理缓存',
        action: 'clear_cache'
      });
    }
    
    // 网络相关建议
    if (details.system.connection && 
        (details.system.connection.effectiveType === '2g' || 
         details.system.connection.saveData)) {
      recommendations.push({
        type: 'network',
        priority: 'medium',
        message: '网络连接较慢，建议启用数据节省模式',
        action: 'enable_data_saver'
      });
    }
    
    // 设备相关建议
    if (details.system.deviceMemory && details.system.deviceMemory < 2) {
      recommendations.push({
        type: 'device',
        priority: 'medium',
        message: '设备内存较低，建议简化界面效果',
        action: 'simplify_ui'
      });
    }
    
    return recommendations;
  };

  // 定期性能报告
  useEffect(() => {
    if (!performanceMonitorRef.current) {
      return;
    }
    
    const reportInterval = setInterval(() => {
      const report = performanceMonitorRef.current.generateReport();
      
      // 更新性能状态
      setPerformanceStatus(prev => ({
        ...prev,
        level: report.summary.level,
        fps: report.details.fps.average,
        memory: report.details.memory.averagePercentage
      }));
      
      // 记录详细报告
      console.log('Performance report:', {
        timestamp: new Date().toISOString(),
        summary: report.summary,
        spacesCount: spaces.length,
        cardColorsCount: cardColors.size,
        animationEnabled: animationConfig.isAnimationEnabled
      });
      
      // 如果性能较差，发出警告
      if (report.summary.level === 'critical' || report.summary.level === 'poor') {
        console.warn('Poor performance detected:', {
          level: report.summary.level,
          fps: report.details.fps,
          memory: report.details.memory,
          recommendations: getPerformanceRecommendations(report)
        });
      }
    }, 30000); // 每30秒生成一次报告
    
    return () => {
      clearInterval(reportInterval);
    };
  }, [spaces.length, cardColors.size, animationConfig.isAnimationEnabled]);

  // 初始化响应式网格
  useEffect(() => {
    // 初始化响应式网格工具
    const responsiveGrid = initResponsiveGrid({
      // 可以自定义断点和配置
      breakpoints: {
        xs: 0,
        sm: 576,
        md: 768,
        lg: 992,
        xl: 1200,
        xxl: 1400,
        xxxl: 1600
      }
    });

    // 处理屏幕尺寸变化
    const handleResize = (config) => {
      // 根据当前配置计算最优网格布局
      const newGridConfig = responsiveGrid.getListGridConfig({
          containerWidth: window.innerWidth,
          minCardWidth: 320 // 调大卡片最小宽度，从280px增加到320px，适应大屏幕需求
        });
      
      setGridConfig(newGridConfig);
      
      // 记录响应式调整日志
      console.log('Responsive grid updated:', {
        breakpoint: config.breakpoint,
        columns: newGridConfig.lg,
        screenWidth: config.screenWidth,
        timestamp: new Date().toISOString()
      });
    };

    // 初始设置
    const initialConfig = responsiveGrid.getCurrentConfig();
    handleResize(initialConfig);

    // 监听屏幕尺寸变化
    responsiveGrid.observeResize(handleResize);

    // 组件卸载时清理资源
    return () => {
      responsiveGrid.unobserveResize();
    };
  }, []);

  return (
    <div>
      {/* 标题区域 - 直接显示在底色上 */}
      <div className="wiki-title-section">
        <div className="wiki-title-container">
          <div className="wiki-title-content">
            <h1 className="wiki-title">AI 知识官</h1>
            <div className="wiki-subtitle">——"企业知识管理的精密校准仪，让大模型助力每一个企业构建夯实知识架构"</div>
          </div>
          <div className="wiki-title-actions">
            <Button onClick={() => navigate('/config')}>
              <span>AI 分析配置</span>
            </Button>
          </div>
        </div>
      </div>
      <main className="wiki-content">
        <InfiniteScroll
          dataLength={spaces.length}
          next={loadMoreData}
          hasMore={hasMore}
          loader={<div style={{ textAlign: 'center', padding: '20px 0' }}><Spin tip="加载中..." /></div>}
          endMessage={<div style={{ textAlign: 'center', padding: '20px 0' }}><b>没有更多了</b></div>}
        >
          <List
            className="wiki-list"
            grid={gridConfig}
            dataSource={spaces}
            renderItem={item => {
              // 获取或生成卡片颜色
              let cardColor = cardColors.get(item.space_id);
              if (!cardColor) {
                cardColor = generateCardColor(item.space_id);
                const newCardColors = new Map(cardColors);
                newCardColors.set(item.space_id, cardColor);
                setCardColors(newCardColors);
              }
              
              return (
                <List.Item key={item.space_id}>
                  <Link to={`/wiki/${item.space_id}`} style={{ display: 'block' }}>
                    <Card 
                      hoverable 
                      className="wiki-card-vertical"
                      style={{
                        background: `linear-gradient(315deg, ${cardColor.primaryColor}, ${cardColor.secondaryColor})`,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      cover={
                        <div 
                          className="wiki-card-cover" 
                          style={{
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                        </div>
                      }
                    >
                      {/* 哑光效果叠加层 - 移动到卡片级别 */}
                      <div 
                        className="wiki-card-matte-overlay"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: cardColor.overlay,
                          pointerEvents: 'none'
                        }}
                      />
                      <Card.Meta 
                        title={<div className="wiki-card-title">{item.name}</div>} 
                        description={<div className="wiki-card-description">{item.description || '暂无描述'}</div>}
                      />
                    </Card>
                  </Link>
                </List.Item>
              );
            }}
          />
        </InfiniteScroll>
      </main>
    </div>
  );
}

export default Wiki;
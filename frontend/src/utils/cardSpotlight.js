/**
 * 卡片聚光灯效果工具
 * 为卡片添加鼠标跟随的聚光灯效果，提升交互体验
 * 从健壮性和可扩展性角度设计
 */

// 防抖函数，优化性能
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 节流函数，优化性能
const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// 卡片聚光灯效果类
class CardSpotlightEffect {
  constructor(options = {}) {
    // 配置选项
    this.config = {
      selector: '.ant-card', // 卡片选择器
      spotlightOpacity: 0.15, // 聚光灯透明度
      spotlightSize: 200, // 聚光灯大小
      transitionDuration: 0.3, // 过渡动画时长
      enableOnMobile: false, // 是否在移动设备上启用
      ...options
    };
    
    // 状态管理
    this.isActive = false;
    this.cards = new Set();
    this.eventListeners = new Map();
    
    // 性能监控
    this.performanceMetrics = {
      mouseMoveEvents: 0,
      lastCleanupTime: Date.now(),
      averageResponseTime: 0
    };
    
    // 防闪烁优化
    this.updateTimeout = null;
    
    // 初始化
    this.init();
  }
  
  /**
   * 初始化聚光灯效果
   */
  init() {
    // 检查是否应该启用效果
    if (!this.shouldEnable()) {
      return;
    }
    
    // 设置CSS变量
    this.setupCSSVariables();
    
    // 查找所有卡片
    this.findCards();
    
    // 绑定事件
    this.bindEvents();
    
    // 启动性能监控
    this.startPerformanceMonitoring();
    
    this.isActive = true;
    console.log('Card spotlight effect initialized');
  }
  
  /**
   * 检查是否应该启用效果
   */
  shouldEnable() {
    // 检查移动设备
    if (!this.config.enableOnMobile && this.isMobile()) {
      return false;
    }
    
    // 检查浏览器支持
    if (!this.checkBrowserSupport()) {
      return false;
    }
    
    // 检查用户偏好
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查是否为移动设备
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * 检查浏览器支持
   */
  checkBrowserSupport() {
    const features = [
      'CSS' in window && 'supports' in window.CSS,
      'addEventListener' in window,
      'querySelector' in document
    ];
    
    return features.every(feature => feature);
  }
  
  /**
   * 设置CSS变量
   */
  setupCSSVariables() {
    const root = document.documentElement;
    root.style.setProperty('--card-spotlight-opacity', this.config.spotlightOpacity);
    root.style.setProperty('--card-transition', `all ${this.config.transitionDuration}s cubic-bezier(0.4, 0, 0.2, 1)`);
  }
  
  /**
   * 查找所有卡片
   */
  findCards() {
    const cardElements = document.querySelectorAll(this.config.selector);
    cardElements.forEach(card => {
      if (this.isValidCard(card)) {
        this.cards.add(card);
        this.setupCard(card);
      }
    });
  }
  
  /**
   * 验证卡片是否有效
   */
  isValidCard(card) {
    return card && 
           card.nodeType === Node.ELEMENT_NODE &&
           !card.hasAttribute('data-spotlight-disabled');
  }
  
  /**
   * 设置单个卡片
   */
  setupCard(card) {
    // 添加数据属性
    card.setAttribute('data-spotlight-enabled', 'true');
    
    // 设置初始样式
    card.style.setProperty('--mouse-x', '50%');
    card.style.setProperty('--mouse-y', '50%');
    
    // 添加性能优化属性
    card.style.willChange = 'transform, box-shadow';
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 使用事件委托优化性能
    const handleMouseMove = throttle((e) => {
      this.handleMouseMove(e);
    }, 16); // 约60fps

    const handleMouseOver = (e) => {
      const card = e.target.closest(this.config.selector);
      if (card && this.cards.has(card)) {
        // relatedTarget is the element the mouse came from.
        // We trigger mouseEnter only if the mouse came from outside the card.
        if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
          this.handleMouseEnter(card);
        }
      }
    };

    const handleMouseOut = (e) => {
      const card = e.target.closest(this.config.selector);
      if (card && this.cards.has(card)) {
        // relatedTarget is the element the mouse is going to.
        // We trigger mouseLeave only if the mouse is going outside the card.
        if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
          this.handleMouseLeave(card);
        }
      }
    };

    // 绑定到document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // 存储事件监听器以便清理
    this.eventListeners.set('mousemove', handleMouseMove);
    this.eventListeners.set('mouseover', handleMouseOver);
    this.eventListeners.set('mouseout', handleMouseOut);

    // 监听DOM变化
    this.setupMutationObserver();
  }
  
  /**
   * 处理鼠标移动 - 优化减少闪烁，修复顶部区域问题
   */
  handleMouseMove(e) {
    this.performanceMetrics.mouseMoveEvents++;
    
    const hoveredCard = e.target.closest(this.config.selector);
    if (hoveredCard && this.cards.has(hoveredCard)) {
      const rect = hoveredCard.getBoundingClientRect();
      
      // 检查鼠标是否在卡片边界内，避免边界检测问题
      const isInCard = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
      
      if (isInCard) {
        this.updateSpotlightPosition(hoveredCard, e.clientX, e.clientY);
      }
    }
  }
  
  /**
   * 更新聚光灯位置 - 优化减少闪烁，修复顶部区域问题
   */
  updateSpotlightPosition(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    
    // 边界平滑处理：避免在边界处的突然变化
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    // 添加位置变化检测，避免不必要的更新
    const currentX = parseFloat(card.style.getPropertyValue('--mouse-x')) || 50;
    const currentY = parseFloat(card.style.getPropertyValue('--mouse-y')) || 50;
    
    // 针对顶部区域优化：降低Y轴阈值，提高X轴阈值
    const yThreshold = y < 20 ? 0.3 : 0.8; // 顶部20%区域使用更敏感的阈值
    const xThreshold = 1.5; // X轴使用稍高的阈值
    
    // 只有当位置变化超过阈值时才更新，减少闪烁
    if (Math.abs(x - currentX) > xThreshold || Math.abs(y - currentY) > yThreshold) {
      // 使用requestAnimationFrame优化性能，但添加防抖
      if (this.updateTimeout) {
        cancelAnimationFrame(this.updateTimeout);
      }
      
      this.updateTimeout = requestAnimationFrame(() => {
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
        this.updateTimeout = null;
      });
    }
  }
  
  /**
   * 处理鼠标进入 - 优化减少闪烁，修复顶部区域问题
   */
  handleMouseEnter(card) {
    // 避免重复添加类名
    if (!card.classList.contains('spotlight-active')) {
      card.classList.add('spotlight-active');
    }
  }
  
  /**
   * 处理鼠标离开 - 优化减少闪烁，修复顶部区域问题
   */
  handleMouseLeave(card) {
    card.classList.remove('spotlight-active');
    
    // 立即重置到中心位置，避免延迟导致的闪烁
    if (this.updateTimeout) {
      cancelAnimationFrame(this.updateTimeout);
    }
    
    this.updateTimeout = requestAnimationFrame(() => {
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
      this.updateTimeout = null;
    });
  }
  
  /**
   * 设置MutationObserver监听DOM变化
   */
  setupMutationObserver() {
    const observer = new MutationObserver(debounce((mutations) => {
      this.handleDOMChanges(mutations);
    }, 100));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    this.mutationObserver = observer;
  }
  
  /**
   * 处理DOM变化
   */
  handleDOMChanges(mutations) {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 检查新添加的节点是否包含卡片
          const newCards = node.querySelectorAll(this.config.selector);
          newCards.forEach(card => {
            if (this.isValidCard(card) && !this.cards.has(card)) {
              this.cards.add(card);
              this.setupCard(card);
            }
          });
        }
      });
      
      // 检查移除的节点
      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const removedCards = node.querySelectorAll(this.config.selector);
          removedCards.forEach(card => {
            this.cards.delete(card);
          });
        }
      });
    });
  }
  
  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.cleanupUnusedCards();
      this.logPerformanceMetrics();
    }, 30000); // 每30秒清理一次
  }
  
  /**
   * 清理未使用的卡片
   */
  cleanupUnusedCards() {
    const now = Date.now();
    this.cards.forEach(card => {
      if (!document.body.contains(card)) {
        this.cards.delete(card);
      }
    });
    
    this.performanceMetrics.lastCleanupTime = now;
  }
  
  /**
   * 记录性能指标
   */
  logPerformanceMetrics() {
    if (process.env.NODE_ENV === 'development') {
      console.log('Card Spotlight Performance Metrics:', {
        activeCards: this.cards.size,
        mouseMoveEvents: this.performanceMetrics.mouseMoveEvents,
        lastCleanup: new Date(this.performanceMetrics.lastCleanupTime).toLocaleString()
      });
    }
  }
  
  /**
   * 销毁实例，清理资源
   */
  destroy() {
    if (!this.isActive) {
      return;
    }
    
    // 清理防闪烁定时器
    if (this.updateTimeout) {
      cancelAnimationFrame(this.updateTimeout);
      this.updateTimeout = null;
    }
    
    // 移除事件监听器
    this.eventListeners.forEach((listener, event) => {
      document.removeEventListener(event, listener);
    });
    
    // 清理MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    // 清理卡片状态
    this.cards.forEach(card => {
      card.removeAttribute('data-spotlight-enabled');
      card.classList.remove('spotlight-active');
      card.style.removeProperty('--mouse-x');
      card.style.removeProperty('--mouse-y');
    });
    
    // 重置状态
    this.cards.clear();
    this.eventListeners.clear();
    this.isActive = false;
    
    console.log('Card spotlight effect destroyed');
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.setupCSSVariables();
  }
  
  /**
   * 添加新卡片
   */
  addCard(cardElement) {
    if (this.isValidCard(cardElement) && !this.cards.has(cardElement)) {
      this.cards.add(cardElement);
      this.setupCard(cardElement);
      return true;
    }
    return false;
  }
  
  /**
   * 移除卡片
   */
  removeCard(cardElement) {
    if (this.cards.has(cardElement)) {
      this.cards.delete(cardElement);
      cardElement.removeAttribute('data-spotlight-enabled');
      cardElement.classList.remove('spotlight-active');
      cardElement.style.removeProperty('--mouse-x');
      cardElement.style.removeProperty('--mouse-y');
      return true;
    }
    return false;
  }
}

// 导出单例实例
let cardSpotlightInstance = null;

/**
 * 初始化卡片聚光灯效果
 * @param {Object} options - 配置选项
 * @returns {CardSpotlightEffect} 聚光灯效果实例
 */
export const initCardSpotlight = (options = {}) => {
  if (cardSpotlightInstance) {
    cardSpotlightInstance.updateConfig(options);
    return cardSpotlightInstance;
  }
  
  cardSpotlightInstance = new CardSpotlightEffect(options);
  return cardSpotlightInstance;
};

/**
 * 销毁卡片聚光灯效果
 */
export const destroyCardSpotlight = () => {
  if (cardSpotlightInstance) {
    cardSpotlightInstance.destroy();
    cardSpotlightInstance = null;
  }
};

/**
 * 获取当前聚光灯效果实例
 * @returns {CardSpotlightEffect|null} 当前实例
 */
export const getCardSpotlightInstance = () => {
  return cardSpotlightInstance;
};

// 默认导出
export default CardSpotlightEffect;
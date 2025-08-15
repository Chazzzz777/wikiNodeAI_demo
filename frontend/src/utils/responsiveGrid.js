/**
 * 响应式网格布局工具
 * 提供健壮的响应式布局计算和优化功能
 */

class ResponsiveGridHelper {
  constructor() {
    this.breakpoints = {
      xs: 0,
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
      xxl: 1400,
      xxxl: 1600
    };
    
    this.gridConfigs = {
      xs: { columns: 1, gutter: 16, cardWidth: 320 },
      sm: { columns: 2, gutter: 20, cardWidth: 300 },
      md: { columns: 3, gutter: 24, cardWidth: 280 },
      lg: { columns: 4, gutter: 24, cardWidth: 260 },
      xl: { columns: 5, gutter: 24, cardWidth: 240 },
      xxl: { columns: 6, gutter: 24, cardWidth: 220 },
      xxxl: { columns: 7, gutter: 24, cardWidth: 200 }
    };
    
    this.currentConfig = null;
    this.resizeObserver = null;
    this.callbacks = new Set();
    this.debounceTimer = null;
    
    // 性能监控
    this.performanceMetrics = {
      resizeCount: 0,
      lastResizeTime: 0,
      averageResizeTime: 0
    };
  }
  
  /**
   * 获取当前屏幕尺寸对应的配置
   * @returns {Object} 当前配置
   */
  getCurrentConfig() {
    const width = window.innerWidth;
    let currentBreakpoint = 'xs';
    
    // 从大到小检查断点
    const breakpointKeys = Object.keys(this.breakpoints).reverse();
    for (const key of breakpointKeys) {
      if (width >= this.breakpoints[key]) {
        currentBreakpoint = key;
        break;
      }
    }
    
    return {
      breakpoint: currentBreakpoint,
      ...this.gridConfigs[currentBreakpoint],
      screenWidth: width
    };
  }
  
  /**
   * 计算最优列数
   * @param {number} containerWidth 容器宽度
   * @param {number} minCardWidth 最小卡片宽度
   * @returns {number} 最优列数
   */
  calculateOptimalColumns(containerWidth, minCardWidth = 200) {
    const config = this.getCurrentConfig();
    const availableWidth = containerWidth - (config.columns - 1) * config.gutter;
    const maxPossibleColumns = Math.floor(availableWidth / minCardWidth);
    
    // 确保不超过配置的最大列数
    return Math.min(maxPossibleColumns, config.columns);
  }
  
  /**
   * 计算卡片宽度
   * @param {number} containerWidth 容器宽度
   * @param {number} columns 列数
   * @returns {number} 卡片宽度
   */
  calculateCardWidth(containerWidth, columns) {
    const config = this.getCurrentConfig();
    const totalGutterWidth = (columns - 1) * config.gutter;
    return (containerWidth - totalGutterWidth) / columns;
  }
  
  /**
   * 获取Ant Design List的grid配置
   * @param {Object} options 自定义选项
   * @returns {Object} grid配置
   */
  getListGridConfig(options = {}) {
    const config = this.getCurrentConfig();
    const containerWidth = options.containerWidth || window.innerWidth;
    const minCardWidth = options.minCardWidth || 200;
    
    // 计算最优列数
    const optimalColumns = this.calculateOptimalColumns(containerWidth, minCardWidth);
    
    return {
      gutter: config.gutter,
      xs: 1,
      sm: 2,
      md: Math.min(3, optimalColumns),
      lg: Math.min(4, optimalColumns),
      xl: Math.min(5, optimalColumns),
      xxl: Math.min(6, optimalColumns),
      getColumnStyle: (width, columnCount) => ({
        minWidth: `${100 / columnCount}%`,
        maxWidth: `${100 / columnCount}%`,
        flex: `0 0 ${100 / columnCount}%`
      })
    };
  }
  
  /**
   * 防抖函数
   * @param {Function} func 要防抖的函数
   * @param {number} wait 等待时间
   * @returns {Function} 防抖后的函数
   */
  debounce(func, wait = 100) {
    return (...args) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  /**
   * 监听屏幕尺寸变化
   * @param {Function} callback 回调函数
   */
  observeResize(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
    
    if (this.resizeObserver) return;
    
    const handleResize = this.debounce(() => {
      const startTime = performance.now();
      const newConfig = this.getCurrentConfig();
      
      // 更新性能指标
      this.performanceMetrics.resizeCount++;
      const resizeTime = performance.now() - startTime;
      this.performanceMetrics.lastResizeTime = resizeTime;
      this.performanceMetrics.averageResizeTime = 
        (this.performanceMetrics.averageResizeTime * (this.performanceMetrics.resizeCount - 1) + resizeTime) / 
        this.performanceMetrics.resizeCount;
      
      // 检查配置是否发生变化
      if (!this.currentConfig || this.currentConfig.breakpoint !== newConfig.breakpoint) {
        this.currentConfig = newConfig;
        
        // 通知所有回调
        this.callbacks.forEach(cb => {
          try {
            cb(newConfig);
          } catch (error) {
            console.error('ResponsiveGrid callback error:', error);
          }
        });
      }
    }, 150); // 150ms防抖延迟
    
    // 使用ResizeObserver监听容器变化
    this.resizeObserver = new ResizeObserver(handleResize);
    this.resizeObserver.observe(document.body);
    
    // 同时监听window resize作为后备
    window.addEventListener('resize', handleResize);
    
    // 初始化配置
    this.currentConfig = this.getCurrentConfig();
  }
  
  /**
   * 停止监听
   */
  unobserveResize() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    window.removeEventListener('resize', this.debounce);
    this.callbacks.clear();
  }
  
  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  
  /**
   * 重置性能指标
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      resizeCount: 0,
      lastResizeTime: 0,
      averageResizeTime: 0
    };
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    this.unobserveResize();
    clearTimeout(this.debounceTimer);
    this.callbacks.clear();
  }
}

// 创建单例实例
let responsiveGridInstance = null;

/**
 * 获取ResponsiveGrid实例
 * @returns {ResponsiveGridHelper} 实例
 */
export function getResponsiveGrid() {
  if (!responsiveGridInstance) {
    responsiveGridInstance = new ResponsiveGridHelper();
  }
  return responsiveGridInstance;
}

/**
 * 初始化响应式网格
 * @param {Object} options 配置选项
 * @returns {ResponsiveGridHelper} 实例
 */
export function initResponsiveGrid(options = {}) {
  const instance = getResponsiveGrid();
  
  // 合并自定义配置
  if (options.breakpoints) {
    instance.breakpoints = { ...instance.breakpoints, ...options.breakpoints };
  }
  
  if (options.gridConfigs) {
    instance.gridConfigs = { ...instance.gridConfigs, ...options.gridConfigs };
  }
  
  return instance;
}

/**
 * 销毁响应式网格实例
 */
export function destroyResponsiveGrid() {
  if (responsiveGridInstance) {
    responsiveGridInstance.destroy();
    responsiveGridInstance = null;
  }
}

export default ResponsiveGridHelper;
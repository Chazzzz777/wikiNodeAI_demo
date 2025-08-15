/**
 * 动画性能监控工具类
 * 从项目健壮性和可扩展性的角度优化性能监控
 */

/**
 * 性能指标类型
 */
export const PERFORMANCE_METRICS = {
  FPS: 'fps',
  MEMORY: 'memory',
  CPU: 'cpu',
  NETWORK: 'network',
  ANIMATION: 'animation'
};

/**
 * 性能级别定义
 */
export const PERFORMANCE_LEVELS = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  CRITICAL: 'critical'
};

/**
 * 性能监控配置
 */
const MONITORING_CONFIG = {
  samplingInterval: 1000, // 采样间隔（毫秒）
  reportInterval: 30000, // 报告间隔（毫秒）
  maxSamples: 60, // 最大样本数
  fpsThreshold: {
    excellent: 55,
    good: 45,
    fair: 30,
    poor: 15
  },
  memoryThreshold: {
    excellent: 0.5, // 50%
    good: 0.7, // 70%
    fair: 0.85, // 85%
    poor: 0.95 // 95%
  }
};

/**
 * 性能监控管理器
 */
class PerformanceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.samples = {
      fps: [],
      memory: [],
      timing: []
    };
    this.observers = new Set();
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.monitoringInterval = null;
    this.reportingInterval = null;
    this.callbacks = new Map();
    this.init();
  }

  /**
   * 初始化性能监控
   */
  init() {
    // 检查浏览器API支持
    this.checkBrowserSupport();
    
    // 设置性能观察者
    this.setupPerformanceObserver();
    
    // 设置内存监控
    this.setupMemoryMonitoring();
    
    // 设置FPS监控
    this.setupFPSMonitoring();
  }

  /**
   * 检查浏览器API支持
   */
  checkBrowserSupport() {
    this.supportedFeatures = {
      performanceObserver: 'PerformanceObserver' in window,
      performanceMemory: 'memory' in performance,
      requestAnimationFrame: 'requestAnimationFrame' in window,
      navigationTiming: 'performance' in window && 'timing' in performance
    };
    
    console.log('Performance monitoring browser support:', this.supportedFeatures);
  }

  /**
   * 设置性能观察者
   */
  setupPerformanceObserver() {
    if (!this.supportedFeatures.performanceObserver) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      // 监控长任务
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.handleLongTask(entry);
        });
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      
      // 监控布局变化
      const layoutObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.handleLayoutShift(entry);
        });
      });
      
      layoutObserver.observe({ entryTypes: ['layout-shift'] });
      
    } catch (error) {
      console.error('Error setting up performance observers:', error);
    }
  }

  /**
   * 设置内存监控
   */
  setupMemoryMonitoring() {
    if (!this.supportedFeatures.performanceMemory) {
      console.warn('Performance memory API not supported');
      return;
    }

    const checkMemory = () => {
      const memory = performance.memory;
      const usedHeap = memory.usedJSHeapSize;
      const totalHeap = memory.totalJSHeapSize;
      const limitHeap = memory.jsHeapSizeLimit;
      
      const memoryUsage = {
        used: usedHeap,
        total: totalHeap,
        limit: limitHeap,
        percentage: usedHeap / limitHeap,
        timestamp: Date.now()
      };
      
      this.addSample('memory', memoryUsage);
      
      // 检查内存使用率
      if (memoryUsage.percentage > MONITORING_CONFIG.memoryThreshold.poor) {
        this.handlePerformanceIssue('memory', {
          level: PERFORMANCE_LEVELS.CRITICAL,
          usage: memoryUsage,
          message: 'High memory usage detected'
        });
      }
    };

    // 每秒检查一次内存
    this.memoryInterval = setInterval(checkMemory, 1000);
  }

  /**
   * 设置FPS监控
   */
  setupFPSMonitoring() {
    if (!this.supportedFeatures.requestAnimationFrame) {
      console.warn('requestAnimationFrame not supported');
      return;
    }

    const calculateFPS = (currentTime) => {
      this.frameCount++;
      
      const deltaTime = currentTime - this.lastFrameTime;
      
      if (deltaTime >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / deltaTime);
        
        this.addSample('fps', {
          value: fps,
          timestamp: Date.now()
        });
        
        // 检查FPS
        if (fps < MONITORING_CONFIG.fpsThreshold.poor) {
          this.handlePerformanceIssue('fps', {
            level: PERFORMANCE_LEVELS.CRITICAL,
            fps: fps,
            message: 'Low FPS detected'
          });
        }
        
        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }
      
      if (this.isMonitoring) {
        requestAnimationFrame(calculateFPS);
      }
    };

    this.fpsCallback = calculateFPS;
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // 开始FPS监控
    requestAnimationFrame(this.fpsCallback);
    
    // 设置定期报告
    this.reportingInterval = setInterval(() => {
      this.generateReport();
    }, MONITORING_CONFIG.reportInterval);
    
    console.log('Performance monitoring started');
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    // 停止内存监控
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    // 停止定期报告
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    console.log('Performance monitoring stopped');
  }

  /**
   * 添加样本
   * @param {string} type 样本类型
   * @param {Object} data 样本数据
   */
  addSample(type, data) {
    if (!this.samples[type]) {
      this.samples[type] = [];
    }
    
    this.samples[type].push({
      ...data,
      timestamp: Date.now()
    });
    
    // 限制样本数量
    if (this.samples[type].length > MONITORING_CONFIG.maxSamples) {
      this.samples[type] = this.samples[type].slice(-MONITORING_CONFIG.maxSamples);
    }
  }

  /**
   * 处理长任务
   * @param {PerformanceEntry} entry 性能条目
   */
  handleLongTask(entry) {
    const duration = entry.duration;
    
    if (duration > 100) { // 超过100ms的任务认为是长任务
      this.handlePerformanceIssue('longtask', {
        level: PERFORMANCE_LEVELS.POOR,
        duration: duration,
        message: 'Long task detected',
        startTime: entry.startTime
      });
    }
  }

  /**
   * 处理布局变化
   * @param {PerformanceEntry} entry 性能条目
   */
  handleLayoutShift(entry) {
    const value = entry.value;
    
    if (value > 0.1) { // 布局变化值大于0.1
      this.handlePerformanceIssue('layout', {
        level: PERFORMANCE_LEVELS.FAIR,
        value: value,
        message: 'Significant layout shift detected'
      });
    }
  }

  /**
   * 处理性能问题
   * @param {string} type 问题类型
   * @param {Object} details 问题详情
   */
  handlePerformanceIssue(type, details) {
    const issue = {
      type,
      ...details,
      timestamp: Date.now()
    };
    
    console.warn('Performance issue detected:', issue);
    
    // 通知观察者
    this.observers.forEach(callback => {
      try {
        callback(issue);
      } catch (error) {
        console.error('Error in performance observer callback:', error);
      }
    });
  }

  /**
   * 添加观察者
   * @param {Function} callback 回调函数
   */
  addObserver(callback) {
    this.observers.add(callback);
  }

  /**
   * 移除观察者
   * @param {Function} callback 回调函数
   */
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  /**
   * 生成性能报告
   * @returns {Object} 性能报告
   */
  generateReport() {
    const report = {
      timestamp: Date.now(),
      summary: this.generateSummary(),
      details: {
        fps: this.analyzeFPS(),
        memory: this.analyzeMemory(),
        system: this.getSystemInfo()
      }
    };
    
    console.log('Performance report:', report);
    
    return report;
  }

  /**
   * 生成性能摘要
   * @returns {Object} 性能摘要
   */
  generateSummary() {
    const fpsAnalysis = this.analyzeFPS();
    const memoryAnalysis = this.analyzeMemory();
    
    // 确定整体性能级别
    let overallLevel = PERFORMANCE_LEVELS.EXCELLENT;
    
    if (fpsAnalysis.level === PERFORMANCE_LEVELS.CRITICAL || 
        memoryAnalysis.level === PERFORMANCE_LEVELS.CRITICAL) {
      overallLevel = PERFORMANCE_LEVELS.CRITICAL;
    } else if (fpsAnalysis.level === PERFORMANCE_LEVELS.POOR || 
               memoryAnalysis.level === PERFORMANCE_LEVELS.POOR) {
      overallLevel = PERFORMANCE_LEVELS.POOR;
    } else if (fpsAnalysis.level === PERFORMANCE_LEVELS.FAIR || 
               memoryAnalysis.level === PERFORMANCE_LEVELS.FAIR) {
      overallLevel = PERFORMANCE_LEVELS.FAIR;
    } else if (fpsAnalysis.level === PERFORMANCE_LEVELS.GOOD || 
               memoryAnalysis.level === PERFORMANCE_LEVELS.GOOD) {
      overallLevel = PERFORMANCE_LEVELS.GOOD;
    }
    
    return {
      level: overallLevel,
      fps: fpsAnalysis,
      memory: memoryAnalysis,
      timestamp: Date.now()
    };
  }

  /**
   * 分析FPS数据
   * @returns {Object} FPS分析结果
   */
  analyzeFPS() {
    const fpsSamples = this.samples.fps;
    
    if (fpsSamples.length === 0) {
      return {
        level: PERFORMANCE_LEVELS.GOOD,
        average: 0,
        min: 0,
        max: 0,
        samples: 0
      };
    }
    
    const values = fpsSamples.map(s => s.value);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    let level = PERFORMANCE_LEVELS.EXCELLENT;
    
    if (average < MONITORING_CONFIG.fpsThreshold.poor) {
      level = PERFORMANCE_LEVELS.CRITICAL;
    } else if (average < MONITORING_CONFIG.fpsThreshold.fair) {
      level = PERFORMANCE_LEVELS.POOR;
    } else if (average < MONITORING_CONFIG.fpsThreshold.good) {
      level = PERFORMANCE_LEVELS.FAIR;
    } else if (average < MONITORING_CONFIG.fpsThreshold.excellent) {
      level = PERFORMANCE_LEVELS.GOOD;
    }
    
    return {
      level,
      average: Math.round(average * 100) / 100,
      min,
      max,
      samples: fpsSamples.length
    };
  }

  /**
   * 分析内存数据
   * @returns {Object} 内存分析结果
   */
  analyzeMemory() {
    const memorySamples = this.samples.memory;
    
    if (memorySamples.length === 0) {
      return {
        level: PERFORMANCE_LEVELS.GOOD,
        averagePercentage: 0,
        currentUsage: 0,
        samples: 0
      };
    }
    
    const percentages = memorySamples.map(s => s.percentage);
    const averagePercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const currentUsage = memorySamples[memorySamples.length - 1];
    
    let level = PERFORMANCE_LEVELS.EXCELLENT;
    
    if (averagePercentage > MONITORING_CONFIG.memoryThreshold.poor) {
      level = PERFORMANCE_LEVELS.CRITICAL;
    } else if (averagePercentage > MONITORING_CONFIG.memoryThreshold.fair) {
      level = PERFORMANCE_LEVELS.POOR;
    } else if (averagePercentage > MONITORING_CONFIG.memoryThreshold.good) {
      level = PERFORMANCE_LEVELS.FAIR;
    } else if (averagePercentage > MONITORING_CONFIG.memoryThreshold.excellent) {
      level = PERFORMANCE_LEVELS.GOOD;
    }
    
    return {
      level,
      averagePercentage: Math.round(averagePercentage * 10000) / 100,
      currentUsage: {
        used: Math.round(currentUsage.used / 1024 / 1024), // MB
        total: Math.round(currentUsage.total / 1024 / 1024), // MB
        limit: Math.round(currentUsage.limit / 1024 / 1024) // MB
      },
      samples: memorySamples.length
    };
  }

  /**
   * 获取系统信息
   * @returns {Object} 系统信息
   */
  getSystemInfo() {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };
    
    // 添加设备内存信息
    if ('deviceMemory' in navigator) {
      info.deviceMemory = navigator.deviceMemory;
    }
    
    // 添加硬件并发数
    if ('hardwareConcurrency' in navigator) {
      info.hardwareConcurrency = navigator.hardwareConcurrency;
    }
    
    // 添加网络连接信息
    if ('connection' in navigator) {
      info.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }
    
    // 添加电池信息
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        info.battery = {
          level: battery.level,
          charging: battery.charging
        };
      });
    }
    
    return info;
  }

  /**
   * 获取当前样本数据
   * @returns {Object} 样本数据
   */
  getCurrentSamples() {
    return {
      fps: [...this.samples.fps],
      memory: [...this.samples.memory],
      timing: [...this.samples.timing]
    };
  }

  /**
   * 清理样本数据
   */
  clearSamples() {
    this.samples = {
      fps: [],
      memory: [],
      timing: []
    };
  }

  /**
   * 销毁性能监控
   */
  destroy() {
    this.stopMonitoring();
    this.observers.clear();
    this.clearSamples();
    this.callbacks.clear();
  }
}

/**
 * 创建全局性能监控实例
 */
let performanceMonitorInstance = null;

/**
 * 获取性能监控实例
 * @returns {PerformanceMonitor} 性能监控实例
 */
export function getPerformanceMonitor() {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

/**
 * 重置性能监控实例
 * 主要用于测试
 */
export function resetPerformanceMonitor() {
  if (performanceMonitorInstance) {
    performanceMonitorInstance.destroy();
    performanceMonitorInstance = null;
  }
}

export default {
  getPerformanceMonitor,
  resetPerformanceMonitor,
  PERFORMANCE_METRICS,
  PERFORMANCE_LEVELS
};
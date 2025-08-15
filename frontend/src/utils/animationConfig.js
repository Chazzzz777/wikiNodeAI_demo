/**
 * 动画配置工具类
 * 从项目健壮性和可扩展性的角度优化动画管理
 */

/**
 * 动画配置枚举
 * 定义所有可用的动画类型及其参数
 */
export const ANIMATION_TYPES = {
  GRADIENT_FLOW: {
    name: 'gradientFlow',
    duration: '12s',
    timingFunction: 'linear',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
    playState: 'running',
    description: '持续斜向流动渐变动画'
  },
  GRADIENT_SHADOW_FLOW: {
    name: 'gradientShadowFlow',
    duration: '8s',
    timingFunction: 'linear',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
    playState: 'running',
    description: '斜向渐变阴影循环运动动画'
  },
  HOVER_SCALE: {
    name: 'hoverScale',
    duration: '0.3s',
    timingFunction: 'ease',
    iterationCount: '1',
    direction: 'normal',
    fillMode: 'forwards',
    playState: 'running',
    description: '悬停时缩放动画'
  },
  FADE_IN: {
    name: 'fadeIn',
    duration: '0.5s',
    timingFunction: 'ease-in',
    iterationCount: '1',
    direction: 'normal',
    fillMode: 'forwards',
    playState: 'running',
    description: '淡入动画'
  }
};

/**
 * 动画性能配置
 * 定义不同性能要求下的动画参数
 */
export const PERFORMANCE_LEVELS = {
  HIGH: {
    enabled: true,
    reducedMotion: false,
    gpuAcceleration: true,
    willChange: true
  },
  MEDIUM: {
    enabled: true,
    reducedMotion: false,
    gpuAcceleration: true,
    willChange: false
  },
  LOW: {
    enabled: true,
    reducedMotion: true,
    gpuAcceleration: false,
    willChange: false
  },
  MINIMAL: {
    enabled: false,
    reducedMotion: true,
    gpuAcceleration: false,
    willChange: false
  }
};

/**
 * 动画配置管理器
 */
class AnimationConfigManager {
  constructor() {
    this.currentPerformanceLevel = this.detectPerformanceLevel();
    this.animationCache = new Map();
    this.observerCallbacks = new Set();
    this.init();
  }

  /**
   * 初始化动画配置管理器
   */
  init() {
    // 监听系统动画偏好设置变化
    if (window.matchMedia) {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', this.handleMotionPreferenceChange.bind(this));
    }

    // 监听网络状态变化
    if (navigator.connection) {
      navigator.connection.addEventListener('change', this.handleNetworkChange.bind(this));
    }

    // 监听设备内存变化
    if ('deviceMemory' in navigator) {
      this.handleDeviceMemoryChange();
    }
  }

  /**
   * 检测当前性能水平
   * @returns {string} 性能水平
   */
  detectPerformanceLevel() {
    // 检查用户动画偏好
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'LOW';
    }

    // 检查网络状态
    if (navigator.connection) {
      const connection = navigator.connection;
      if (connection.saveData || connection.effectiveType.includes('2g')) {
        return 'LOW';
      }
      if (connection.effectiveType.includes('3g')) {
        return 'MEDIUM';
      }
    }

    // 检查设备内存
    if ('deviceMemory' in navigator) {
      const memory = navigator.deviceMemory;
      if (memory < 2) return 'LOW';
      if (memory < 4) return 'MEDIUM';
    }

    // 检查硬件并发数
    if ('hardwareConcurrency' in navigator) {
      const cores = navigator.hardwareConcurrency;
      if (cores < 2) return 'LOW';
      if (cores < 4) return 'MEDIUM';
    }

    return 'HIGH';
  }

  /**
   * 处理动画偏好设置变化
   * @param {MediaQueryListEvent} event
   */
  handleMotionPreferenceChange(event) {
    const newLevel = event.matches ? 'LOW' : this.detectPerformanceLevel();
    this.setPerformanceLevel(newLevel);
  }

  /**
   * 处理网络状态变化
   */
  handleNetworkChange() {
    const newLevel = this.detectPerformanceLevel();
    this.setPerformanceLevel(newLevel);
  }

  /**
   * 处理设备内存变化
   */
  handleDeviceMemoryChange() {
    const newLevel = this.detectPerformanceLevel();
    this.setPerformanceLevel(newLevel);
  }

  /**
   * 设置性能水平
   * @param {string} level 性能水平
   */
  setPerformanceLevel(level) {
    if (this.currentPerformanceLevel !== level) {
      this.currentPerformanceLevel = level;
      this.notifyObservers();
      console.log(`Animation performance level changed to: ${level}`);
    }
  }

  /**
   * 获取当前性能配置
   * @returns {Object} 性能配置
   */
  getCurrentPerformanceConfig() {
    return PERFORMANCE_LEVELS[this.currentPerformanceLevel];
  }

  /**
   * 获取动画配置
   * @param {string} animationType 动画类型
   * @returns {Object|null} 动画配置
   */
  getAnimationConfig(animationType) {
    const config = ANIMATION_TYPES[animationType];
    if (!config) {
      console.warn(`Animation type "${animationType}" not found`);
      return null;
    }

    const performanceConfig = this.getCurrentPerformanceConfig();
    
    // 如果动画被禁用，返回null
    if (!performanceConfig.enabled) {
      return null;
    }

    // 如果启用减少动画，调整动画参数
    if (performanceConfig.reducedMotion) {
      return {
        ...config,
        duration: '0.01ms',
        iterationCount: '1'
      };
    }

    return config;
  }

  /**
   * 生成动画CSS字符串
   * @param {string} animationType 动画类型
   * @returns {string} CSS动画字符串
   */
  generateAnimationString(animationType) {
    const config = this.getAnimationConfig(animationType);
    if (!config) {
      return 'none';
    }

    const {
      name,
      duration,
      timingFunction,
      iterationCount,
      direction,
      fillMode,
      playState
    } = config;

    return `${name} ${duration} ${timingFunction} ${iterationCount} ${direction} ${fillMode} ${playState}`.trim();
  }

  /**
   * 添加观察者回调
   * @param {Function} callback 回调函数
   */
  addObserver(callback) {
    this.observerCallbacks.add(callback);
  }

  /**
   * 移除观察者回调
   * @param {Function} callback 回调函数
   */
  removeObserver(callback) {
    this.observerCallbacks.delete(callback);
  }

  /**
   * 通知所有观察者
   */
  notifyObservers() {
    this.observerCallbacks.forEach(callback => {
      try {
        callback(this.currentPerformanceLevel, this.getCurrentPerformanceConfig());
      } catch (error) {
        console.error('Error in animation observer callback:', error);
      }
    });
  }

  /**
   * 获取性能统计信息
   * @returns {Object} 性能统计信息
   */
  getPerformanceStats() {
    return {
      currentLevel: this.currentPerformanceLevel,
      config: this.getCurrentPerformanceConfig(),
      deviceInfo: {
        deviceMemory: navigator.deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          saveData: navigator.connection.saveData
        } : 'unknown'
      },
      preferences: {
        reducedMotion: window.matchMedia ? 
          window.matchMedia('(prefers-reduced-motion: reduce)').matches : 'unknown'
      }
    };
  }

  /**
   * 销毁动画配置管理器
   */
  destroy() {
    this.observerCallbacks.clear();
    this.animationCache.clear();
  }
}

/**
 * 创建全局动画配置管理器实例
 */
let animationManagerInstance = null;

/**
 * 获取动画配置管理器实例
 * @returns {AnimationConfigManager} 动画配置管理器实例
 */
export function getAnimationManager() {
  if (!animationManagerInstance) {
    animationManagerInstance = new AnimationConfigManager();
  }
  return animationManagerInstance;
}

/**
 * 重置动画配置管理器实例
 * 主要用于测试
 */
export function resetAnimationManager() {
  if (animationManagerInstance) {
    animationManagerInstance.destroy();
    animationManagerInstance = null;
  }
}

/**
 * 便捷函数：获取渐变流动动画字符串
 * @returns {string} CSS动画字符串
 */
export function getGradientFlowAnimation() {
  const manager = getAnimationManager();
  return manager.generateAnimationString('GRADIENT_SHADOW_FLOW');
}

/**
 * 便捷函数：获取悬停缩放动画字符串
 * @returns {string} CSS动画字符串
 */
export function getHoverScaleAnimation() {
  const manager = getAnimationManager();
  return manager.generateAnimationString('HOVER_SCALE');
}

/**
 * 便捷函数：获取淡入动画字符串
 * @returns {string} CSS动画字符串
 */
export function getFadeInAnimation() {
  const manager = getAnimationManager();
  return manager.generateAnimationString('FADE_IN');
}

/**
 * 便捷函数：检查动画是否启用
 * @returns {boolean} 动画是否启用
 */
export function isAnimationEnabled() {
  const manager = getAnimationManager();
  return manager.getCurrentPerformanceConfig().enabled;
}

/**
 * 便捷函数：检查是否启用减少动画
 * @returns {boolean} 是否启用减少动画
 */
export function isReducedMotionEnabled() {
  const manager = getAnimationManager();
  return manager.getCurrentPerformanceConfig().reducedMotion;
}

export default {
  getAnimationManager,
  resetAnimationManager,
  getGradientFlowAnimation,
  getHoverScaleAnimation,
  getFadeInAnimation,
  isAnimationEnabled,
  isReducedMotionEnabled,
  ANIMATION_TYPES,
  PERFORMANCE_LEVELS
};
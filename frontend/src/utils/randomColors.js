/**
 * 随机深色系哑光渐变颜色生成工具
 * 提供多种深色系配色方案，用于卡片封面背景
 */

// 深色系哑光配色方案
const DARK_COLOR_PALETTES = [
  {
    name: 'deep-purple',
    colors: ['#2D1B69', '#1A0E3D']
  },
  {
    name: 'midnight-blue',
    colors: ['#1A237E', '#0D1642']
  },
  {
    name: 'forest-green',
    colors: ['#1B5E20', '#0F3A14']
  },
  {
    name: 'ocean-depth',
    colors: ['#01579B', '#003366']
  },
  {
    name: 'burgundy',
    colors: ['#4A148C', '#2C0A52']
  },
  {
    name: 'charcoal',
    colors: ['#263238', '#11171A']
  },
  {
    name: 'deep-teal',
    colors: ['#00695C', '#003D35']
  },
  {
    name: 'royal-indigo',
    colors: ['#283593', '#151E6F']
  },
  {
    name: 'emerald-green',
    colors: ['#2E7D32', '#1B4F1F']
  },
  {
    name: 'sapphire-blue',
    colors: ['#1565C0', '#0A3D7A']
  },
  {
    name: 'dark-ruby',
    colors: ['#880E4F', '#4A0E2A']
  },
  {
    name: 'slate-gray',
    colors: ['#37474F', '#1C2327']
  }
];

/**
 * 生成随机深色系渐变背景
 * @param {string} seed 可选的种子值，用于确定性的随机颜色
 * @returns {Object} 包含渐变CSS和颜色信息的对象
 */
export function generateRandomDarkGradient(seed = null) {
  let palette;
  
  if (seed !== null) {
    // 使用种子值确定性地选择调色板
    const seedValue = typeof seed === 'string' ? 
      seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 
      seed;
    const index = seedValue % DARK_COLOR_PALETTES.length;
    palette = DARK_COLOR_PALETTES[index];
  } else {
    // 完全随机选择
    palette = DARK_COLOR_PALETTES[Math.floor(Math.random() * DARK_COLOR_PALETTES.length)];
  }
  
  const [color1, color2] = palette.colors;
  
  // 生成CSS渐变
  const gradientCSS = `linear-gradient(315deg, ${color1} 0%, ${color2} 100%)`;
  
  // 生成哑光效果的叠加层
  const matteOverlay = 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), transparent 70%)';
  
  return {
    gradient: gradientCSS,
    overlay: matteOverlay,
    primaryColor: color1,
    secondaryColor: color2,
    paletteName: palette.name,
    css: {
      background: gradientCSS,
      position: 'relative',
      overflow: 'hidden'
    },
    // 生成完整的CSS样式字符串
    fullCSS: `
      background: ${gradientCSS};
      position: relative;
      overflow: hidden;
    `
  };
}

/**
 * 为卡片生成随机颜色
 * @param {string} cardId 卡片的唯一标识符
 * @returns {Object} 颜色配置对象
 */
export function generateCardColor(cardId) {
  return generateRandomDarkGradient(cardId);
}

/**
 * 获取所有可用的调色板名称
 * @returns {Array<string>} 调色板名称数组
 */
export function getAvailablePaletteNames() {
  return DARK_COLOR_PALETTES.map(palette => palette.name);
}

/**
 * 根据名称获取特定的调色板
 * @param {string} name 调色板名称
 * @returns {Object|null} 调色板对象或null
 */
export function getPaletteByName(name) {
  return DARK_COLOR_PALETTES.find(palette => palette.name === name) || null;
}

/**
 * 预生成一组颜色，确保在列表中颜色分布均匀
 * @param {number} count 需要生成的颜色数量
 * @returns {Array<Object>} 颜色配置数组
 */
export function generateDistributedColors(count) {
  const colors = [];
  const paletteCount = DARK_COLOR_PALETTES.length;
  
  for (let i = 0; i < count; i++) {
    // 使用索引确保颜色分布均匀
    const paletteIndex = i % paletteCount;
    const palette = DARK_COLOR_PALETTES[paletteIndex];
    const [color1, color2] = palette.colors;
    
    colors.push({
      gradient: `linear-gradient(315deg, ${color1} 0%, ${color2} 100%)`,
      primaryColor: color1,
      secondaryColor: color2,
      paletteName: palette.name
    });
  }
  
  return colors;
}

export default {
  generateRandomDarkGradient,
  generateCardColor,
  getAvailablePaletteNames,
  getPaletteByName,
  generateDistributedColors
};
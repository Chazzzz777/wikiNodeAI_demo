import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import llmApiClient, { handleStreamResponse } from '../utils/llmApiClient';
import { Tree, Spin, Layout, Typography, Button, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { flushSync } from 'react-dom';
import AiAnalysisModal from '../components/AiAnalysisModal';
import DocAnalysisModal from '../components/DocAnalysisModal';
import DocImportAnalysisModal from '../components/DocImportAnalysisModal';
import './WikiDetail.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const WikiDetail = () => {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  // 三个AI功能模态窗的可见性状态
  const [modalVisible, setModalVisible] = useState(false);
  const [docAnalysisModalVisible, setDocAnalysisModalVisible] = useState(false);
  const [docImportModalVisible, setDocImportModalVisible] = useState(false);
  
  // 知识库AI诊断的独立状态管理
  const [wikiAnalysisState, setWikiAnalysisState] = useState({
    result: '',
    reasoningContent: '',
    isReasoningDone: false,
    isLoading: false,
    suggestions: [],
    hasAnalysis: false,
    isFetchingFullNavigation: false,
    fullNavigationNodeCount: 0
  });
  
  // 当前文档AI诊断的独立状态管理
  const [docAnalysisState, setDocAnalysisState] = useState({
    result: '',
    reasoningContent: '',
    isReasoningDone: false,
    isLoading: false
  });
  
  // 状态：跟踪已展开的节点
  const [expandedNodes, setExpandedNodes] = useState([]);
  
  // 文档导入AI评估的独立状态管理
  const [docImportAnalysisState, setDocImportAnalysisState] = useState({
    result: '',
    reasoningContent: '',
    isReasoningDone: false,
    isLoading: false,
    suggestions: [],
    hasAnalysis: false,
    isFetchingFullNavigation: false,
    fullNavigationNodeCount: 0
  });
  // State for full navigation export
  const [exporting, setExporting] = useState(false);
  const [exportedCount, setExportedCount] = useState(0);
  // State for exported data and filename
  const [exportedData, setExportedData] = useState(null);
  const [exportedFilename, setExportedFilename] = useState('');
  // State for space name
  const [spaceName, setSpaceName] = useState('知识库');
  // State for tracking if export button should force refresh cache
  const [shouldForceRefreshExport, setShouldForceRefreshExport] = useState(false);
  
  // 全局全量导航数据缓存状态
  const [fullNavigationCache, setFullNavigationCache] = useState({
    data: null,
    isLoading: false,
    lastUpdated: null,
    error: null,
    requestCount: 0,
    nodeCount: 0
  });

  // Function to get space name by spaceId
  const getSpaceName = async (spaceId) => {
    const userAccessToken = localStorage.getItem('user_access_token');
    if (!userAccessToken) {
      throw new Error('User Access Token not found');
    }

    try {
      const response = await apiClient.get('/api/wiki/spaces', {
        headers: { 'Authorization': `Bearer ${userAccessToken}` },
        params: { page_size: 50 }
      });
      
      const space = response.data.items.find(item => item.space_id === spaceId);
      return space ? space.name : '知识库';
    } catch (error) {
      console.error('Error fetching space name:', error);
      return '知识库';
    }
  };

  // Function to download markdown file
  const downloadMarkdownFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Function to handle manual download
  const handleManualDownload = () => {
    if (exportedData && exportedFilename) {
      const markdownContent = formatNodesToMarkdown(exportedData);
      downloadMarkdownFile(markdownContent, exportedFilename);
      // 下载后不重置导出状态，保持已导出节点数量模块的显示
      // 只有用户再次点击获取全量导航按钮时才会重置状态
    }
  };

  // Function to reset export state
  const resetExportState = () => {
    setExportedData(null);
    setExportedFilename('');
    setExportedCount(0);
    setShouldForceRefreshExport(false); // 重置强制刷新状态
  };

  // 统一的全量导航数据获取函数（支持缓存机制）
  const getFullNavigationData = useCallback(async (options = {}) => {
    const { forceRefresh = false, onProgress, source = 'unknown' } = options;
    
    // 记录请求来源，用于调试
    console.log(`[全量导航缓存] 请求来源: ${source}, 强制刷新: ${forceRefresh}`);
    
    // 检查缓存是否有效（缓存有效期5分钟）
    const now = Date.now();
    const cacheAge = fullNavigationCache.lastUpdated ? now - fullNavigationCache.lastUpdated : Infinity;
    const isCacheValid = fullNavigationCache.data && !forceRefresh && cacheAge < 5 * 60 * 1000;
    
    if (isCacheValid) {
      console.log(`[全量导航缓存] 使用缓存数据，节点数量: ${fullNavigationCache.nodeCount}, 缓存时间: ${new Date(fullNavigationCache.lastUpdated).toLocaleTimeString()}`);
      return fullNavigationCache.data;
    }
    
    // 如果正在加载中，返回当前的数据（如果有）
    if (fullNavigationCache.isLoading && fullNavigationCache.data) {
      console.log(`[全量导航缓存] 正在加载中，返回现有缓存数据`);
      return fullNavigationCache.data;
    }
    
    // 更新缓存状态为加载中
    setFullNavigationCache(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      requestCount: prev.requestCount + 1
    }));
    
    // 根据source更新对应的状态管理
    if (source === '知识库AI诊断') {
      setWikiAnalysisState(prev => ({
        ...prev,
        isFetchingFullNavigation: true,
        fullNavigationNodeCount: 0
      }));
    } else if (source === '文档导入AI评估') {
      setDocImportAnalysisState(prev => ({
        ...prev,
        isFetchingFullNavigation: true,
        fullNavigationNodeCount: 0
      }));
    } else if (source === '获取全量导航按钮') {
      setExporting(true);
      setExportedCount(0);
    }
    
    try {
      const userAccessToken = localStorage.getItem('user_access_token');
      if (!userAccessToken) {
        throw new Error('请先登录以获取 User Access Token');
      }
      
      console.log(`[全量导航缓存] 开始获取全量导航数据...`);
      
      let cumulativeCount = 0; // 将cumulativeCount移到Promise外部
      
      const allNodes = await new Promise((resolve, reject) => {
        let isConnectionClosed = false;
        let receivedData = null;
        
        const eventSource = new EventSource(`${apiClient.defaults.baseURL}/api/wiki/${spaceId}/nodes/all/stream?token=${encodeURIComponent(userAccessToken)}`);
        
        const handleMessage = async (event) => {
          try {
            if (!event.data) {
              return;
            }
            
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
              cumulativeCount += data.count;
              
              // 更新缓存的节点计数
              setFullNavigationCache(prev => ({
                ...prev,
                nodeCount: cumulativeCount
              }));
              
              // 更新对应的状态管理
              if (source === '知识库AI诊断') {
                setWikiAnalysisState(prev => ({
                  ...prev,
                  fullNavigationNodeCount: cumulativeCount
                }));
              } else if (source === '文档导入AI评估') {
                setDocImportAnalysisState(prev => ({
                  ...prev,
                  fullNavigationNodeCount: cumulativeCount
                }));
              } else if (source === '获取全量导航按钮') {
                setExportedCount(cumulativeCount);
              }
              
              // 调用进度回调
              if (onProgress) {
                onProgress(cumulativeCount);
              }
            } else if (data.type === 'result') {
              receivedData = data.data;
              isConnectionClosed = true;
              eventSource.removeEventListener('message', handleMessage);
              eventSource.removeEventListener('error', handleError);
              eventSource.close();
              
              // 重置对应的状态管理
              if (source === '知识库AI诊断') {
                setWikiAnalysisState(prev => ({
                  ...prev,
                  isFetchingFullNavigation: false
                }));
              } else if (source === '文档导入AI评估') {
                setDocImportAnalysisState(prev => ({
                  ...prev,
                  isFetchingFullNavigation: false
                }));
              } else if (source === '获取全量导航按钮') {
                setExporting(false);
              }
              
              resolve(receivedData);
            } else if (data.type === 'error') {
              isConnectionClosed = true;
              eventSource.removeEventListener('message', handleMessage);
              eventSource.removeEventListener('error', handleError);
              eventSource.close();
              
              // 重置对应的状态管理
              if (source === '知识库AI诊断') {
                setWikiAnalysisState(prev => ({
                  ...prev,
                  isFetchingFullNavigation: false
                }));
              } else if (source === '文档导入AI评估') {
                setDocImportAnalysisState(prev => ({
                  ...prev,
                  isFetchingFullNavigation: false
                }));
              } else if (source === '获取全量导航按钮') {
                setExporting(false);
              }
              
              reject(new Error(data.message));
            }
          } catch (error) {
            isConnectionClosed = true;
            eventSource.removeEventListener('message', handleMessage);
            eventSource.removeEventListener('error', handleError);
            eventSource.close();
            
            // 重置对应的状态管理
            if (source === '知识库AI诊断') {
              setWikiAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '文档导入AI评估') {
              setDocImportAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '获取全量导航按钮') {
              setExporting(false);
            }
            
            reject(error);
          }
        };
        
        const handleError = (event) => {
          if (isConnectionClosed) {
            return;
          }
          
          if (event.target.readyState === EventSource.CLOSED) {
            isConnectionClosed = true;
            eventSource.removeEventListener('message', handleMessage);
            eventSource.removeEventListener('error', handleError);
            eventSource.close();
            
            // 重置对应的状态管理
            if (source === '知识库AI诊断') {
              setWikiAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '文档导入AI评估') {
              setDocImportAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '获取全量导航按钮') {
              setExporting(false);
            }
            
            reject(new Error('连接已关闭'));
            return;
          }
          
          if (event.target.readyState === EventSource.CONNECTING) {
            isConnectionClosed = true;
            eventSource.removeEventListener('message', handleMessage);
            eventSource.removeEventListener('error', handleError);
            eventSource.close();
            
            // 重置对应的状态管理
            if (source === '知识库AI诊断') {
              setWikiAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '文档导入AI评估') {
              setDocImportAnalysisState(prev => ({
                ...prev,
                isFetchingFullNavigation: false
              }));
            } else if (source === '获取全量导航按钮') {
              setExporting(false);
            }
            
            reject(new Error('连接建立过程中出现错误'));
            return;
          }
          
          isConnectionClosed = true;
          eventSource.removeEventListener('message', handleMessage);
          eventSource.removeEventListener('error', handleError);
          eventSource.close();
          
          // 重置对应的状态管理
          if (source === '知识库AI诊断') {
            setWikiAnalysisState(prev => ({
              ...prev,
              isFetchingFullNavigation: false
            }));
          } else if (source === '文档导入AI评估') {
            setDocImportAnalysisState(prev => ({
              ...prev,
              isFetchingFullNavigation: false
            }));
          } else if (source === '获取全量导航按钮') {
            setExporting(false);
          }
          
          reject(new Error('连接错误'));
        };
        
        eventSource.addEventListener('message', handleMessage);
        eventSource.addEventListener('error', handleError);
      });
      
      // 更新缓存
      setFullNavigationCache({
        data: allNodes,
        isLoading: false,
        lastUpdated: Date.now(),
        error: null,
        requestCount: fullNavigationCache.requestCount,
        nodeCount: cumulativeCount
      });
      
      console.log(`[全量导航缓存] 数据获取完成，节点数量: ${cumulativeCount}`);
      return allNodes;
      
    } catch (error) {
      // 更新缓存错误状态
      setFullNavigationCache(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      
      // 重置对应的状态管理
      if (source === '知识库AI诊断') {
        setWikiAnalysisState(prev => ({
          ...prev,
          isFetchingFullNavigation: false
        }));
      } else if (source === '文档导入AI评估') {
        setDocImportAnalysisState(prev => ({
          ...prev,
          isFetchingFullNavigation: false
        }));
      } else if (source === '获取全量导航按钮') {
        setExporting(false);
      }
      
      console.error(`[全量导航缓存] 获取数据失败:`, error);
      throw error;
    }
  }, [spaceId, fullNavigationCache]);

  // Function to handle export button click（根据状态决定是否强制刷新缓存）
  const handleExportButtonClick = () => {
    // 如果已经有导出数据，说明用户要再次点击，应该强制刷新缓存
    if (exportedData && exportedFilename) {
      setShouldForceRefreshExport(true);
    }
    // 调用实际的获取函数
    fetchAllNodesRecursively();
  };

  // Function to recursively fetch all wiki nodes（使用统一缓存机制）
  const fetchAllNodesRecursively = async () => {
    const userAccessToken = localStorage.getItem('user_access_token');
    if (!userAccessToken) {
      message.error('请先登录以获取 User Access Token');
      return;
    }

    setExporting(true);
    setExportedCount(0);
    // 重置导出状态，确保用户重新获取全量导航时清除之前的数据
    resetExportState();

    try {
      // 使用统一的全量导航数据获取函数（根据状态决定是否强制刷新缓存）
      const allNodes = await getFullNavigationData({
        forceRefresh: shouldForceRefreshExport, // 根据状态决定是否强制刷新缓存
        onProgress: (count) => {
          setExportedCount(count);
        },
        source: '获取全量导航按钮'
      });
      
      // 重置强制刷新状态，确保下次点击使用缓存
      setShouldForceRefreshExport(false);
      
      // Count total nodes
      const countNodes = (nodes) => {
        let count = 0;
        const traverse = (nodeList) => {
          nodeList.forEach(node => {
            count++;
            if (node.children && node.children.length > 0) {
              traverse(node.children);
            }
          });
        };
        traverse(nodes);
        return count;
      };
      
      const totalNodes = countNodes(allNodes);
      setExportedCount(totalNodes);
      
      // Get space name for file naming
      const spaceName = await getSpaceName(spaceId);
      
      // Store the data and filename for manual download
      setExportedData(allNodes);
      setExportedFilename(spaceName);
      
      message.success(`成功导出 ${totalNodes} 个节点`);
      setExporting(false);
      
    } catch (error) {
      console.error('Error fetching all wiki nodes:', error.message);
      
      // 处理特定错误类型
      if (error.message.includes('请求过于频繁')) {
        const retryMatch = error.message.match(/(\d+)秒后重试/);
        if (retryMatch) {
          message.error(`请求过于频繁，请在 ${retryMatch[1]} 秒后重试`);
        } else {
          message.error('请求过于频繁，请稍后重试');
        }
      } else if (error.message.includes('请先登录')) {
        message.error('请先登录以获取 User Access Token');
      } else {
        message.error(`获取全量导航失败: ${error.message}`);
      }
      
      setExporting(false);
      // 重置导出状态，确保失败时也清除状态
      resetExportState();
    }
  };

  // 打开文档导入AI评估模态窗（不自动开始分析）
  const openDocImportAnalysisModal = () => {
    setDocImportModalVisible(true);
  };

  // 开始文档导入AI分析任务
  const startDocImportAnalysis = async (docToken, docType = 'docx') => {
    try {
      console.log('Starting document import analysis', { docToken, docType });
      
      const storedApiKey = localStorage.getItem('llm_api_key');
      const storedModel = localStorage.getItem('llm_model') || 'doubao-seed-1-6-thinking-250615';
      // 使用包含占位符的提示词模板
      const storedPrompt = localStorage.getItem('prompt_doc_import_analysis') || `你是一位专业的知识管理专家，具备以下能力：
1. 深入理解文档内容，分析其主题、关键信息和潜在价值。
2. 熟悉知识库的现有结构，能够准确判断文档的最佳归属节点。
3. 提供清晰、有说服力的分析和建议，帮助用户做出决策。

## 评估材料
**知识库标题**：
{WIKI_TITLE}

**导入文档内容**：
{IMPORTED_DOCUMENT_CONTENT}

**当前知识库结构**：
{CURRENT_WIKI_STRUCTURE}

## 评估任务
请根据以上材料，完成以下三个任务：

### 1. 内容匹配度分析
分析导入文档与知识库现有节点的相关性，评估其在知识库中的潜在价值。

### 2. 归属节点建议
基于内容分析，推荐1-3个最适合的现有节点作为文档的归属位置，并简要说明理由。

### 3. 导入决策
综合以上分析，给出是否建议导入该文档的最终决策（建议导入/暂不建议导入），并提供简要说明。`;
      const userAccessToken = localStorage.getItem('user_access_token');

      if (!storedApiKey || !userAccessToken) {
        message.error('请先设置并保存大模型 API Key 和 User Access Token');
        return;
      }

      // 重置状态并开始分析
      setDocImportAnalysisState(prev => ({
        ...prev,
        isLoading: true,
        result: '',
        reasoningContent: '',
        isReasoningDone: false,
        hasAnalysis: false
      }));

      // 使用统一的全量导航数据获取函数（支持缓存机制）
      const allNodes = await getFullNavigationData({
        onProgress: (count) => {
          // 更新模态窗中的节点计数
          setDocImportAnalysisState(prev => ({
            ...prev,
            fullNavigationNodeCount: count
          }));
        },
        source: '文档导入AI评估'
      });
      
      const wiki_node_md = formatNodesToMarkdown(allNodes);
      // 获取知识库标题
      const wikiTitle = await getSpaceName(spaceId);
      
      // 定义占位符字典 - 后端会负责替换IMPORTED_DOCUMENT_CONTENT占位符
      const placeholders = {
        'KNOWLEDGE_BASE_STRUCTURE': wiki_node_md,
        'WIKI_TITLE': wikiTitle
      };

      // 构造请求配置对象
      const config = {
        url: '/api/llm/doc_import_analysis',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          doc_token: docToken,
          doc_type: docType,
          wiki_node_md: wiki_node_md,
          api_key: storedApiKey,
          model: storedModel,
          prompt_template: storedPrompt,
          placeholders: placeholders,
          wiki_title: wikiTitle
        }
      };

      console.log('Sending request to /api/llm/doc_import_analysis with data:', {
        ...config.data,
        wiki_node_md: `${config.data.wiki_node_md?.substring(0, 100)}...`, // 只记录前100个字符
        prompt_template: `${config.data.prompt_template?.substring(0, 100)}...` // 只记录前100个字符
      });

      // 处理流式响应
      await handleStreamResponse(
        config,
        (data) => {
          // 处理纯文本数据块
          if (data.text) {
            setDocImportAnalysisState(prev => ({...prev, result: prev.result + data.text}));
            return;
          }
          
          // 处理区分后的推理内容和普通内容
          if (data.type === 'reasoning') {
            flushSync(() => {
              setDocImportAnalysisState(prev => ({...prev, reasoningContent: prev.reasoningContent + data.content}));
            });
            return;
          }
          
          if (data.type === 'content') {
            // 检查 content 是否为字符串，如果不是则转换为字符串
            let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
            console.log('Processing content chunk:', content);
            
            // 直接更新分析结果
            flushSync(() => {
              if (!docImportAnalysisState.isReasoningDone) {
                setDocImportAnalysisState(prev => ({...prev, isReasoningDone: true}));
              }
              setDocImportAnalysisState(prev => ({...prev, result: prev.result + content}));
            });
            return;
          }
        },
        () => {
          console.log('Document import analysis completed successfully');
          setDocImportAnalysisState(prev => ({...prev, isLoading: false}));
          // 清除之前的优化建议
          setDocImportAnalysisState(prev => ({
            ...prev,
            suggestions: []
          }));
          localStorage.setItem(`doc_import_suggestions_${spaceId}`, JSON.stringify([]));
        },
        (error) => {
          console.error('Stream response error in doc import analysis:', error);
          throw error;
        },
        () => {
          // 强制更新UI
          setDocImportAnalysisState(prev => ({...prev, result: prev.result}));
        }
      );

    } catch (error) {
      console.error('Doc import analysis failed:', error);
      message.error(`文档导入分析失败: ${error.message}`);
    } finally {
      setDocImportAnalysisState(prev => ({...prev, isLoading: false}));
    }
  };

  // 兼容旧版本的handleDocImportAnalysis函数
  const handleDocImportAnalysis = async (docToken, docType = 'docx') => {
    await startDocImportAnalysis(docToken, docType);
  };


  useEffect(() => {
    // 初始化AI分析建议
    try {
      const suggestions = JSON.parse(localStorage.getItem(`ai_suggestions_${spaceId}`) || '{}');
      setWikiAnalysisState(prev => ({
        ...prev,
        suggestions: suggestions
      }));
    } catch (e) {
      console.error('Failed to parse ai_suggestions from localStorage:', e);
      setWikiAnalysisState(prev => ({
        ...prev,
        suggestions: {}
      }));
    }
    
    // 初始化文档导入分析建议
    try {
      const docImportSuggestions = JSON.parse(localStorage.getItem(`doc_import_suggestions_${spaceId}`) || '[]');
      setDocImportAnalysisState(prev => ({
        ...prev,
        suggestions: docImportSuggestions
      }));
    } catch (e) {
      console.error('Failed to parse doc_import_suggestions from localStorage:', e);
      setDocImportAnalysisState(prev => ({
        ...prev,
        suggestions: []
      }));
    }
  }, [spaceId]);

  const formatNodesToMarkdown = (nodes) => {
    let markdown = '';
    function buildMarkdown(node, level) {
      // 检查node.key是否存在，如果不存在则显示为[NODE TOKEN MISSING]
      // 同时检查node.node_token作为备用
      const token = node.key || node.node_token || '[NODE TOKEN MISSING]';
      const title = node.title.props ? node.title.props.children : node.title;
      markdown += `${'  '.repeat(level)}- ${title} (token: ${token})\n`;
      if (node.children) {
        node.children.forEach(child => buildMarkdown(child, level + 1));
      }
    }
    nodes.forEach(node => buildMarkdown(node, 0));
    return markdown;
  };

  // 生成基于已展开节点的md格式目录
  const formatExpandedNodesToMarkdown = (treeData, expandedNodes, targetNodeKey) => {
    let markdown = '';
    
    // 递归查找目标节点并构建展开路径
    const buildExpandedPath = (node, level, isExpanded, isInTargetPath = false) => {
      const token = node.key || node.node_token || '[NODE TOKEN MISSING]';
      const title = node.title.props ? node.title.props.children : node.title;
      
      // 如果节点已展开或在目标路径上，则包含在md中
      if (isExpanded || isInTargetPath) {
        markdown += `${'  '.repeat(level)}- ${title}\n`;
        
        // 递归处理子节点
        if (node.children) {
          node.children.forEach(child => {
            const childIsExpanded = expandedNodes.includes(child.key);
            const childIsInTargetPath = isInTargetPath && child.key !== targetNodeKey;
            buildExpandedPath(child, level + 1, childIsExpanded, childIsInTargetPath);
          });
        }
      }
    };
    
    // 从根节点开始构建
    treeData.forEach(node => {
      const isExpanded = expandedNodes.includes(node.key);
      const isInTargetPath = node.key === targetNodeKey;
      buildExpandedPath(node, 0, isExpanded, isInTargetPath);
    });
    
    return markdown;
  };

  // 打开知识库AI诊断模态窗（不自动开始分析）
  const openWikiAnalysisModal = () => {
    setModalVisible(true);
  };
  
  // 开始知识库AI分析任务
  const startWikiAnalysis = async () => {
    const storedApiKey = localStorage.getItem('llm_api_key');
    const storedModel = localStorage.getItem('llm_model') || 'doubao-seed-1-6-thinking-250615';
    const storedPrompt = localStorage.getItem('prompt_wiki_analysis') || `你是一位知识管理专家，擅长检查知识库的结构是否合理。用户希望优化现有的知识库结构，以更好地服务于大模型知识问答。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。

## 评估材料
**知识库标题**：
{WIKI_TITLE}

**知识库节点信息**：
{All_node}

## 评估标准（总分30分）
请对以下三个标准分别评分（1-10分），并提供详细分析：

### 1. 逻辑性（1-10分）
评估节点间逻辑关系是否清晰合理，是否便于用户查找和理解知识。
**评分**：[在此填写分数]

### 2. 完整性（1-10分）
分析知识库是否涵盖相关领域主要知识，有无重要内容缺失。
**评分**：[在此填写分数]

### 3. 可扩展性（1-10分）
评估是否易于添加新节点，能否适应知识的更新和发展。
**评分**：[在此填写分数]

## 总分
**总分**（在此填写总分，满分30分）

## 优化建议
- **节点名称1(https://feishu.cn/wiki/token1 *使用 markdown 超链接语法)**：[详细优化建议1]
- **节点名称2(https://feishu.cn/wiki/token2 *使用 markdown 超链接语法)**：[详细优化建议2]`;
    
    if (!storedApiKey) {
      message.error('请先在AI分析配置页面设置并保存大模型 API Key');
      return;
    }

    // 重置状态并开始加载
    setWikiAnalysisState(prev => ({
      ...prev,
      result: '',
      reasoningContent: '',
      isReasoningDone: false,
      isLoading: true
      // 注意：不重置 suggestions，避免触发树导航刷新
    }));

    try {
      // 使用统一的全量导航数据获取函数（支持缓存机制）
      const allNodes = await getFullNavigationData({
        onProgress: (count) => {
          // 更新模态窗中的节点计数
          setWikiAnalysisState(prev => ({
            ...prev,
            fullNavigationNodeCount: count
          }));
        },
        source: '知识库AI诊断'
      });
      
      const wiki_node_md = formatNodesToMarkdown(allNodes);
      // 获取知识库标题
      const wikiTitle = await getSpaceName(spaceId);
      
      // 定义占位符字典
      const placeholders = {
        'KNOWLEDGE_BASE_STRUCTURE': wiki_node_md,
        'WIKI_TITLE': wikiTitle
      };

      // 构造请求配置对象
      const config = {
        url: '/api/llm/stream_analysis',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          api_key: storedApiKey,
          model: storedModel,
          prompt_template: storedPrompt,
          placeholders: placeholders
        }
      };

      // 处理流式响应
        await handleStreamResponse(
          config,
          (data) => {
            // 处理纯文本数据块
            if (data.text) {
              setWikiAnalysisState(prev => ({
                ...prev,
                result: prev.result + data.text
              }));
              return;
            }
            
            // 处理区分后的推理内容和普通内容
            if (data.type === 'reasoning') {
              flushSync(() => {
                setWikiAnalysisState(prev => ({
                  ...prev,
                  reasoningContent: prev.reasoningContent + data.content
                }));
              });
              return;
            }
            
            if (data.type === 'content') {
              // 检查 content 是否为字符串，如果不是则转换为字符串
              let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
              console.log('Processing content chunk:', content);
              
              // 直接更新分析结果，并标记推理完成
              flushSync(() => {
                setWikiAnalysisState(prev => ({
                  ...prev,
                  result: prev.result + content,
                  isReasoningDone: true
                }));
              });
              return;
            }
          },
          () => {
            setWikiAnalysisState(prev => ({
              ...prev,
              isReasoningDone: true,
              isLoading: false,
              hasAnalysis: true
            }));
          },
          (error) => {
            console.error('Stream response error:', error);
            message.error(`流式响应错误: ${error.message}`);
            flushSync(() => {
              setWikiAnalysisState(prev => ({
                ...prev,
                result: `分析失败: ${error.message}`,
                isReasoningDone: true,
                isLoading: false,
                hasAnalysis: true
              }));
            });
          },
          () => {
            // 强制更新UI
            setWikiAnalysisState(prev => ({
              ...prev,
              result: prev.result
            }));
          }
        );
    } catch (error) {
      console.error('AI analysis failed:', error);
      message.error(`AI分析失败: ${error.message}`);
      setWikiAnalysisState(prev => ({
        ...prev,
        result: `分析失败: ${error.message}`,
        isLoading: false,
        hasAnalysis: true
      }));
    }
  };

  const findNodePath = (key, nodes) => {
    const path = [];
    function find(currentKey, currentNodes, currentPath) {
        for (const node of currentNodes) {
            const newPath = [...currentPath, node.title.props ? node.title.props.children : node.title];
            if (node.key === currentKey) {
                return newPath;
            }
            if (node.children) {
                const foundPath = find(currentKey, node.children, newPath);
                if (foundPath) {
                    return foundPath;
                }
            }
        }
        return null;
    }
    const result = find(key, nodes, []);
    return result ? result.join(' / ') : '';
  };

  // 打开文档AI诊断模态窗（不自动开始分析）
  const openDocAnalysisModal = () => {
    if (!selectedNode) {
      message.error('请先选择一个文档节点');
      return;
    }
    setDocAnalysisModalVisible(true);
  };
  
  // 开始文档AI分析任务
  const startDocAnalysis = async () => {
    const storedApiKey = localStorage.getItem('llm_api_key');
    const storedModel = localStorage.getItem('llm_model') || 'doubao-seed-1-6-thinking-250615';
    const storedPrompt = localStorage.getItem('prompt_doc_analysis') || `你是一位知识管理大师，负责根据用户提供的当前文档和该文档所在的知识库节点，对文档进行多维度打分评估。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。

## 评估材料
- **知识库标题**：
{WIKI_TITLE}

- **当前文档**：
{CURRENT_DOCUMENT}

- **知识库节点**：
{KNOWLEDGE_BASE_NODE}

## 评估维度（总分40分）
请对以下四个维度分别评分（1-10分），并提供详细分析：

### 1. 文档位置合理性（1-10分）
分析文档在当前知识库节点中的适配性，是否方便用户查找和使用。
**评分**：[在此填写分数]

### 2. 文档结构与信息充足性（1-10分）
评估文档结构是否清晰有条理，内容是否完整，有无关键信息缺失。
**评分**：[在此填写分数]

### 3. 文档内容对用户价值（1-10分）
分析文档内容是否能满足用户实际需求，对解决问题和获取知识的帮助程度。
**评分**：[在此填写分数]

### 4. 知识问答参考价值（1-10分）
评估文档内容对大模型知识问答的参考价值，包括事实准确性、案例丰富度等。
**评分**：[在此填写分数]

## 总分
**总分**（在此填写总分，满分40分）

## 总结分析
- **主要优势**：
  - [列出文档的突出优点]

- **潜在不足**：
  - [指出存在的问题或可提升之处]

- **改进建议**：
  - [提出具体可行的改进措施]`;
    const userAccessToken = localStorage.getItem('user_access_token');

    if (!storedApiKey || !userAccessToken) {
      message.error('请先设置并保存大模型 API Key 和 User Access Token');
      return;
    }

    if (!selectedNode) {
      message.error('请先选择一个文档节点');
      return;
    }

    // 重置状态并开始加载
    setDocAnalysisState(prev => ({
      ...prev,
      result: '',
      reasoningContent: '',
      isReasoningDone: false,
      isLoading: true
    }));

    try {
      const docContentRes = await apiClient.get(`/api/wiki/doc/${selectedNode.key}`, {
        headers: { 'Authorization': `Bearer ${userAccessToken}` }
      });
      const CURRENT_DOCUMENT = docContentRes.data.content;
      // 生成当前节点在树导航中已展开的所有节点的md格式
      const KNOWLEDGE_BASE_NODE = formatExpandedNodesToMarkdown(treeData, expandedNodes, selectedNode.key);
      // 获取知识库标题
      const wikiTitle = await getSpaceName(spaceId);

      // 定义占位符字典
      const placeholders = {
        'CURRENT_DOCUMENT': CURRENT_DOCUMENT,
        'KNOWLEDGE_BASE_NODE': KNOWLEDGE_BASE_NODE,
        'WIKI_TITLE': wikiTitle
      };

      // 构造请求配置对象
      const config = {
        url: '/api/llm/stream_analysis',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          api_key: storedApiKey,
          model: storedModel,
          prompt_template: storedPrompt,
          placeholders: placeholders
        }
      };

      // 处理流式响应
      await handleStreamResponse(
        config,
        (data) => {
          // 处理纯文本数据块
          if (data.text) {
            setDocAnalysisState(prev => ({...prev, result: prev.result + data.text}));
            return;
          }
          
          // 处理区分后的推理内容和普通内容
          if (data.type === 'reasoning') {
            flushSync(() => {
              setDocAnalysisState(prev => ({...prev, reasoningContent: prev.reasoningContent + data.content}));
            });
            return;
          }
          
          if (data.type === 'content') {
            flushSync(() => {
              if (!docAnalysisState.isReasoningDone) {
                setDocAnalysisState(prev => ({...prev, isReasoningDone: true}));
              }
              // 检查 content 是否为字符串，如果不是则转换为字符串
              let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
              setDocAnalysisState(prev => ({...prev, result: prev.result + content}));
            });
            return;
          }
        },
        () => {
          setDocAnalysisState(prev => ({...prev, isLoading: false}));
        },
        (error) => {
          throw error;
        },
        () => {
          // 强制更新UI
          setDocAnalysisState(prev => ({...prev, result: prev.result}));
        }
      );
    } catch (error) { 
      console.error('Doc AI analysis failed:', error);
      message.error(`文档 AI 分析失败: ${error.message}`);
      flushSync(() => {
        setDocAnalysisState(prev => ({...prev, result: `分析失败: ${error.message}`, isReasoningDone: true})); // 确保在错误时也能显示结果
      });
    } finally {
      setDocAnalysisState(prev => ({...prev, isLoading: false}));
    }
  };

  // Transform data to tree structure
  const transformData = (nodes, suggestions) => {
    // 过滤掉缺少node_token的节点
    const validNodes = nodes.filter(node => node.node_token);
    return validNodes.map(node => {
      const suggestion = suggestions[node.node_token];
      const title = suggestion ? <span className="suggestion-node">{node.title}</span> : node.title;
      const newNode = {
        title: title,
        key: node.node_token,
        // If node has children, mark it as expandable but don't load children yet
        children: node.has_child ? [] : [],
        isLeaf: !node.has_child,
        url: `https://feishu.cn/wiki/${node.node_token}?hideSider=1&hideHeader=1`
      };
      return newNode;
    });
  };

  // Load root nodes
  useEffect(() => {
    setLoading(true);
    // Fetch root nodes (nodes without parent)
    Promise.all([
      apiClient.get(`/api/wiki/${spaceId}/nodes`, { params: { parent_node_token: undefined } }),
      getSpaceName(spaceId)
    ])
      .then(([nodesResponse, spaceName]) => {
        const items = nodesResponse.data.items;
        const transformed = transformData(items, wikiAnalysisState.suggestions);
        setTreeData(transformed);
        setSpaceName(spaceName);
        // Update page title
        document.title = spaceName;
      })
      .catch(error => {
        console.error('Error fetching root wiki nodes:', error);
        message.error(`加载知识库节点失败: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [spaceId, wikiAnalysisState.suggestions]);

  // Load children nodes when a node is expanded
  const onLoadData = ({ key, children }) => {
    // If children are already loaded, do nothing
    if (children && children.length > 0) {
      // Check if this is a "load more" node
      const loadMoreNode = children.find(child => child.key === `${key}-load-more`);
      if (loadMoreNode) {
        // Load the next page
        return loadChildNodes(key, loadMoreNode.pageToken);
      }
      return Promise.resolve();
    }

    // Fetch children nodes
    return loadChildNodes(key, undefined);
  };

  // Load child nodes with pagination support
  const loadChildNodes = (parentKey, pageToken) => {
    return apiClient.get(`/api/wiki/${spaceId}/nodes`, { 
      params: { 
        parent_node_token: parentKey,
        page_token: pageToken
      } 
    })
      .then(response => {
        const { items, has_more, page_token } = response.data;
        const transformed = transformData(items, wikiAnalysisState.suggestions);
        
        // Update tree data with loaded children
        setTreeData(origin => {
          // If this is not the first page, append to existing children
          if (pageToken) {
            return appendToTreeData(origin, parentKey, transformed, has_more, page_token);
          } else {
            return updateTreeData(origin, parentKey, transformed, has_more, page_token);
          }
        });
      })
      .catch(error => {
        console.error('Error fetching child wiki nodes:', error);
        message.error(`加载子节点失败: ${error.message}`);
        // Remove loading indicator on error
        setTreeData(origin => {
          return updateTreeData(origin, parentKey, []);
        });
      });
  };

  // Update tree data with new children for a node
  const updateTreeData = (list, key, children, hasMore, pageToken) => {
    return list.map(node => {
      if (node.key === key) {
        // Add "load more" node if there are more items
        if (hasMore && pageToken) {
          return {
            ...node,
            children: [
              ...children,
              {
                key: `${key}-load-more`,
                title: '加载更多',
                isLeaf: true,
                pageToken: pageToken  // Store page token for next request
              }
            ]
          };
        }
        // Otherwise, just add the children
        return {
          ...node,
          children
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children, hasMore, pageToken)
        };
      }
      return node;
    });
  };

  // Append new children to existing children for a node
  const appendToTreeData = (list, key, children, hasMore, pageToken) => {
    return list.map(node => {
      if (node.key === key) {
        // Remove the "load more" node if it exists
        const filteredChildren = node.children.filter(child => child.key !== `${key}-load-more`);
        
        // Add "load more" node if there are more items
        if (hasMore && pageToken) {
          return {
            ...node,
            children: [
              ...filteredChildren,
              ...children,
              {
                key: `${key}-load-more`,
                title: '加载更多',
                isLeaf: true,
                pageToken: pageToken  // Store page token for next request
              }
            ]
          };
        }
        // Otherwise, just append the children
        return {
          ...node,
          children: [
            ...filteredChildren,
            ...children
          ]
        };
      }
      if (node.children) {
        return {
          ...node,
          children: appendToTreeData(node.children, key, children, hasMore, pageToken)
        };
      }
      return node;
    });
  };

  const findNode = (key, data) => {
    for (const item of data) {
      if (item.key === key) return item;
      if (item.children) {
        const found = findNode(key, item.children);
        if (found) return found;
      }
    }
    return null;
  };

  const onSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0) {
      // Check if this is a "load more" node
      if (selectedKeys[0].endsWith('-load-more')) {
        // Don't select "load more" nodes
        return;
      }
      const node = findNode(selectedKeys[0], treeData);
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  };

  // 处理节点展开/折叠事件
  const onExpand = (expandedKeys, info) => {
    setExpandedNodes(expandedKeys);
  };

  const memoizedTree = useMemo(() => {
    if (loading) {
      return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin /></div>;
    }
    return (
      <Tree
        treeData={treeData}
        onSelect={onSelect}
        loadData={onLoadData}
        onExpand={onExpand}
        expandedKeys={expandedNodes}
        showLine
      />
    );
  }, [treeData, loading, onSelect, onLoadData, expandedNodes]);

  return (
    <Layout className="wiki-detail-layout">
      <Header className="wiki-detail-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeftOutlined onClick={() => navigate('/')} style={{ marginRight: '16px', cursor: 'pointer', fontSize: '16px' }} />
          <Title level={3} className="wiki-detail-title">{spaceName}</Title>
        </div>
        <div>
          <Button type="primary" onClick={openWikiAnalysisModal}>知识库 AI 诊断</Button>
          <Button onClick={openDocImportAnalysisModal} style={{ marginLeft: '10px' }}>文档导入 AI 评估</Button>
          {selectedNode && (
            <Button onClick={openDocAnalysisModal} style={{ marginLeft: '10px' }}>
              当前文档 AI 诊断
            </Button>
          )}
        </div>
      </Header>
      <Layout>
        <Sider width={350} className="wiki-detail-sider">
          <div style={{ padding: '10px' }}>
            <Button 
              onClick={handleExportButtonClick} 
              style={{ marginBottom: '10px', width: '100%' }}
              loading={exporting}
            >
              获取全量导航
            </Button>
            {(exporting || (exportedData && exportedFilename)) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <span>已导出节点数量: {exportedCount}</span>
                {exportedData && exportedFilename && (
                  <>
                    <span 
                    style={{ marginLeft: '10px', cursor: 'pointer', color: '#1890ff' }} 
                    onClick={handleManualDownload}
                    title="点击下载导出文件"
                  >
                    📥 下载
                  </span>
                  </>
                )}
              </div>
            )}
          </div>
          {memoizedTree}
        </Sider>
        <Content className="wiki-detail-content">
          {selectedNode ? (
            <iframe
              src={selectedNode.url}
              title={typeof selectedNode.title === 'string' ? selectedNode.title : 'Wiki Content'}
              className="wiki-iframe"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--feishu-text-color-3)', paddingTop: '40px' }}>
              <p>请在左侧选择一个知识节点以查看详情</p>
            </div>
          )}
        </Content>
      </Layout>
      <AiAnalysisModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          // 不再重置状态，保持分析结果直到用户重新分析
        }}
        analysisResult={wikiAnalysisState.result}
        reasoningContent={wikiAnalysisState.reasoningContent}
        isReasoningDone={wikiAnalysisState.isReasoningDone}
        loading={wikiAnalysisState.isLoading}
        suggestions={wikiAnalysisState.suggestions}
        isFetchingFullNavigation={wikiAnalysisState.isFetchingFullNavigation}
        fullNavigationNodeCount={wikiAnalysisState.fullNavigationNodeCount}
        onAnalysis={startWikiAnalysis}
        onApplySuggestions={(newSuggestions) => {
          localStorage.setItem(`ai_suggestions_${spaceId}`, JSON.stringify(newSuggestions));
          setWikiAnalysisState(prev => ({
            ...prev,
            suggestions: newSuggestions
          }));
          setModalVisible(false);
          message.success('优化建议已应用');
        }}
        onRestartAnalysis={() => {
          // 重置状态并开始新的分析
          setWikiAnalysisState(prev => ({
            ...prev,
            isLoading: true,
            result: '',
            reasoningContent: '',
            isReasoningDone: false,
            hasAnalysis: false
          }));
          startWikiAnalysis();
        }}
      />
      <DocAnalysisModal
        visible={docAnalysisModalVisible}
        onClose={() => {
          setDocAnalysisModalVisible(false);
          // 不再重置状态，保持分析结果直到用户重新分析
        }}
        loading={docAnalysisState.isLoading}
        analysisResult={docAnalysisState.result}
        reasoningContent={docAnalysisState.reasoningContent}
        isReasoningDone={docAnalysisState.isReasoningDone}
        onAnalysis={startDocAnalysis}
        isFetchingFullNavigation={exporting}
        fullNavigationNodeCount={exportedCount}
        onRestartAnalysis={() => {
          // 重置状态并开始新的分析
          setDocAnalysisState(prev => ({
            ...prev,
            isLoading: true,
            result: '',
            reasoningContent: '',
            isReasoningDone: false,
            hasAnalysis: false
          }));
          startDocAnalysis();
        }}
      />
      <DocImportAnalysisModal
        visible={docImportModalVisible}
        onClose={() => {
          setDocImportModalVisible(false);
          // 不再重置状态，保持分析结果直到用户重新分析
        }}
        onAnalysis={startDocImportAnalysis}
        loading={docImportAnalysisState.isLoading}
        analysisResult={docImportAnalysisState.result}
        reasoningContent={docImportAnalysisState.reasoningContent}
        isReasoningDone={docImportAnalysisState.isReasoningDone}
        isFetchingFullNavigation={docImportAnalysisState.isFetchingFullNavigation}
        fullNavigationNodeCount={docImportAnalysisState.fullNavigationNodeCount}
        onRestartAnalysis={() => {
          // 重置状态并开始新的分析
          setDocImportAnalysisState(prev => ({
            ...prev,
            isLoading: true,
            result: '',
            reasoningContent: '',
            isReasoningDone: false,
            hasAnalysis: false
          }));
          // 注意：文档导入分析需要用户重新选择文档，所以这里只是重置状态
        }}
      />
    </Layout>
  );
};

export default WikiDetail;
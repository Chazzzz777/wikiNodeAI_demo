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
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [reasoningContent, setReasoningContent] = useState('');
  const [isReasoningDone, setIsReasoningDone] = useState(false);
  const [docReasoningContent, setDocReasoningContent] = useState('');
  const [isDocReasoningDone, setIsDocReasoningDone] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [docAnalysisModalVisible, setDocAnalysisModalVisible] = useState(false);
  const [docAnalysisLoading, setDocAnalysisLoading] = useState(false);
  const [docImportModalVisible, setDocImportModalVisible] = useState(false);
  const [docImportAnalysisLoading, setDocImportAnalysisLoading] = useState(false);
  const [docImportAnalysisResult, setDocImportAnalysisResult] = useState('');
  const [docImportReasoningContent, setDocImportReasoningContent] = useState('');
  const [isDocImportReasoningDone, setIsDocImportReasoningDone] = useState(false);
  const [docImportSuggestions, setDocImportSuggestions] = useState([]);
  // State for full navigation export
  const [exporting, setExporting] = useState(false);
  const [exportedCount, setExportedCount] = useState(0);
  // State for exported data and filename
  const [exportedData, setExportedData] = useState(null);
  const [exportedFilename, setExportedFilename] = useState('');
  // State for space name
  const [spaceName, setSpaceName] = useState('知识库');

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
      // Reset export state after successful download
      resetExportState();
    }
  };

  // Function to reset export state
  const resetExportState = () => {
    setExportedData(null);
    setExportedFilename('');
    setExportedCount(0);
  };

  // Function to recursively fetch all wiki nodes
  const fetchAllNodesRecursively = async () => {
    const userAccessToken = localStorage.getItem('user_access_token');
    if (!userAccessToken) {
      message.error('请先登录以获取 User Access Token');
      return;
    }

    setExporting(true);
    setExportedCount(0);
    // Clear previous export data
    setExportedData(null);
    setExportedFilename('');
    // 用于累计进度计数
    let cumulativeCount = 0;
    // 标志位，跟踪连接是否已经正常关闭
    let isConnectionClosed = false;

    // 使用 EventSource 连接到 SSE 端点，将 token 作为查询参数传递
    const eventSource = new EventSource(`${apiClient.defaults.baseURL}/api/wiki/${spaceId}/nodes/all/stream?token=${encodeURIComponent(userAccessToken)}`);
    
    // 记录连接开始时间，用于诊断连接问题
    const connectionStartTime = Date.now();
    console.log('SSE connection attempt started at:', connectionStartTime);

    // 存储接收到的数据
    let receivedData = null;

    // 定义消息处理函数
    const handleMessage = async (event) => {
      try {
        // 检查数据是否为空
        if (!event.data) {
          console.warn('Received empty SSE data, skipping...');
          return;
        }
        
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          // 累计导出计数
          cumulativeCount += data.count;
          setExportedCount(cumulativeCount);
        } else if (data.type === 'result') {
          // 存储结果数据
          receivedData = data.data;
          
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
          
          const totalNodes = countNodes(receivedData);
          setExportedCount(totalNodes);
          
          // Get space name for file naming
          const spaceName = await getSpaceName(spaceId);
          
          // Store the data and filename for manual download
          setExportedData(receivedData);
          setExportedFilename(spaceName);
          
          message.success(`成功导出 ${totalNodes} 个节点`);

          
          // 标记连接已正常关闭
          isConnectionClosed = true;
          // 清理事件监听器
          eventSource.removeEventListener('message', handleMessage);
          eventSource.removeEventListener('error', handleError);
          // 关闭连接
          eventSource.close();
          setExporting(false);
        } else if (data.type === 'error') {
          // 处理错误
          console.error('Error fetching all wiki nodes:', data.message);
          
          // Handle rate limit error specifically
          if (data.retry_after) {
            message.error(`请求过于频繁，请在 ${data.retry_after} 秒后重试`);
          } else {
            message.error(`获取全量导航失败: ${data.message}`);
          }
          
          // 标记连接已正常关闭
          isConnectionClosed = true;
          // 清理事件监听器
          eventSource.removeEventListener('message', handleMessage);
          eventSource.removeEventListener('error', handleError);
          // 关闭连接
          eventSource.close();
          setExporting(false);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        
        // 标记连接已正常关闭
        isConnectionClosed = true;
        // 清理事件监听器
        eventSource.removeEventListener('message', handleMessage);
        eventSource.removeEventListener('error', handleError);
        // 关闭连接
        eventSource.close();
        setExporting(false);
        // 重置导出状态
        setExportedData(null);
        setExportedFilename('');
      }
    };

    // 定义错误处理函数
    const handleError = (event) => {
      // 记录详细的错误信息，以便调试
      console.log('SSE connection error event triggered:', {
        isTrusted: event.isTrusted,
        type: event.type,
        targetReadyState: event.target.readyState,
        isConnectionClosed: isConnectionClosed,
        event: event
      });
      
      // 如果连接已经正常关闭，则不显示错误
      if (isConnectionClosed) {
        console.log('Connection already closed, ignoring error event');
        // 确保事件监听器被清理
        eventSource.removeEventListener('message', handleMessage);
        eventSource.removeEventListener('error', handleError);
        // 关闭连接
        eventSource.close();
        // 重置导出状态
        setExporting(false);
        setExportedData(null);
        setExportedFilename('');
        return;
      }
      
      // 检查是否为正常关闭
      // readyState为2表示连接已关闭
      if (event.target.readyState === EventSource.CLOSED) {
        // 连接已正常关闭，不显示错误
        console.log('Connection closed normally, ignoring error event');
        // 确保事件监听器被清理
        eventSource.removeEventListener('message', handleMessage);
        eventSource.removeEventListener('error', handleError);
        // 关闭连接
        eventSource.close();
        // 重置导出状态
        setExporting(false);
        setExportedData(null);
        setExportedFilename('');
        return;
      }
      
      // 检查是否为连接建立过程中的错误
      // readyState为0表示连接正在建立中
      if (event.target.readyState === EventSource.CONNECTING) {
        // 连接建立过程中出现错误，可能是临时问题，不显示错误
        console.log('Connection error during establishment, ignoring error event');
        // 标记连接已正常关闭
        isConnectionClosed = true;
        // 清理事件监听器
        eventSource.removeEventListener('message', handleMessage);
        eventSource.removeEventListener('error', handleError);
        // 关闭连接
        eventSource.close();
        setExporting(false);
        // 重置导出状态
        setExportedData(null);
        setExportedFilename('');
        return;
      }
      
      console.error('SSE connection error:', event);
      message.error('连接错误，请稍后重试');
      
      // 标记连接已正常关闭
      isConnectionClosed = true;
      // 清理事件监听器
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      // 关闭连接
      eventSource.close();
      setExporting(false);
      // 重置导出状态
      setExportedData(null);
      setExportedFilename('');
    };

    // 添加事件监听器
    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);
    
    // 添加open事件监听器，用于确认连接已建立
    eventSource.addEventListener('open', () => {
      console.log('SSE connection opened successfully');
    });
  };

  const handleDocImportAnalysis = async (docToken, docType = 'docx') => {
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

    setDocImportAnalysisLoading(true);
    setDocImportAnalysisResult('');
    setDocImportReasoningContent('');
    setIsDocImportReasoningDone(false);

    try {
      const wiki_node_md = formatNodesToMarkdown(treeData);
      // 获取知识库标题
      const wikiTitle = await getSpaceName(spaceId);
      
      // 定义占位符字典 - 后端会负责替换IMPORTED_DOCUMENT_CONTENT占位符
      const placeholders = {
        'CURRENT_WIKI_STRUCTURE': wiki_node_md,
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

      // 处理流式响应
      await handleStreamResponse(
        config,
        (data) => {
          // 处理纯文本数据块
          if (data.text) {
            setDocImportAnalysisResult(prev => prev + data.text);
            return;
          }
          
          // 处理区分后的推理内容和普通内容
          if (data.type === 'reasoning') {
            flushSync(() => {
              setDocImportReasoningContent(prev => prev + data.content);
            });
            return;
          }
          
          if (data.type === 'content') {
            // 检查 content 是否为字符串，如果不是则转换为字符串
            let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
            console.log('Processing content chunk:', content);
            
            // 直接更新分析结果
            flushSync(() => {
              if (!isDocImportReasoningDone) {
                setIsDocImportReasoningDone(true);
              }
              setDocImportAnalysisResult(prev => prev + content);
            });
            return;
          }
        },
        () => {
          setDocImportAnalysisLoading(false);
          // 清除之前的优化建议
          setDocImportSuggestions([]);
          localStorage.setItem(`doc_import_suggestions_${spaceId}`, JSON.stringify([]));
        },
        (error) => {
          throw error;
        },
        () => {
          // 强制更新UI
          setDocImportAnalysisResult(prev => prev);
        }
      );

    } catch (error) {
      console.error('Doc import analysis failed:', error);
      message.error(`文档导入分析失败: ${error.message}`);
    } finally {
      setDocImportAnalysisLoading(false);
    }
  };


  useEffect(() => {
    // 初始化AI分析建议
    try {
      const suggestions = JSON.parse(localStorage.getItem(`ai_suggestions_${spaceId}`) || '{}');
      setAiSuggestions(suggestions);
    } catch (e) {
      console.error('Failed to parse ai_suggestions from localStorage:', e);
      setAiSuggestions({});
    }
    
    // 初始化文档导入分析建议
    try {
      const docImportSuggestions = JSON.parse(localStorage.getItem(`doc_import_suggestions_${spaceId}`) || '[]');
      setDocImportSuggestions(docImportSuggestions);
    } catch (e) {
      console.error('Failed to parse doc_import_suggestions from localStorage:', e);
      setDocImportSuggestions([]);
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

  const handleAiAnalysis = async () => {
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

    setModalVisible(true);
    setAnalysisLoading(true);
    setAnalysisResult('');
    setReasoningContent('');
    setIsReasoningDone(false);
    setSuggestions([]);

    try {
      const wiki_node_md = formatNodesToMarkdown(treeData);
      // 获取知识库标题
      const wikiTitle = await getSpaceName(spaceId);
      
      // 定义占位符字典
      const placeholders = {
        'All_node': wiki_node_md,
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
            setAnalysisResult(prev => prev + data.text);
            return;
          }
          
          // 处理区分后的推理内容和普通内容
          if (data.type === 'reasoning') {
            flushSync(() => {
              setReasoningContent(prev => prev + data.content);
            });
            return;
          }
          
          if (data.type === 'content') {
            // 检查 content 是否为字符串，如果不是则转换为字符串
            let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
            console.log('Processing content chunk:', content);
            
            // 直接更新分析结果，并标记推理完成
            flushSync(() => {
              if (!isReasoningDone) {
                setIsReasoningDone(true);
              }
              setAnalysisResult(prev => prev + content);
            });
            return;
          }
        },
        () => {
          setIsReasoningDone(true);
          setAnalysisLoading(false);
        },
        (error) => {
          console.error('Stream response error:', error);
          message.error(`流式响应错误: ${error.message}`);
          flushSync(() => {
            setAnalysisResult(`分析失败: ${error.message}`);
            setIsReasoningDone(true); // 确保在错误时也能显示结果
            setAnalysisLoading(false);
          });
        },
        () => {
          // 强制更新UI
          setAnalysisResult(prev => prev);
        }
      );
    } catch (error) {
      console.error('AI analysis failed:', error);
      message.error(`AI分析失败: ${error.message}`);
      setAnalysisResult(`分析失败: ${error.message}`);
      setAnalysisLoading(false);
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

  const handleDocAiAnalysis = async () => {
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

    setDocAnalysisModalVisible(true);
    setDocAnalysisLoading(true);
    setAnalysisResult('');
    setDocReasoningContent('');
    setIsDocReasoningDone(false);

    try {
      const docContentRes = await apiClient.get(`/api/wiki/doc/${selectedNode.key}`, {
        headers: { 'Authorization': `Bearer ${userAccessToken}` }
      });
      const CURRENT_DOCUMENT = docContentRes.data.content;
      const KNOWLEDGE_BASE_NODE = findNodePath(selectedNode.key, treeData);
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
            setAnalysisResult(prev => prev + data.text);
            return;
          }
          
          // 处理区分后的推理内容和普通内容
          if (data.type === 'reasoning') {
            flushSync(() => {
              setDocReasoningContent(prev => prev + data.content);
            });
            return;
          }
          
          if (data.type === 'content') {
            flushSync(() => {
              if (!isDocReasoningDone) {
                setIsDocReasoningDone(true);
              }
              // 检查 content 是否为字符串，如果不是则转换为字符串
              let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
              setAnalysisResult(prev => prev + content);
            });
            return;
          }
        },
        () => {
          setDocAnalysisLoading(false);
        },
        (error) => {
          throw error;
        },
        () => {
          // 强制更新UI
          setAnalysisResult(prev => prev);
        }
      );
    } catch (error) { 
      console.error('Doc AI analysis failed:', error);
      message.error(`文档 AI 分析失败: ${error.message}`);
      flushSync(() => {
        setAnalysisResult(`分析失败: ${error.message}`);
        setIsDocReasoningDone(true); // 确保在错误时也能显示结果
      });
    } finally {
      setDocAnalysisLoading(false);
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
        const transformed = transformData(items, aiSuggestions);
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
  }, [spaceId, aiSuggestions]);

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
        const suggestions = JSON.parse(localStorage.getItem(`ai_suggestions_${spaceId}`) || '{}');
        const transformed = transformData(items, suggestions);
        
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

  const memoizedTree = useMemo(() => {
    if (loading) {
      return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin /></div>;
    }
    return (
      <Tree
        treeData={treeData}
        onSelect={onSelect}
        loadData={onLoadData}
        showLine
      />
    );
  }, [treeData, loading, onSelect]);

  return (
    <Layout className="wiki-detail-layout">
      <Header className="wiki-detail-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeftOutlined onClick={() => navigate('/')} style={{ marginRight: '16px', cursor: 'pointer', fontSize: '16px' }} />
          <Title level={3} className="wiki-detail-title">{spaceName}</Title>
        </div>
        <div>
          <Button type="primary" onClick={handleAiAnalysis}>知识库 AI 诊断</Button>
          <Button onClick={() => setDocImportModalVisible(true)} style={{ marginLeft: '10px' }}>文档导入 AI 评估</Button>
          {selectedNode && (
            <Button onClick={handleDocAiAnalysis} style={{ marginLeft: '10px' }}>
              当前文档 AI 诊断
            </Button>
          )}
        </div>
      </Header>
      <Layout>
        <Sider width={350} className="wiki-detail-sider">
          <div style={{ padding: '10px' }}>
            <Button 
              onClick={fetchAllNodesRecursively} 
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
                    📥
                  </span>
                    <span 
                      style={{ marginLeft: '10px', cursor: 'pointer', color: '#ff4d4f' }} 
                      onClick={resetExportState}
                      title="清除导出状态"
                    >
                      🗑️
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
          // 重置所有相关状态，避免状态污染
          setAnalysisResult('');
          setReasoningContent('');
          setIsReasoningDone(false);
          setAnalysisLoading(false);
          setSuggestions([]);
        }}
        analysisResult={analysisResult}
        reasoningContent={reasoningContent}
        isReasoningDone={isReasoningDone}
        loading={analysisLoading}
        suggestions={suggestions}
        onApplySuggestions={(newSuggestions) => {
          localStorage.setItem(`ai_suggestions_${spaceId}`, JSON.stringify(newSuggestions));
          setAiSuggestions(newSuggestions);
          setModalVisible(false);
          message.success('优化建议已应用');
        }}
      />
      <DocAnalysisModal
        visible={docAnalysisModalVisible}
        onClose={() => {
          setDocAnalysisModalVisible(false);
          // 重置所有相关状态，避免状态污染
          setAnalysisResult('');
          setDocReasoningContent('');
          setIsDocReasoningDone(false);
          setDocAnalysisLoading(false);
        }}
        loading={docAnalysisLoading}
        analysisResult={analysisResult}
        reasoningContent={docReasoningContent}
        isReasoningDone={isDocReasoningDone}
      />
      <DocImportAnalysisModal
        visible={docImportModalVisible}
        onClose={() => {
          setDocImportModalVisible(false);
          // 重置所有相关状态，避免状态污染
          setDocImportAnalysisResult('');
          setDocImportReasoningContent('');
          setIsDocImportReasoningDone(false);
          setDocImportAnalysisLoading(false);
          setDocImportSuggestions([]);
        }}
        onAnalysis={handleDocImportAnalysis}
        loading={docImportAnalysisLoading}
        analysisResult={docImportAnalysisResult}
        reasoningContent={docImportReasoningContent}
        isReasoningDone={isDocImportReasoningDone}
      />
    </Layout>
  );
};

export default WikiDetail;
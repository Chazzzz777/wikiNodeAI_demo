import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { Tree, Spin, Layout, Typography, Button, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
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

  const handleDocImportAnalysis = async (docToken) => {
    const storedApiKey = localStorage.getItem('llm_api_key');
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
      const response = await fetch('/api/llm/doc_import_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-access-token': userAccessToken
        },
        body: JSON.stringify({
          doc_token: docToken,
          wiki_node_md: wiki_node_md,
          api_key: storedApiKey
        })
      });

      if (!response.body) throw new Error('Response body is null');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const data = part.substring(6).trim();
            if (data === '[DONE]') {
              if (docImportReasoningContent) {
                setIsDocImportReasoningDone(true);
              }
              setDocImportAnalysisLoading(false);
              return;
            }

            try {
              const json = JSON.parse(data);
              const reasoning = json.choices[0]?.delta?.reasoning_content;
              let content = json.choices[0]?.delta?.content;

              if (reasoning) {
                setDocImportReasoningContent(prev => prev + reasoning);
              }

              if (content) {
                if (!isDocImportReasoningDone) {
                  setIsDocImportReasoningDone(true);
                }
                setDocImportAnalysisResult(prev => prev + content);
              }
            } catch (e) {
              console.error('Error parsing JSON chunk:', data, e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Doc import analysis failed:', error);
      message.error(`文档导入分析失败: ${error.message}`);
    } finally {
      setDocImportAnalysisLoading(false);
    }
  };


  useEffect(() => {
    const suggestions = JSON.parse(localStorage.getItem(`ai_suggestions_${spaceId}`) || '{}');
    setAiSuggestions(suggestions);
  }, [spaceId]);

  const formatNodesToMarkdown = (nodes) => {
    let markdown = '';
    function buildMarkdown(node, level) {
      const title = node.title.props ? node.title.props.children : node.title;
      markdown += `${'  '.repeat(level)}- ${title} (token: ${node.key})\n`;
      if (node.children) {
        node.children.forEach(child => buildMarkdown(child, level + 1));
      }
    }
    nodes.forEach(node => buildMarkdown(node, 0));
    return markdown;
  };

  const handleAiAnalysis = async () => {
    const storedApiKey = localStorage.getItem('llm_api_key');
    if (!storedApiKey) {
      message.error('请先在知识库列表页面设置并保存大模型 API Key');
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
      const prompt = `你是一位知识管理专家，擅长检查知识库的结构是否合理。用户希望优化现有的知识库结构，以更好地服务于大模型知识问答。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。

## 评估材料
**知识库节点信息**：
${wiki_node_md}

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

      const response = await fetch('/api/llm/stream_analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: storedApiKey,
          model: 'doubao-seed-1-6-thinking-250615',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let suggestionBuffer = '';
      let inSuggestion = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setAnalysisLoading(false);
          break;
        }

        buffer += decoder.decode(value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const data = part.substring(6).trim();
            if (data === '[DONE]') {
              setAnalysisLoading(false);
              return;
            }

            try {
              const json = JSON.parse(data);
              const reasoning = json.choices[0]?.delta?.reasoning_content;
              let content = json.choices[0]?.delta?.content;

              if (reasoning) {
                setReasoningContent(prev => prev + reasoning);
              }

              if (content) {
                if (!isReasoningDone) {
                  setIsReasoningDone(true);
                }

                if (inSuggestion) {
                  if (content.includes('</优化建议>')) {
                    const parts = content.split('</优化建议>');
                    suggestionBuffer += parts[0] || '';
                    setAnalysisResult(prev => prev + (parts[1] || ''));
                    inSuggestion = false;
                    try {
                      const jsonStartIndex = suggestionBuffer.indexOf('[');
                      if (jsonStartIndex !== -1) {
                        const jsonStr = suggestionBuffer.substring(jsonStartIndex);
                        const parsedSuggestions = JSON.parse(jsonStr);
                        setSuggestions(parsedSuggestions);
                      }
                    } catch (e) {
                      console.error('Final JSON parsing error:', e, suggestionBuffer);
                    }
                    suggestionBuffer = '';
                  } else {
                    suggestionBuffer += content;
                  }
                } else {
                  if (content.includes('<优化建议>')) {
                    inSuggestion = true;
                    const parts = content.split('<优化建议>');
                    setAnalysisResult(prev => prev + parts[0]);
                    suggestionBuffer += parts[1] || '';
                  } else {
                    setAnalysisResult(prev => prev + content);
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing JSON chunk:', data, e);
            }
          }
        }
      }
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
        headers: { 'user-access-token': userAccessToken }
      });
      const CURRENT_DOCUMENT = docContentRes.data.content;
      const KNOWLEDGE_BASE_NODE = findNodePath(selectedNode.key, treeData);

      const prompt = `你是一位知识管理大师，负责根据用户提供的当前文档和该文档所在的知识库节点，对文档进行多维度打分评估。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。\n\n## 评估材料\n- **当前文档**：\n${CURRENT_DOCUMENT}\n\n- **知识库节点**：\n${KNOWLEDGE_BASE_NODE}\n\n## 评估维度（总分40分）\n请对以下四个维度分别评分（1-10分），并提供详细分析：\n\n### 1. 文档位置合理性（1-10分）\n分析文档在当前知识库节点中的适配性，是否方便用户查找和使用。\n**评分**：[在此填写分数]\n\n### 2. 文档结构与信息充足性（1-10分）\n评估文档结构是否清晰有条理，内容是否完整，有无关键信息缺失。\n**评分**：[在此填写分数]\n\n### 3. 文档内容对用户价值（1-10分）\n分析文档内容是否能满足用户实际需求，对解决问题和获取知识的帮助程度。\n**评分**：[在此填写分数]\n\n### 4. 知识问答参考价值（1-10分）\n评估文档内容对大模型知识问答的参考价值，包括事实准确性、案例丰富度等。\n**评分**：[在此填写分数]\n\n## 总分\n**总分**（在此填写总分，满分40分）\n\n## 总结分析\n- **主要优势**：\n  - [列出文档的突出优点]\n\n- **潜在不足**：\n  - [指出存在的问题或可提升之处]\n\n- **改进建议**：\n  - [提出具体可行的改进措施]`;

      const response = await fetch('/api/llm/stream_analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: storedApiKey,
          model: 'doubao-seed-1-6-thinking-250615',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.body) throw new Error('Response body is null');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setDocAnalysisLoading(false);
          break;
        }

        buffer += decoder.decode(value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const data = part.substring(6).trim();
            if (data === '[DONE]') {
              setDocAnalysisLoading(false);
              return;
            }

            try {
              const json = JSON.parse(data);
              const reasoning = json.choices[0]?.delta?.reasoning_content;
              let content = json.choices[0]?.delta?.content;

              if (reasoning) {
                setDocReasoningContent(prev => prev + reasoning);
              }

              if (content) {
                if (!isDocReasoningDone) {
                  setIsDocReasoningDone(true);
                }
                setAnalysisResult(prev => prev + content);
              }
            } catch (e) {
              console.error('Error parsing JSON chunk:', data, e);
            }
          }
        }
      }
    } catch (error) { 
      console.error('Doc AI analysis failed:', error);
      message.error(`文档 AI 分析失败: ${error.message}`);
    } finally {
      setDocAnalysisLoading(false);
    }
  };

  useEffect(() => {
    const transformData = (nodes, suggestions) => {
      return nodes.map(node => {
        const suggestion = suggestions[node.node_token];
        const title = suggestion ? <span className="suggestion-node">{node.title}</span> : node.title;
        const newNode = {
          title: title,
          key: node.node_token,
          children: node.children ? transformData(node.children, suggestions) : [],
          url: `https://feishu.cn/wiki/${node.node_token}?hideSider=1&hideHeader=1`
        };
        return newNode;
      });
    };

    setLoading(true);
    apiClient.get(`/api/wiki/${spaceId}/nodes/all`)
      .then(response => {
        const items = response.data;
        const transformed = transformData(items, aiSuggestions);
        setTreeData(transformed);
      })
      .catch(error => {
        console.error('Error fetching all wiki nodes:', error);
        message.error(`加载知识库节点失败: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [spaceId, aiSuggestions]);

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
        defaultExpandAll
      />
    );
  }, [treeData, loading, onSelect]);

  return (
    <Layout className="wiki-detail-layout">
      <Header className="wiki-detail-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeftOutlined onClick={() => navigate('/')} style={{ marginRight: '16px', cursor: 'pointer', fontSize: '16px' }} />
          <Title level={3} className="wiki-detail-title">知识库详情</Title>
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
        onClose={() => setModalVisible(false)}
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
        onClose={() => setDocAnalysisModalVisible(false)}
        loading={docAnalysisLoading}
        analysisResult={analysisResult}
        reasoningContent={docReasoningContent}
        isReasoningDone={isDocReasoningDone}
      />
      <DocImportAnalysisModal
        visible={docImportModalVisible}
        onClose={() => setDocImportModalVisible(false)}
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
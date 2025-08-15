import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Space, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import './Config.css';

const { Title, Text } = Typography;

// 默认提示词模板
const DEFAULT_PROMPTS = {
  wikiAnalysis: `你是一位知识管理专家，擅长检查知识库的结构是否合理。用户希望优化现有的知识库结构，以更好地服务于大模型知识问答。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。

## 评估材料
**知识库标题**：
{WIKI_TITLE}

**知识库节点信息**：
{KNOWLEDGE_BASE_STRUCTURE}

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
- **节点名称2(https://feishu.cn/wiki/token2 *使用 markdown 超链接语法)**：[详细优化建议2]`,
  docAnalysis: `你是一位知识管理大师，负责根据用户提供的当前文档和该文档所在的知识库节点，对文档进行多维度打分评估。请使用Markdown格式输出评估结果，确保结构清晰、重要信息高亮。

## 评估材料
**知识库标题**：
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
  - [提出具体可行的改进措施]`,
  docImportAnalysis: `你是一位知识管理专家，负责评估一篇外部文档是否适合导入当前的知识库中。请根据文档内容和知识库的现有结构，进行全面评估，并以Markdown格式输出结果。

## 评估材料
**知识库标题**：
{WIKI_TITLE}

### 待导入文档内容：
{IMPORTED_DOCUMENT_CONTENT}

### 当前知识库结构：
{KNOWLEDGE_BASE_STRUCTURE}

## 评估任务

1.  **内容匹配度分析**：
    -   分析文档主题是否与知识库的整体定位相符。
    -   评估文档内容在知识库中是否已有类似或重复的内容。

2.  **归属节点建议**：
    -   如果文档适合导入，请建议一个最合适的存放节点（请从“当前知识库结构”中选择一个最相关的节点token）。
    -   并详细说明为什么建议放在该节点下。

3.  **导入决策**：
    -   明确给出“建议导入”或“不建议导入”的结论。

请严格按照以上结构进行分析和输出。`
};

function Config() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  // 从localStorage加载配置
  useEffect(() => {
    const savedApiKey = localStorage.getItem('llm_api_key') || '';
    const savedModel = localStorage.getItem('llm_model') || 'doubao-seed-1-6-thinking-250615';
    const savedMaxTokens = localStorage.getItem('llm_max_tokens') || '4096';
    const savedPrompts = {
      wikiAnalysis: localStorage.getItem('prompt_wiki_analysis') || DEFAULT_PROMPTS.wikiAnalysis,
      docAnalysis: localStorage.getItem('prompt_doc_analysis') || DEFAULT_PROMPTS.docAnalysis,
      docImportAnalysis: localStorage.getItem('prompt_doc_import_analysis') || DEFAULT_PROMPTS.docImportAnalysis
    };
    
    form.setFieldsValue({
      apiKey: savedApiKey,
      model: savedModel,
      maxTokens: savedMaxTokens,
      ...savedPrompts
    });
  }, [form]);
  
  // 保存配置
  const handleSave = (values) => {
    try {
      localStorage.setItem('llm_api_key', values.apiKey);
      localStorage.setItem('llm_model', values.model);
      localStorage.setItem('llm_max_tokens', values.maxTokens || '4096');
      localStorage.setItem('prompt_wiki_analysis', values.wikiAnalysis);
      localStorage.setItem('prompt_doc_analysis', values.docAnalysis);
      localStorage.setItem('prompt_doc_import_analysis', values.docImportAnalysis);
      message.success('配置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      message.error('保存配置失败');
    }
  };
  
  // 重置为默认配置
  const handleReset = () => {
    form.setFieldsValue({
      apiKey: '',
      model: 'doubao-seed-1-6-thinking-250615',
      maxTokens: '4096',
      wikiAnalysis: DEFAULT_PROMPTS.wikiAnalysis,
      docAnalysis: DEFAULT_PROMPTS.docAnalysis,
      docImportAnalysis: DEFAULT_PROMPTS.docImportAnalysis
    });
  };
  
  return (
    <div className="config-container">
      <header className="config-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        <Title level={3} className="config-title">AI 分析配置</Title>
      </header>
      <main className="config-content">
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            autoComplete="off"
          >
            <Form.Item
              label="大模型 API Key"
              name="apiKey"
              rules={[{ required: true, message: '请输入 API Key' }]}
            >
              <Input.Password placeholder="输入你的大模型 API Key" />
            </Form.Item>
            
            <Form.Item
              label="大模型名称"
              name="model"
              rules={[{ required: true, message: '请输入模型名称' }]}
            >
              <Input placeholder="例如: doubao-seed-1-6-thinking-250615" />
            </Form.Item>
            
            <Form.Item
              label="最大输出令牌数 (max_tokens)"
              name="maxTokens"
              rules={[{ required: false, message: '请输入最大输出令牌数' }]}
              extra="控制AI分析结果的最大长度，默认值为4096，建议范围1024-8192"
            >
              <Input 
                type="number" 
                placeholder="例如: 4096" 
                min="1" 
                max="32768"
              />
            </Form.Item>
            
            <Divider>AI 分析提示词配置</Divider>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: '10px' }}>
              <strong>知识库分析提示词占位符说明：</strong><br />
              - <code>&#123;WIKI_TITLE&#125;</code>：当前知识库的标题<br />
              - <code>&#123;KNOWLEDGE_BASE_STRUCTURE&#125;</code>：知识库的完整节点结构信息
            </Text>
            <Form.Item
              label="知识库分析提示词"
              name="wikiAnalysis"
              rules={[{ required: true, message: '请输入提示词' }]}
            >
              <Input.TextArea rows={15} placeholder="输入知识库分析的提示词" />
            </Form.Item>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: '10px' }}>
              <strong>文档分析提示词占位符说明：</strong><br />
              - <code>&#123;WIKI_TITLE&#125;</code>：当前知识库的标题<br />
              - <code>&#123;CURRENT_DOCUMENT&#125;</code>：当前选中文档的内容<br />
              - <code>&#123;KNOWLEDGE_BASE_NODE&#125;</code>：当前文档在知识库中的节点路径
            </Text>
            <Form.Item
              label="文档分析提示词"
              name="docAnalysis"
              rules={[{ required: true, message: '请输入提示词' }]}
            >
              <Input.TextArea rows={15} placeholder="输入文档分析的提示词" />
            </Form.Item>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: '10px' }}>
              <strong>文档导入分析提示词占位符说明：</strong><br />
              - <code>&#123;WIKI_TITLE&#125;</code>：当前知识库的标题<br />
              - <code>&#123;IMPORTED_DOCUMENT_CONTENT&#125;</code>：待导入文档的内容<br />
              - <code>&#123;KNOWLEDGE_BASE_STRUCTURE&#125;</code>：当前知识库的结构
            </Text>
            <Form.Item
              label="文档导入分析提示词"
              name="docImportAnalysis"
              rules={[{ required: true, message: '请输入提示词' }]}
            >
              <Input.TextArea rows={15} placeholder="输入文档导入分析的提示词" />
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">保存配置</Button>
                <Button onClick={handleReset}>重置为默认</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </main>
    </div>
  );
}

export default Config;
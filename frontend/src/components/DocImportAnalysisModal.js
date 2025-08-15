import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, message, Spin, Collapse } from 'antd';
import ReactMarkdown from 'react-markdown';
import './docanalysismodal.css';

const { Panel } = Collapse;

const DocImportAnalysisModal = ({ visible, onClose, onAnalysis, loading, analysisResult, reasoningContent, isReasoningDone, isFetchingFullNavigation, fullNavigationNodeCount, isBatchProcessing, batchProgress, batchResults, currentBatchIndex, finalSummary }) => {
  const [docUrl, setDocUrl] = useState('');
  const reasoningRef = useRef(null);

  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoningContent]);

  const handleOk = () => {
    if (!docUrl) {
      message.error('请输入文档链接');
      return;
    }
    
    // 支持多种链接类型：docx、doc、wiki
    let docToken = null;
    let docType = null;
    
    // 检查 docx 类型
    const docxMatch = docUrl.match(/docx\/([a-zA-Z0-9]+)/);
    if (docxMatch && docxMatch[1]) {
      docToken = docxMatch[1];
      docType = 'docx';
    }
    
    // 检查 doc 类型
    const docMatch = docUrl.match(/doc\/([a-zA-Z0-9]+)/);
    if (!docToken && docMatch && docMatch[1]) {
      docToken = docMatch[1];
      docType = 'doc';
    }
    
    // 检查 wiki 类型
    const wikiMatch = docUrl.match(/wiki\/([a-zA-Z0-9]+)/);
    if (!docToken && wikiMatch && wikiMatch[1]) {
      docToken = wikiMatch[1];
      docType = 'wiki';
    }
    
    if (!docToken || !docType) {
      message.error('无法从链接中提取有效的文档 token，请检查链接格式');
      return;
    }
    
    // 传递 token 和类型给后端
    onAnalysis(docToken, docType);
  };

  const renderContent = () => {
    // 如果正在获取全量导航数据，显示相应的提示信息
    if (isFetchingFullNavigation) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '20px' }}>
            <div>正在获取全量导航数据</div>
            {fullNavigationNodeCount > 0 && (
              <div style={{ marginTop: '10px', color: 'rgba(255, 255, 255, 0.65)' }}>
                已获取节点数量: {fullNavigationNodeCount}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    // 如果正在分批处理，显示分批处理进度
    if (isBatchProcessing) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '20px' }}>
            <div>正在分批分析超大型知识库</div>
            {batchProgress > 0 && (
              <div style={{ marginTop: '10px', color: 'rgba(255, 255, 255, 0.65)' }}>
                处理进度: {batchProgress}%
              </div>
            )}
            {currentBatchIndex > 0 && (
              <div style={{ marginTop: '10px', color: 'rgba(255, 255, 255, 0.65)' }}>
                当前批次: {currentBatchIndex}
              </div>
            )}
          </div>
          {batchResults && batchResults.length > 0 && (
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#e8e6e3' }}>已完成批次分析结果:</div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
                {batchResults.map((result, index) => (
                  <div key={index} className="batch-result-card" style={{ marginBottom: '10px', padding: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#e8e6e3' }}>批次 {index + 1}:</div>
                    <div style={{ marginTop: '5px' }}>
                      <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    if (loading && !analysisResult && !reasoningContent) {
      return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
    }

    if (reasoningContent && !isReasoningDone) {
        return (
            <div className="reasoning-only">
                <div className="reasoning-content" ref={reasoningRef}>
                    <ReactMarkdown>{reasoningContent}</ReactMarkdown>
                </div>
            </div>
        );
    }

    return (
      <>
        {isReasoningDone && reasoningContent && (
          <Collapse ghost>
            <Panel header="查看 AI 思考过程" key="1">
              <div className="reasoning-content" ref={reasoningRef}>
                <ReactMarkdown>{reasoningContent}</ReactMarkdown>
              </div>
            </Panel>
          </Collapse>
        )}
        {finalSummary && (
          <div className="analysis-result" style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#e8e6e3' }}>最终总结分析:</div>
            <ReactMarkdown>{finalSummary}</ReactMarkdown>
          </div>
        )}
        {analysisResult && (
          <div className="analysis-result">
            <ReactMarkdown>{analysisResult}</ReactMarkdown>
          </div>
        )}
        {loading && isReasoningDone && !analysisResult && (
          <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
        )}
      </>
    );
  };

  return (
    <Modal
      title="文档导入 AI 评估"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      className="doc-analysis-modal"
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Input
          placeholder="请输入飞书文档链接，支持 docx、doc、wiki 类型，例如：https://xxx.feishu.cn/docx/xxxxxxxxxxxxxxx 或 https://xxx.feishu.cn/wiki/xxxxxxxxxxxxxxx"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={{ flex: 1, marginRight: '10px' }}
        />
        <Button 
          className="gradient-purple-btn"
          loading={loading || isFetchingFullNavigation || isBatchProcessing} 
          onClick={handleOk}
          disabled={isFetchingFullNavigation || isBatchProcessing}
        >
          {isFetchingFullNavigation ? '获取全量导航中...' : isBatchProcessing ? '分批处理中...' : '开始评估'}
        </Button>
      </div>
      {renderContent()}
    </Modal>
  );
};

export default DocImportAnalysisModal;
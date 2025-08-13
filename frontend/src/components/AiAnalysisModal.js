import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Collapse, Card, Typography, Spin } from 'antd';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import './docanalysismodal.css';

const { Panel } = Collapse;
const { Text } = Typography;



const AiAnalysisModal = ({ visible, onClose, analysisResult, reasoningContent, isReasoningDone, loading, suggestions, onAnalysis, onRestartAnalysis, isFetchingFullNavigation, fullNavigationNodeCount, isBatchProcessing, batchProgress, batchResults, currentBatchIndex, finalSummary }) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const reasoningRef = useRef(null);

  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoningContent]);

  useEffect(() => {
    if (!visible) {
      setShowReasoning(false);
    }
  }, [visible]);

  // 移除自定义Markdown处理，直接使用原始内容渲染

  // 移除未使用的变量和函数引用

  const renderContent = () => {
    // 如果正在获取全量导航数据，显示相应的提示信息
    if (isFetchingFullNavigation) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '20px' }}>
            <Text>正在获取全量导航数据</Text>
            {fullNavigationNodeCount > 0 && (
              <div style={{ marginTop: '10px' }}>
                <Text type="secondary">已获取节点数量: {fullNavigationNodeCount}</Text>
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
            <Text>正在分批分析超大型知识库</Text>
            {batchProgress > 0 && (
              <div style={{ marginTop: '10px' }}>
                <Text type="secondary">处理进度: {batchProgress}%</Text>
              </div>
            )}
            {currentBatchIndex > 0 && (
              <div style={{ marginTop: '10px' }}>
                <Text type="secondary">当前批次: {currentBatchIndex}</Text>
              </div>
            )}
          </div>
          {batchResults && batchResults.length > 0 && (
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <Text strong>已完成批次分析结果:</Text>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
                {batchResults.map((result, index) => (
                  <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                    <Text strong>批次 {index + 1}:</Text>
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
            <Text strong style={{ marginBottom: '10px', display: 'block' }}>最终总结分析:</Text>
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

  // 判断是否显示开始分析按钮
  const shouldShowStartButton = !loading && !isFetchingFullNavigation && !isBatchProcessing && !analysisResult && !reasoningContent;
  
  // 判断是否显示重新分析按钮
  const shouldShowRestartButton = !loading && !isBatchProcessing && (analysisResult || reasoningContent || finalSummary) && onRestartAnalysis;
  
  // 渲染模态窗底部按钮
  const renderFooter = () => {
    if (shouldShowStartButton) {
      return [
        <Button 
          key="start" 
          className="gradient-purple-btn"
          onClick={onAnalysis}
          disabled={!onAnalysis || isFetchingFullNavigation}
        >
          {isFetchingFullNavigation ? '获取全量导航中...' : '开始分析'}
        </Button>
      ];
    }
    
    if (shouldShowRestartButton) {
      return [
        <Button 
          key="restart" 
          className="gradient-purple-btn"
          onClick={onRestartAnalysis}
          disabled={loading}
        >
          重新分析
        </Button>
      ];
    }
    
    // 默认情况下不显示任何按钮，使用右上角的叉号关闭
    return null;
  };
  
  return (
    <Modal
      title="知识库 AI 诊断"
      visible={visible}
      onCancel={onClose}
      footer={renderFooter()}
      width={800}
      className="doc-analysis-modal"
      destroyOnClose={true}
    >
      {renderContent()}
    </Modal>
  );
};

export default AiAnalysisModal;
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Collapse, Card, Typography, Spin } from 'antd';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import './docanalysismodal.css';

const { Panel } = Collapse;
const { Text } = Typography;



const AiAnalysisModal = ({ visible, onClose, analysisResult, reasoningContent, isReasoningDone, loading, suggestions }) => {
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
      title="知识库 AI 诊断"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      className="doc-analysis-modal"
    >
      {renderContent()}
    </Modal>
  );
};

export default AiAnalysisModal;
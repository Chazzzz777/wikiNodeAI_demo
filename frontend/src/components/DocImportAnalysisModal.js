import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, message, Spin, Collapse } from 'antd';
import ReactMarkdown from 'react-markdown';
import './docanalysismodal.css';

const { Panel } = Collapse;

const DocImportAnalysisModal = ({ visible, onClose, onAnalysis, loading, analysisResult, reasoningContent, isReasoningDone }) => {
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
    const match = docUrl.match(/docx\/([a-zA-Z0-9]+)/);
    if (!match || !match[1]) {
      message.error('无法从链接中提取有效的文档 token，请检查链接格式');
      return;
    }
    const docToken = match[1];
    onAnalysis(docToken);
  };

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
      title="文档导入 AI 评估"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      className="doc-analysis-modal"
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Input
          placeholder="请输入飞书文档链接，例如：https://xxx.feishu.cn/docx/xxxxxxxxxxxxxxx"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={{ flex: 1, marginRight: '10px' }}
        />
        <Button type="primary" loading={loading} onClick={handleOk}>
          开始评估
        </Button>
      </div>
      {renderContent()}
    </Modal>
  );
};

export default DocImportAnalysisModal;
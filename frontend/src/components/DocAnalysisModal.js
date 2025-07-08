import React, { useEffect, useRef } from 'react';
import { Modal, Spin, Typography, Collapse } from 'antd';
import ReactMarkdown from 'react-markdown';
import './docanalysismodal.css';

const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

const processLiveMarkdown = (markdown) => {
    if (!markdown) return '';
    return markdown
        .replace(/<评分-(.*?)>(\d+)<\/评分-\1>/g, '### $1\n**评分: $2**')
        .replace(/<评分理由-(.*?)>([\s\S]*?)<\/评分理由-\1>/g, '#### 评分理由\n$2')
        .replace(/<优化建议>([\s\S]*?)<\/优化建议>/g, '### 优化建议\n$1')
        .replace(/<总结>([\s\S]*?)<\/总结>/g, '### 总结\n$1')
        .replace(/<文档位置合理性分析>([\s\S]*?)<\/文档位置合理性分析>/g, '### 文档位置合理性分析\n$1')
        .replace(/<评分>(\d+)<\/评分>/g, '**评分: $1**')
        .replace(/<文档结构清晰与信息充足性分析>([\s\S]*?)<\/文档结构清晰与信息充足性分析>/g, '### 文档结构清晰与信息充足性分析\n$1')
        .replace(/<文档内容对用户价值分析>([\s\S]*?)<\/文档内容对用户价值分析>/g, '### 文档内容对用户价值分析\n$1')
        .replace(/<文档内容对知识问答参考价值分析>([\s\S]*?)<\/文档内容对知识问答参考价值分析>/g, '### 文档内容对知识问答参考价值分析\n$1')
        .replace(/<总分>(\d+)<\/总分>/g, '**总分: $1**');
};

const DocAnalysisModal = ({ visible, onClose, loading, analysisResult, reasoningContent, isReasoningDone }) => {
    const reasoningRef = useRef(null);

    useEffect(() => {
        if (reasoningRef.current) {
            reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
        }
    }, [reasoningContent]);

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
            title="当前文档 AI 诊断"
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

export default DocAnalysisModal;
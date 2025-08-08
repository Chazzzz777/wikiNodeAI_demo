import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { List, Spin, Typography, Button, message, Input, Card, Space } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import './Wiki.css';

const { Title } = Typography;

function Wiki() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);

  const [hasMore, setHasMore] = useState(true);
  const [pageToken, setPageToken] = useState(null);
  const loading = useRef(false);



  const loadMoreData = useCallback(() => {
    if (loading.current || !hasMore) return;
    loading.current = true;

    const params = { page_size: 20 };
    if (pageToken) {
      params.page_token = pageToken;
    }

    apiClient.get('/api/wiki/spaces', { params })
      .then(response => {
        const { items = [], has_more, page_token } = response.data;
        setSpaces(prevSpaces => [...prevSpaces, ...items]);
        setHasMore(has_more);
        setPageToken(page_token);
      })
      .catch(error => {
        console.error('Error fetching wiki spaces:', error);
        message.error('加载知识空间失败，请稍后重试。');
      })
      .finally(() => {
        loading.current = false;
      });
  }, [pageToken, hasMore]);

  useEffect(() => {
    if (spaces.length === 0) {
      loadMoreData();
    }
  }, [loadMoreData, spaces.length]);

  return (
    <div>
      <header className="wiki-header">
        <Title level={3} className="wiki-title">AI 知识官</Title>
        <div className="api-key-section">
          <Space>
            <Button onClick={() => navigate('/config')}>AI 分析配置</Button>
          </Space>
        </div>
      </header>
      <main className="wiki-content">
        <InfiniteScroll
          dataLength={spaces.length}
          next={loadMoreData}
          hasMore={hasMore}
          loader={<div style={{ textAlign: 'center', padding: '20px 0' }}><Spin tip="加载中..." /></div>}
          endMessage={<div style={{ textAlign: 'center', padding: '20px 0' }}><b>没有更多了</b></div>}
        >
          <List
            className="wiki-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
            dataSource={spaces}
            renderItem={item => (
              <List.Item key={item.space_id}>
                <Card hoverable title={<Link to={`/wiki/${item.space_id}`}>{item.name}</Link>}>
                  {item.description || '暂无描述'}
                </Card>
              </List.Item>
            )}
          />
        </InfiniteScroll>
      </main>
    </div>
  );
}

export default Wiki;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './pages/Auth';
import Wiki from './pages/Wiki';
import WikiDetail from './pages/WikiDetail';
import Config from './pages/Config';
import './App.css';
import GlobalStyle from './styles/GlobalStyle';

function App() {
  return (
    <Router>
      <GlobalStyle />
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/wiki/:spaceId" element={<WikiDetail />} />
          <Route path="/config" element={<Config />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
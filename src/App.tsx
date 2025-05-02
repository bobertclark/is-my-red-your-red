import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Auth } from './pages/auth/index.tsx';
import { Tests } from './pages/tests/index.tsx';
import { Results } from './pages/results/index.tsx';

const App: React.FC = () => {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Tests />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </Router>  
    </div>
  );
};

export default App;

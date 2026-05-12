import { Routes, Route } from 'react-router-dom';
import DocumentList from './pages/DocumentList';
import DocumentEditor from './pages/DocumentEditor';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DocumentList />} />
      <Route path="/doc/:id" element={<DocumentEditor />} />
    </Routes>
  );
}

export default App;

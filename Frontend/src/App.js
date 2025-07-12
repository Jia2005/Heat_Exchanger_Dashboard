import { HashRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./Pages/Dashboard";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
};

export default App;

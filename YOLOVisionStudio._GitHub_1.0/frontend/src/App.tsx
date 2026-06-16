import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProjectListPage from "./pages/ProjectListPage";
import DatasetPage from "./pages/DatasetPage";
import AnnotatePage from "./pages/AnnotatePage";
import TrainPage from "./pages/TrainPage";
import ModelsPage from "./pages/ModelsPage";
import InferencePage from "./pages/InferencePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  // Heartbeat: tells the launcher browser is still open
  useEffect(() => {
    const beat = () => { fetch("http://127.0.0.1:8618/api/system/heartbeat").catch(() => {}); };
    beat();
    const id = setInterval(beat, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ProjectListPage />} />
        <Route path="project/:id/dataset" element={<DatasetPage />} />
        <Route path="project/:id/annotate" element={<AnnotatePage />} />
        <Route path="project/:id/train" element={<TrainPage />} />
        <Route path="project/:id/models" element={<ModelsPage />} />
        <Route path="project/:id/inference" element={<InferencePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

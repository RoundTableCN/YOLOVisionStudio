import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Model } from "@/types";
import { ArrowLeft, Upload, Trash2, Box, Cpu } from "lucide-react";

export default function ModelsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchModels = () => {
    api.get<{ items: Model[]; total: number }>(`/api/projects/${projectId}/models/`)
      .then((data) => setModels(data.items))
      .catch(() => {});
  };

  useEffect(() => { fetchModels(); }, [projectId]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", String(projectId));
      await fetch("http://127.0.0.1:8618/api/projects/" + projectId + "/models/import", {
        method: "POST",
        body: formData,
      });
      fetchModels();
    } catch (err) { console.error(err); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const handleDelete = async (modelId: number) => {
    if (!confirm("确定删除此模型？")) return;
    await api.delete(`/api/projects/${projectId}/models/${modelId}`);
    fetchModels();
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-gray-800 rounded-md">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-2xl font-bold">模型</h2>
        <label className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm cursor-pointer">
          <Upload size={14} className="inline mr-2" />
          {importing ? "导入中..." : "导入模型"}
          <input type="file" accept=".pt" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
      </div>

      {models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Box size={48} className="mb-4" />
          <p className="text-lg">暂无模型</p>
          <p className="text-sm mt-1">训练完成后模型将出现在此处，或手动导入 .pt 文件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5 group hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <Cpu size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{m.name}</h3>
                    <p className="text-xs text-gray-500">{m.base_model}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{m.is_trained ? "已训练" : "预训练"}</span>
                <span>{m.created_at ? new Date(m.created_at).toLocaleDateString("zh-CN") : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

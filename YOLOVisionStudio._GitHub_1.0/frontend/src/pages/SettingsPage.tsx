import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { GPUInfo } from "@/types";
import { Trash2, Cpu, HardDrive, Monitor } from "lucide-react";

export default function SettingsPage() {
  const [backendStatus, setBackendStatus] = useState<string>("checking...");
  const [gpu, setGpu] = useState<GPUInfo>({
    available: false, name: null, memory_total_mb: null,
    memory_used_mb: null, utilization_pct: null, temperature_c: null,
  });
  const [clearing, setClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState("");

  const [defaultModel, setDefaultModel] = useState("yolov8n");
  const [defaultEpochs, setDefaultEpochs] = useState(100);
  const [defaultBatch, setDefaultBatch] = useState(8);
  const [defaultImgsz, setDefaultImgsz] = useState(640);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const data = await api.get<{ status: string }>("/api/health");
          if (!cancelled) setBackendStatus(data.status);
          return;
        } catch {
          if (!cancelled) setBackendStatus(i === 0 ? "connecting..." : `connecting... (${i+1}/20)`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!cancelled) setBackendStatus("unreachable");
    };
    checkHealth();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    api.get<GPUInfo>("/api/system/gpu")
      .then(setGpu)
      .catch(() => {});
    api.get<Record<string, string>>("/api/system/config")
      .then((config) => {
        if (config.default_model) setDefaultModel(config.default_model);
        if (config.default_epochs) setDefaultEpochs(Number(config.default_epochs));
        if (config.default_batch) setDefaultBatch(Number(config.default_batch));
        if (config.default_imgsz) setDefaultImgsz(Number(config.default_imgsz));
      })
      .catch(() => {});
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await api.post("/api/system/cache/clear");
      setCacheMsg("缓存已清理");
    } catch { setCacheMsg("清理失败"); }
    finally { setClearing(false); }
  };

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      await api.put("/api/system/config", { key: "default_model", value: defaultModel });
      await api.put("/api/system/config", { key: "default_epochs", value: String(defaultEpochs) });
      await api.put("/api/system/config", { key: "default_batch", value: String(defaultBatch) });
      await api.put("/api/system/config", { key: "default_imgsz", value: String(defaultImgsz) });
      setCacheMsg("默认参数已保存");
    } catch { setCacheMsg("保存失败"); }
    finally { setSaving(false); setTimeout(() => setCacheMsg(""), 3000); }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">设置</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backend Status */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3"><Monitor size={18} className="text-gray-400" /><h3 className="font-semibold">系统状态</h3></div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-gray-400">后端服务</span>
              <span className={`text-sm ${backendStatus === "ok" ? "text-green-400" : "text-red-400"}`}>{backendStatus}</span>
            </div>
          </div>
        </div>

        {/* GPU Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3"><Cpu size={18} className="text-gray-400" /><h3 className="font-semibold">GPU 信息</h3></div>
          {gpu.available ? (
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-gray-400">型号</span><span className="text-sm">{gpu.name}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-400">利用率</span><span className="text-sm">{gpu.utilization_pct}%</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-400">显存</span><span className="text-sm">{gpu.memory_used_mb} / {gpu.memory_total_mb} MB</span></div>
              {gpu.temperature_c && <div className="flex justify-between"><span className="text-sm text-gray-400">温度</span><span className="text-sm">{gpu.temperature_c}°C</span></div>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">无可用 GPU</p>
          )}
        </div>

        {/* Cache */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3"><HardDrive size={18} className="text-gray-400" /><h3 className="font-semibold">缓存管理</h3></div>
          <p className="text-sm text-gray-400 mb-3">清理模型缓存和临时推理输出文件</p>
          <button onClick={handleClearCache} disabled={clearing}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50">
            <Trash2 size={14} /> {clearing ? "清理中..." : "清理缓存"}
          </button>
          {cacheMsg && <p className="text-xs text-green-400 mt-2">{cacheMsg}</p>}
        </div>

        {/* Default Training Params */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3"><Cpu size={18} className="text-gray-400" /><h3 className="font-semibold">默认训练参数</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">默认模型</label>
              <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none">
                <option value="yolov8n">YOLOv8 Nano</option>
                <option value="yolov8s">YOLOv8 Small</option>
                <option value="yolov8m">YOLOv8 Medium</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">默认 Epochs</label>
              <input type="number" value={defaultEpochs} onChange={(e) => setDefaultEpochs(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">默认 Batch</label>
              <input type="number" value={defaultBatch} onChange={(e) => setDefaultBatch(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">默认 Image Size</label>
              <input type="number" value={defaultImgsz} onChange={(e) => setDefaultImgsz(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none" />
            </div>
          </div>
          <button onClick={handleSaveDefaults} disabled={saving}
            className="mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50">
            {saving ? "保存中..." : "保存默认参数"}
          </button>
          {cacheMsg && <p className="text-xs text-green-400 mt-2">{cacheMsg}</p>}
        </div>
      </div>
    </div>
  );
}

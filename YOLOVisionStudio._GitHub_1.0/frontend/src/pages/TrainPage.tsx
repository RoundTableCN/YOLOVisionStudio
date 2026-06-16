import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useWebSocket, type WSMessage } from "@/hooks/useWebSocket";
import type { GPUInfo } from "@/types";
import { ArrowLeft, Play, Square } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface MetricPoint {
  epoch: number;
  loss: number;
  mAP50: number;
  precision: number;
  recall: number;
}

const MODEL_OPTIONS = [
  { value: "yolov8n", label: "YOLOv8 Nano" },
  { value: "yolov8s", label: "YOLOv8 Small" },
  { value: "yolov8m", label: "YOLOv8 Medium" },
];

export default function TrainPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  const [status, setStatus] = useState<string>("idle");
  const [gpu, setGpu] = useState<GPUInfo>({
    available: false, name: null, memory_total_mb: null,
    memory_used_mb: null, utilization_pct: null, temperature_c: null,
  });
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);

  const [params, setParams] = useState({
    model: "yolov8n",
    epochs: 100,
    batch_size: 8,
    image_size: 640,
    gpu_enabled: true,
  });

  const [wsUrl, setWsUrl] = useState<string | null>(null);

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "epoch") {
      setCurrentEpoch(msg.epoch);
      setTotalEpochs(msg.total_epochs);
      setMetrics((prev) => [
        ...prev,
        {
          epoch: msg.epoch,
          loss: msg.loss || 0,
          mAP50: msg.mAP50 || 0,
          precision: msg.precision || 0,
          recall: msg.recall || 0,
        },
      ].slice(-200));
    } else if (msg.type === "gpu") {
      setGpu({
        available: msg.available || false,
        name: msg.name || null,
        memory_total_mb: msg.memory_total_mb ?? null,
        memory_used_mb: msg.memory_used_mb ?? null,
        utilization_pct: msg.utilization_pct ?? null,
        temperature_c: msg.temperature_c ?? null,
      });
    } else if (msg.type === "status") {
      setStatus(msg.status);
      setLogLines((prev) =>
        [...prev, `[${new Date().toLocaleTimeString()}] ${msg.message || msg.status}`].slice(-100)
      );
      if (msg.model_path) {
        setLogLines((prev) => [...prev, `Model saved: ${msg.model_path}`]);
      }
    }
  }, []);

  const { disconnect } = useWebSocket(wsUrl, handleMessage);

  const checkStatus = async () => {
    try {
      const data = await api.get<any>(`/api/projects/${projectId}/train/status`);
      setStatus(data.status || "idle");
      if (data.gpu) setGpu(data.gpu);
    } catch {}
  };

  useEffect(() => { checkStatus(); }, [projectId]);

  const handleStart = async () => {
    setMetrics([]);
    setLogLines([]);
    setCurrentEpoch(0);
    try {
      await api.post(`/api/projects/${projectId}/train/start`, params);
      setStatus("starting");
      setWsUrl(`ws://127.0.0.1:8618/api/projects/${projectId}/train/ws`);
    } catch (e: any) {
      setLogLines((prev) => [...prev, `Error: ${e.message}`]);
    }
  };

  const handleStop = async () => {
    try {
      await api.post(`/api/projects/${projectId}/train/stop`);
    } catch {}
    disconnect();
    setWsUrl(null);
    setStatus("stopped");
  };

  const isRunning = status === "running" || status === "starting" || status === "preparing";

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/project/${projectId}/models`)} className="p-2 hover:bg-gray-800 rounded-md">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-2xl font-bold">训练</h2>
      </div>

      {/* Parameter Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-sm font-semibold mb-4">训练参数</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">模型</label>
            <select
              value={params.model}
              onChange={(e) => setParams((p) => ({ ...p, model: e.target.value }))}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Epochs</label>
            <input
              type="number"
              value={params.epochs}
              onChange={(e) => setParams((p) => ({ ...p, epochs: Number(e.target.value) }))}
              disabled={isRunning}
              min={1} max={1000}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Batch Size</label>
            <input
              type="number"
              value={params.batch_size}
              onChange={(e) => setParams((p) => ({ ...p, batch_size: Number(e.target.value) }))}
              disabled={isRunning}
              min={1} max={128}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Image Size</label>
            <input
              type="number"
              value={params.image_size}
              onChange={(e) => setParams((p) => ({ ...p, image_size: Number(e.target.value) }))}
              disabled={isRunning}
              min={320} max={1280} step={32}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-end gap-2">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors w-full justify-center"
              >
                <Square size={14} /> 停止训练
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors w-full justify-center"
              >
                <Play size={14} /> 开始训练
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GPU + Progress */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">GPU</p>
          <p className="text-lg font-bold">{gpu.available ? `${gpu.utilization_pct}%` : "N/A"}</p>
          {gpu.available && (
            <p className="text-xs text-gray-500 mt-1">VRAM: {gpu.memory_used_mb}/{gpu.memory_total_mb} MB</p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Epoch</p>
          <p className="text-lg font-bold">{currentEpoch}/{totalEpochs || "-"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">状态</p>
          <p className={`text-lg font-bold ${isRunning ? "text-green-400" : "text-gray-400"}`}>
            {status === "idle" ? "空闲" : status === "running" ? "训练中" : status}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">设备</p>
          <p className="text-lg font-bold">{gpu.available ? (gpu.name || "GPU") : "CPU"}</p>
        </div>
      </div>

      {/* Charts */}
      {metrics.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-sm font-semibold mb-4">训练曲线</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">Loss</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="epoch" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "#9ca3af" }} />
                  <Line type="monotone" dataKey="loss" stroke="#ef4444" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">mAP50 / Precision / Recall</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="epoch" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} domain={[0, 1]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "#9ca3af" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="mAP50" stroke="#3b82f6" dot={false} strokeWidth={2} name="mAP50" />
                  <Line type="monotone" dataKey="precision" stroke="#22c55e" dot={false} strokeWidth={2} name="Precision" />
                  <Line type="monotone" dataKey="recall" stroke="#f59e0b" dot={false} strokeWidth={2} name="Recall" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Log Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold mb-3">训练日志</h3>
        <div className="bg-gray-950 rounded p-3 h-48 overflow-y-auto font-mono text-xs">
          {logLines.length === 0 ? (
            <p className="text-gray-600">等待训练开始...</p>
          ) : (
            logLines.map((line, i) => (
              <p key={i} className="text-gray-400 py-0.5">{line}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

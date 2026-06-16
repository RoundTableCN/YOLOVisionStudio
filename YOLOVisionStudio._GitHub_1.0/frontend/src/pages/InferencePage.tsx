import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { DetectionResult } from "@/types";
import { ArrowLeft, Upload, Video, Camera, Play, Square, Download } from "lucide-react";

type Tab = "image" | "video" | "camera";

export default function InferencePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("image");

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 flex-shrink-0">
        <button onClick={() => navigate(`/project/${projectId}/models`)} className="p-1 hover:bg-gray-700 rounded">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-sm font-semibold">推理</h2>
        <div className="flex gap-1 ml-4">
          {(["image", "video", "camera"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-xs ${tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
            >
              {t === "image" ? "图片" : t === "video" ? "视频" : "摄像头"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "image" && <ImageTab projectId={projectId} />}
        {tab === "video" && <VideoTab projectId={projectId} />}
        {tab === "camera" && <CameraTab projectId={projectId} />}
      </div>
    </div>
  );
}

function ImageTab({ projectId }: { projectId: number }) {
  const allClassIds = CLASS_CATEGORIES.flatMap(cat => cat.classes.map(c => c.id));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [annotatedSrc, setAnnotatedSrc] = useState<string>("");
  const [annotatedPath, setAnnotatedPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [modelName, setModelName] = useState("yolov8n");
  const [workspaceModels, setWorkspaceModels] = useState<{name:string,path:string}[]>([]);
  const [enabledClasses, setEnabledClasses] = useState<Set<number>>(new Set(allClassIds));
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    fetch(`http://127.0.0.1:8618/api/projects/${projectId}/models/workspace/scan`)
      .then(r => r.json()).then(d => { if (d.files) setWorkspaceModels(d.files); }).catch(() => {});
  }, [projectId]);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f); setDetections([]); setAnnotatedSrc(""); setAnnotatedPath("");
    const url = URL.createObjectURL(f);
    setPreview(url);
    const img = new Image();
    img.onload = () => setImageSize({ w: img.width, h: img.height });
    img.src = url;
  };

  const handleInfer = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", String(projectId));
      formData.append("model_name", modelName);
      formData.append("class_ids", [...enabledClasses].join(","));
      const res = await fetch("http://127.0.0.1:8618/api/inference/image", { method: "POST", body: formData });
      const data = await res.json();
      setDetections(data.detections || []);
      if (data.annotated_path) {
        setAnnotatedPath(data.annotated_path);
        setAnnotatedSrc(`http://127.0.0.1:8618/api/inference/annotated/${encodeURIComponent(data.annotated_path.replace(/\\/g, '/'))}`);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleClassImage = (id: number) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategoryImage = (cat: typeof CLASS_CATEGORIES[0]) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      const ids = cat.classes.map(c => c.id);
      ids.every(id => next.has(id)) ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAllImage = () => setEnabledClasses(new Set(allClassIds));
  const deselectAllImage = () => setEnabledClasses(new Set<number>());

  const openFolder = async () => {
    if (!annotatedPath) return;
    const lastSep = Math.max(annotatedPath.lastIndexOf('\\'), annotatedPath.lastIndexOf('/'));
    const dir = lastSep > -1 ? annotatedPath.substring(0, lastSep) : annotatedPath;
    const res = await fetch("http://127.0.0.1:8618/api/system/open-folder", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({path: dir}),
    });
    if (!res.ok) { console.error("打开文件夹失败: HTTP", res.status); return; }
    const data = await res.json();
    if (data.status !== "ok") { console.error("打开文件夹失败:", data.message); }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm cursor-pointer">
          <Upload size={14} className="inline mr-2" /> 选择图片
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </label>
        <select value={modelName} onChange={e => setModelName(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none">
          {workspaceModels.map(m => <option key={m.path} value={m.name}>{m.name} (已训练)</option>)}
          <option value="yolov8n">YOLOv8 Nano</option>
          <option value="yolov8s">YOLOv8 Small</option>
          <option value="yolov8m">YOLOv8 Medium</option>
        </select>
        <button onClick={handleInfer} disabled={!file || loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm">
          <Play size={14} className="inline mr-2" />{loading ? "检测中..." : "开始检测"}
        </button>
        {annotatedPath && (
          <button onClick={openFolder} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            打开文件夹
          </button>
        )}
      </div>
      <div className="mb-4">
        <button onClick={() => setShowFilter(!showFilter)} className="text-xs text-gray-500 hover:text-gray-300 mb-2">
          {showFilter?"收起":"展开"}类别筛选 ({enabledClasses.size}/{allClassIds.length})
        </button>
        {showFilter && (
          <div className="bg-gray-900 rounded p-3 border border-gray-800 max-h-64 overflow-y-auto space-y-3">
            <div className="flex gap-2">
              <button onClick={selectAllImage} className="px-2 py-0.5 text-xs bg-blue-600 rounded hover:bg-blue-500">全选</button>
              <button onClick={deselectAllImage} className="px-2 py-0.5 text-xs bg-gray-700 rounded hover:bg-gray-600">全不选</button>
            </div>
            {CLASS_CATEGORIES.map(cat => {
              const catIds = cat.classes.map(c => c.id);
              const on = catIds.filter(id => enabledClasses.has(id)).length;
              return (
                <div key={cat.name}>
                  <button onClick={() => toggleCategoryImage(cat)}
                    className={`text-xs font-medium mb-1 px-1 rounded ${on===catIds.length?"text-green-400":on>0?"text-yellow-400":"text-gray-500"}`}>
                    {cat.name} ({on}/{catIds.length})
                  </button>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {cat.classes.map(c => (
                      <button key={c.id} onClick={() => toggleClassImage(c.id)}
                        className={`px-1.5 py-0.5 text-xs rounded ${enabledClasses.has(c.id)?"bg-green-700 text-green-200":"bg-gray-800 text-gray-500"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-gray-500 mb-2">原图</p>
          {preview ? (
            <div className="relative bg-gray-900 rounded-lg overflow-hidden">
              <img src={preview} alt="preview" className="max-w-full" />
              {detections.length > 0 && (
                <div className="absolute inset-0">
                  {detections.map((d, i) => (
                    <div key={i} className="absolute border-2 border-red-400 bg-red-400/10"
                      style={{ left: `${(d.x1 / imageSize.w) * 100}%`, top: `${(d.y1 / imageSize.h) * 100}%`, width: `${((d.x2 - d.x1) / imageSize.w) * 100}%`, height: `${((d.y2 - d.y1) / imageSize.h) * 100}%` }}>
                      <span className="absolute -top-5 left-0 text-xs bg-red-500 px-1 rounded">{d.class_name} {Math.round(d.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg h-64 flex items-center justify-center text-gray-500">选择图片</div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-2">检测结果</p>
          {annotatedSrc ? <img src={annotatedSrc} alt="annotated" className="max-w-full rounded-lg" /> : (
            <div className="bg-gray-900 rounded-lg h-64 flex items-center justify-center text-gray-500">等待检测</div>
          )}
        </div>
      </div>
      {detections.length > 0 && (
        <div className="mt-4 bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">检测详情 ({detections.length})</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {detections.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-800 rounded px-3 py-1">
                <span>{d.class_name}</span>
                <span className="text-gray-400">{(d.confidence * 100).toFixed(1)}%</span>
                <span className="text-gray-500">[{d.x1},{d.y1}] [{d.x2},{d.y2}]</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoTab({ projectId }: { projectId: number }) {
  const allClassIds = CLASS_CATEGORIES.flatMap(cat => cat.classes.map(c => c.id));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ frame: 0, total: 0 });
  const [status, setStatus] = useState<string>("idle");
  const [outputPath, setOutputPath] = useState<string>("");
  const [modelName, setModelName] = useState("yolov8n");
  const [workspaceModels, setWorkspaceModels] = useState<{name:string,path:string}[]>([]);
  const [enabledClasses, setEnabledClasses] = useState<Set<number>>(new Set(allClassIds));
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    fetch(`http://127.0.0.1:8618/api/projects/${projectId}/models/workspace/scan`)
      .then(r => r.json()).then(d => { if (d.files) setWorkspaceModels(d.files); }).catch(() => {});
  }, [projectId]);

  const handleInfer = async () => {
    if (!file) return;
    setLoading(true); setStatus("uploading"); setOutputPath("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", String(projectId));
      formData.append("model_name", modelName);
      formData.append("class_ids", [...enabledClasses].join(","));
      const res = await fetch("http://127.0.0.1:8618/api/inference/video", { method: "POST", body: formData });
      const data = await res.json();
      setStatus("processing");
      const ws = new WebSocket(`ws://127.0.0.1:8618/api/inference/ws/video/${data.task_id}`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "progress") { setProgress({ frame: msg.frame, total: msg.total }); }
        else if (msg.type === "complete") { setStatus("done"); setOutputPath(msg.output_path); setLoading(false); ws.close(); }
        else if (msg.type === "error") { setStatus("error"); setLoading(false); ws.close(); }
      };
    } catch (e) { console.error(e); setLoading(false); }
  };

  const toggleClassVideo = (id: number) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategoryVideo = (cat: typeof CLASS_CATEGORIES[0]) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      const ids = cat.classes.map(c => c.id);
      ids.every(id => next.has(id)) ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAllVideo = () => setEnabledClasses(new Set(allClassIds));
  const deselectAllVideo = () => setEnabledClasses(new Set<number>());

  const openFolder = async () => {
    if (!outputPath) return;
    const lastSep = Math.max(outputPath.lastIndexOf('\\'), outputPath.lastIndexOf('/'));
    const dir = lastSep > -1 ? outputPath.substring(0, lastSep) : outputPath;
    const res = await fetch("http://127.0.0.1:8618/api/system/open-folder", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({path: dir}),
    });
    if (!res.ok) { setStatus("error"); return; }
    const data = await res.json();
    if (data.status !== "ok") { setStatus("error"); console.error("打开文件夹失败:", data.message); }
  };

  const pct = progress.total > 0 ? Math.round((progress.frame / progress.total) * 100) : 0;
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm cursor-pointer">
          <Video size={14} className="inline mr-2" /> 选择视频
          <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <select value={modelName} onChange={e => setModelName(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none">
          {workspaceModels.map(m => <option key={m.path} value={m.name}>{m.name} (已训练)</option>)}
          <option value="yolov8n">YOLOv8 Nano</option>
          <option value="yolov8s">YOLOv8 Small</option>
          <option value="yolov8m">YOLOv8 Medium</option>
        </select>
        <button onClick={handleInfer} disabled={!file || loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm">
          <Play size={14} className="inline mr-2" />{loading ? "处理中..." : "开始推理"}
        </button>
        {file && <span className="text-xs text-gray-400 ml-2">{file.name}</span>}
      </div>
      <div className="mb-4">
        <button onClick={() => setShowFilter(!showFilter)} className="text-xs text-gray-500 hover:text-gray-300 mb-2">
          {showFilter?"收起":"展开"}类别筛选 ({enabledClasses.size}/{allClassIds.length})
        </button>
        {showFilter && (
          <div className="bg-gray-900 rounded p-3 border border-gray-800 max-h-64 overflow-y-auto space-y-3">
            <div className="flex gap-2">
              <button onClick={selectAllVideo} className="px-2 py-0.5 text-xs bg-blue-600 rounded hover:bg-blue-500">全选</button>
              <button onClick={deselectAllVideo} className="px-2 py-0.5 text-xs bg-gray-700 rounded hover:bg-gray-600">全不选</button>
            </div>
            {CLASS_CATEGORIES.map(cat => {
              const catIds = cat.classes.map(c => c.id);
              const on = catIds.filter(id => enabledClasses.has(id)).length;
              return (
                <div key={cat.name}>
                  <button onClick={() => toggleCategoryVideo(cat)}
                    className={`text-xs font-medium mb-1 px-1 rounded ${on===catIds.length?"text-green-400":on>0?"text-yellow-400":"text-gray-500"}`}>
                    {cat.name} ({on}/{catIds.length})
                  </button>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {cat.classes.map(c => (
                      <button key={c.id} onClick={() => toggleClassVideo(c.id)}
                        className={`px-1.5 py-0.5 text-xs rounded ${enabledClasses.has(c.id)?"bg-green-700 text-green-200":"bg-gray-800 text-gray-500"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {(status === "processing" || status === "done") && (
        <div className="bg-gray-900 rounded-lg p-6 mb-4">
          <div className="mb-2 flex justify-between text-xs text-gray-400">
            <span>{status === "done" ? "完成" : `处理中... ${pct}%`}</span>
            <span>{progress.frame}/{progress.total || "?"} 帧</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-600 h-full transition-all duration-300 rounded-full" style={{ width: `${status === "done" ? 100 : pct}%` }} />
          </div>
        </div>
      )}
      {status === "done" && outputPath && (
        <div className="flex items-center gap-3">
          <button onClick={openFolder} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            打开文件夹
          </button>
          <span className="text-xs text-gray-400">文件保存在 outputs 目录</span>
        </div>
      )}
    </div>
  );
}

const CLASS_CATEGORIES = [{name:"人",classes:[{id:0,name:"person"}]},{name:"车辆",classes:[{id:1,name:"bicycle"},{id:2,name:"car"},{id:3,name:"motorcycle"},{id:4,name:"airplane"},{id:5,name:"bus"},{id:6,name:"train"},{id:7,name:"truck"},{id:8,name:"boat"}]},{name:"动物",classes:[{id:14,name:"bird"},{id:15,name:"cat"},{id:16,name:"dog"},{id:17,name:"horse"},{id:18,name:"sheep"},{id:19,name:"cow"},{id:20,name:"elephant"},{id:21,name:"bear"},{id:22,name:"zebra"},{id:23,name:"giraffe"}]},{name:"电子产品",classes:[{id:62,name:"tv"},{id:63,name:"laptop"},{id:64,name:"mouse"},{id:65,name:"remote"},{id:66,name:"keyboard"},{id:67,name:"cell phone"}]},{name:"食物",classes:[{id:39,name:"bottle"},{id:40,name:"wine glass"},{id:41,name:"cup"},{id:42,name:"fork"},{id:43,name:"knife"},{id:44,name:"spoon"},{id:45,name:"bowl"},{id:46,name:"banana"},{id:47,name:"apple"},{id:48,name:"sandwich"},{id:49,name:"orange"},{id:50,name:"broccoli"},{id:51,name:"carrot"},{id:52,name:"hot dog"},{id:53,name:"pizza"},{id:54,name:"donut"},{id:55,name:"cake"}]},{name:"家具",classes:[{id:56,name:"chair"},{id:57,name:"couch"},{id:58,name:"potted plant"},{id:59,name:"bed"},{id:60,name:"dining table"},{id:61,name:"toilet"}]},{name:"厨房",classes:[{id:68,name:"microwave"},{id:69,name:"oven"},{id:70,name:"toaster"},{id:71,name:"sink"},{id:72,name:"refrigerator"}]},{name:"配饰/运动",classes:[{id:24,name:"backpack"},{id:25,name:"umbrella"},{id:26,name:"handbag"},{id:27,name:"tie"},{id:28,name:"suitcase"},{id:29,name:"frisbee"},{id:30,name:"skis"},{id:31,name:"snowboard"},{id:32,name:"sports ball"},{id:33,name:"kite"},{id:34,name:"baseball bat"},{id:35,name:"baseball glove"},{id:36,name:"skateboard"},{id:37,name:"surfboard"},{id:38,name:"tennis racket"}]},{name:"其他",classes:[{id:9,name:"traffic light"},{id:10,name:"fire hydrant"},{id:11,name:"stop sign"},{id:12,name:"parking meter"},{id:13,name:"bench"},{id:73,name:"book"},{id:74,name:"clock"},{id:75,name:"vase"},{id:76,name:"scissors"},{id:77,name:"teddy bear"},{id:78,name:"hair drier"},{id:79,name:"toothbrush"}]}];

function CameraTab({ projectId }: { projectId: number }) {
  const allClassIds = CLASS_CATEGORIES.flatMap(cat => cat.classes.map(c => c.id));
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [cameraId, setCameraId] = useState(0);
  const [cameras, setCameras] = useState<{id:number,name:string}[]>([]);
  const [modelName, setModelName] = useState("yolov8n");
  const [enabledClasses, setEnabledClasses] = useState<Set<number>>(new Set(allClassIds));
  const [showFilter, setShowFilter] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const sendFilter = (ws: WebSocket | null, enabled: Set<number>) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "filter", class_ids: [...enabled] }));
    }
  };

  const start = () => {
    setStreaming(true);
    const ws = new WebSocket(`ws://127.0.0.1:8618/api/inference/ws/camera?project_id=${projectId}&camera_id=${cameraId}&model_name=${modelName}`);
    wsRef.current = ws;
    ws.onopen = () => sendFilter(ws, enabledClasses);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.frame) {
        if (!imgRef.current) imgRef.current = new Image();
        imgRef.current.src = `data:image/jpeg;base64,${data.frame}`;
        setFps(data.fps || 0);
        setDetections(data.detections || []);
      }
    };
    ws.onerror = () => stop();
    ws.onclose = () => setStreaming(false);
  };

  const stop = () => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ action: "stop" })); } catch {}
      wsRef.current.close();
    }
    setStreaming(false);
    setFps(0);
  };

  const toggleClass = (id: number) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      sendFilter(wsRef.current, next);
      return next;
    });
  };

  const toggleCategory = (cat: typeof CLASS_CATEGORIES[0]) => {
    setEnabledClasses(prev => {
      const next = new Set(prev);
      const ids = cat.classes.map(c => c.id);
      ids.every(id => next.has(id)) ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      sendFilter(wsRef.current, next);
      return next;
    });
  };

  const selectAll = () => { const s = new Set(allClassIds); setEnabledClasses(s); sendFilter(wsRef.current, s); };
  const deselectAll = () => { const s = new Set<number>(); setEnabledClasses(s); sendFilter(wsRef.current, s); };

  useEffect(() => { return () => stop(); }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8618/api/system/cameras")
      .then(r => r.json()).then(d => {
        if (d.cameras?.length > 0) { setCameras(d.cameras); setCameraId(d.cameras[0].id); }
      }).catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <select value={cameraId} onChange={e => setCameraId(Number(e.target.value))} disabled={streaming}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50">
          {cameras.length === 0 ? <option value={0}>No camera</option>
            : cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={modelName} onChange={e => setModelName(e.target.value)} disabled={streaming}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none disabled:opacity-50">
          <option value="yolov8n">YOLOv8 Nano</option><option value="yolov8s">YOLOv8 Small</option><option value="yolov8m">YOLOv8 Medium</option>
        </select>
        {streaming ? (
          <button onClick={stop} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"><Square size={14}/>停止</button>
        ) : (
          <button onClick={start} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"><Camera size={14}/>开启摄像头</button>
        )}
        {streaming && <span className="text-sm text-green-400 font-mono">FPS: {fps}</span>}
        {streaming && detections.length > 0 && <span className="text-xs text-gray-400">检测: {detections.length}目标</span>}
      </div>
      <div className="bg-gray-900 rounded-lg overflow-hidden" style={{minHeight:360}}>
        {!streaming && <div className="flex items-center justify-center h-80 text-gray-500 text-sm">点击「开启摄像头」开始</div>}
        <img ref={imgRef} alt="camera" className="max-w-full" style={{display:streaming?"block":"none"}}/>
      </div>
      <div className="mt-4">
        <button onClick={() => setShowFilter(!showFilter)} className="text-xs text-gray-500 hover:text-gray-300 mb-2">
          {showFilter?"收起":"展开"}类别筛选({enabledClasses.size}/{allClassIds.length})
        </button>
        {showFilter && (
          <div className="bg-gray-900 rounded p-3 border border-gray-800 max-h-64 overflow-y-auto space-y-3">
            <div className="flex gap-2">
              <button onClick={selectAll} className="px-2 py-0.5 text-xs bg-blue-600 rounded hover:bg-blue-500">全选</button>
              <button onClick={deselectAll} className="px-2 py-0.5 text-xs bg-gray-700 rounded hover:bg-gray-600">全不选</button>
            </div>
            {CLASS_CATEGORIES.map(cat => {
              const catIds = cat.classes.map(c => c.id);
              const on = catIds.filter(id => enabledClasses.has(id)).length;
              return (
                <div key={cat.name}>
                  <button onClick={() => toggleCategory(cat)}
                    className={`text-xs font-medium mb-1 px-1 rounded ${on===catIds.length?"text-green-400":on>0?"text-yellow-400":"text-gray-500"}`}>
                    {cat.name} ({on}/{catIds.length})
                  </button>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {cat.classes.map(c => (
                      <button key={c.id} onClick={() => toggleClass(c.id)}
                        className={`px-1.5 py-0.5 text-xs rounded ${enabledClasses.has(c.id)?"bg-green-700 text-green-200":"bg-gray-800 text-gray-500"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

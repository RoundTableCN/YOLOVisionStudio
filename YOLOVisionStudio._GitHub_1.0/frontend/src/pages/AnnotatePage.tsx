import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Image as ImageType, Annotation, Label } from "@/types";
import { ArrowLeft, ZoomIn, ZoomOut, Save } from "lucide-react";
import FabricCanvas from "@/components/FabricCanvas";
import LabelSidebar from "@/components/LabelSidebar";
import ImageStrip from "@/components/ImageStrip";

export default function AnnotatePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  const [images, setImages] = useState<ImageType[]>([]);
  const [currentImage, setCurrentImage] = useState<ImageType | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.get<{ items: ImageType[]; total: number }>(
      `/api/projects/${projectId}/datasets/?page_size=200`
    ).then((data) => {
      setImages(data.items);
      if (data.items.length > 0 && !currentImage) {
        setCurrentImage(data.items[0]);
      }
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    api.get<{ items: Label[]; total: number }>(`/api/projects/${projectId}/labels/`)
      .then((data) => setLabels(data.items))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!currentImage) return;
    api.get<{ items: Annotation[] }>(
      `/api/projects/${projectId}/annotations/?image_id=${currentImage.id}`
    ).then((data) => setAnnotations(data.items))
      .catch(() => setAnnotations([]));
    setDirty(false);
  }, [currentImage, projectId]);

  const handleSave = useCallback(async () => {
    if (!currentImage) return;
    setSaving(true);
    try {
      await api.post(`/api/projects/${projectId}/annotations/`, {
        image_id: currentImage.id,
        annotations: annotations.map((a) => ({
          label_id: a.label_id,
          x_center: a.x_center,
          y_center: a.y_center,
          width: a.width,
          height: a.height,
        })),
      });
      setDirty(false);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [currentImage, annotations, projectId]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handleSave]);

  const handleCreateLabel = async (name: string, color: string) => {
    try {
      const data = await api.post<Label>(`/api/projects/${projectId}/labels/`, { name, color });
      setLabels((prev) => [...prev, data]);
    } catch (e) { console.error(e); }
  };

  const handleUpdateLabel = async (labelId: number, name: string, color: string) => {
    try {
      const data = await api.put<Label>(`/api/projects/${projectId}/labels/${labelId}`, { name, color });
      setLabels((prev) => prev.map((l) => (l.id === labelId ? data : l)));
    } catch (e) { console.error(e); }
  };

  const handleDeleteLabel = async (labelId: number) => {
    if (!confirm("确定删除此类别？关联标注将被删除。")) return;
    try {
      await api.delete(`/api/projects/${projectId}/labels/${labelId}`);
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
    } catch (e) { console.error(e); }
  };

  const imageUrl = currentImage
    ? `http://127.0.0.1:8618/api/image/${encodeURIComponent(currentImage.original_path)}`
    : "";

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/project/${projectId}/dataset`)} className="p-1 hover:bg-gray-700 rounded">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-sm font-semibold">
            {currentImage ? currentImage.filename : "标注"}
          </h2>
          {dirty && <span className="text-xs text-yellow-500">未保存</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
            className="p-1 hover:bg-gray-700 rounded"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(5, z + 0.1))}
            className="p-1 hover:bg-gray-700 rounded"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs"
          >
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {currentImage && (
              <FabricCanvas
                imageUrl={imageUrl}
                imageWidth={currentImage.width}
                imageHeight={currentImage.height}
                annotations={annotations}
                labels={labels}
                selectedLabelId={selectedLabelId}
                onAnnotationsChange={(anns) => { setAnnotations(anns); setDirty(true); }}
                zoom={zoom}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <ImageStrip
            images={images}
            currentImageId={currentImage?.id || null}
            onSelectImage={(img) => { handleSave(); setCurrentImage(img); }}
          />
        </div>
        <LabelSidebar
          labels={labels}
          selectedLabelId={selectedLabelId}
          onSelectLabel={setSelectedLabelId}
          onCreateLabel={handleCreateLabel}
          onUpdateLabel={handleUpdateLabel}
          onDeleteLabel={handleDeleteLabel}
        />
      </div>
    </div>
  );
}

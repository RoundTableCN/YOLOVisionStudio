import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Image as ImageType } from "@/types";
import {
  Upload, Trash2, Image as ImageIcon, X, ArrowLeft,
} from "lucide-react";

interface Stats {
  total_images: number;
  total_labels: number;
  total_annotations: number;
}

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<Stats>({ total_images: 0, total_labels: 0, total_annotations: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageType | null>(null);

  const fetchImages = useCallback(() => {
    api.get<{ items: ImageType[]; total: number }>(
      `/api/projects/${projectId}/datasets/?page=${page}&page_size=50&search=${search}`
    ).then((data) => {
      setImages(data.items);
      setTotal(data.total);
    }).catch(() => {});
  }, [projectId, page, search]);

  const fetchStats = useCallback(() => {
    api.get<Stats>(`/api/projects/${projectId}/datasets/stats`)
      .then(setStats)
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetchImages();
    fetchStats();
  }, [fetchImages, fetchStats]);

  const handleFiles = async (files: FileList | File[]) => {
    const formData = new FormData();
    const arr = Array.from(files);
    arr.forEach((f) => formData.append("files", f));
    setUploading(true);
    try {
      await api.upload(`/api/projects/${projectId}/datasets/upload`, formData);
      fetchImages();
      fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm("确定删除此图片？关联标注将同步删除。")) return;
    await api.delete(`/api/projects/${projectId}/datasets/images/${imageId}`);
    fetchImages();
    fetchStats();
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-gray-800 rounded-md">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-2xl font-bold">数据集</h2>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">图片总数</p>
          <p className="text-2xl font-bold">{stats.total_images}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">类别数</p>
          <p className="text-2xl font-bold">{stats.total_labels}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">标注总数</p>
          <p className="text-2xl font-bold">{stats.total_annotations}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">标注率</p>
          <p className="text-2xl font-bold">
            {stats.total_images > 0
              ? `${Math.round((stats.total_annotations / Math.max(stats.total_images, 1)) * 100)}%`
              : "0%"}
          </p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Upload size={32} className="mx-auto mb-2 text-gray-500" />
        <p className="text-sm text-gray-400 mb-2">拖拽图片到此处上传，或点击选择文件</p>
        <label className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm cursor-pointer transition-colors">
          {uploading ? "上传中..." : "选择文件"}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
            disabled={uploading}
          />
        </label>
        <p className="text-xs text-gray-600 mt-2">支持 JPG, PNG, WEBP</p>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <ImageIcon size={48} className="mb-4" />
          <p className="text-lg">暂无图片</p>
          <p className="text-sm mt-1">上传图片开始构建数据集</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {images.map((img) => (
              <div key={img.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden group">
                <div
                  className="aspect-square bg-gray-800 flex items-center justify-center cursor-pointer relative"
                  onClick={() => setPreviewImage(img)}
                >
                  {img.thumbnail_path ? (
                    <img
                      src={`http://127.0.0.1:8618/api/thumbnail/${encodeURIComponent(img.thumbnail_path)}`}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={32} className="text-gray-600" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-red-600/80 rounded-full hover:bg-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-400 truncate" title={img.filename}>{img.filename}</p>
                  <p className="text-xs text-gray-600">{img.width}x{img.height}</p>
                </div>
              </div>
            ))}
          </div>
          {total > 50 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-400">第 {page} 页 / 共 {Math.ceil(total / 50)} 页</span>
              <button
                disabled={page >= Math.ceil(total / 50)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded" onClick={() => setPreviewImage(null)}>
            <X size={24} />
          </button>
          <img
            src={`http://127.0.0.1:8618/api/thumbnail/${encodeURIComponent(previewImage.original_path)}`}
            alt={previewImage.filename}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

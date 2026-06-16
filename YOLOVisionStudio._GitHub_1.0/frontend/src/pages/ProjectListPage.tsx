import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Project } from "@/types";
import { Plus, Search, FolderOpen, Trash2, Edit3 } from "lucide-react";

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated_at");
  const [showDialog, setShowDialog] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchProjects = () => {
    api.get<{ items: Project[]; total: number }>(
      `/api/projects/?search=${search}&sort=${sort}`
    ).then((data) => setProjects(data.items)).catch(() => {});
  };

  useEffect(() => { fetchProjects(); }, [search, sort]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editProject) {
        await api.put(`/api/projects/${editProject.id}`, { name, description });
      } else {
        await api.post("/api/projects/", { name, description });
      }
      setName("");
      setDescription("");
      setShowDialog(false);
      setEditProject(null);
      fetchProjects();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此项目？所有数据将永久丢失。")) return;
    await api.delete(`/api/projects/${id}`);
    fetchProjects();
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    setName(p.name);
    setDescription(p.description);
    setShowDialog(true);
  };

  const openCreate = () => {
    setEditProject(null);
    setName("");
    setDescription("");
    setShowDialog(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">项目</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
        >
          <Plus size={16} /> 新建项目
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm focus:outline-none"
        >
          <option value="updated_at">最近更新</option>
          <option value="created_at">创建时间</option>
          <option value="name">名称</option>
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <FolderOpen size={48} className="mb-4" />
          <p className="text-lg">暂无项目</p>
          <p className="text-sm mt-1">点击"新建项目"开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-colors group"
            >
              <div
                className="aspect-video bg-gray-800 flex items-center justify-center cursor-pointer"
                onClick={() => navigate(`/project/${p.id}/dataset`)}
              >
                {p.thumbnail_path ? (
                  <img src={`http://127.0.0.1:8618/api/thumbnail/${p.thumbnail_path}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FolderOpen size={32} className="text-gray-600" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="font-medium text-sm truncate cursor-pointer hover:text-blue-400"
                      onClick={() => navigate(`/project/${p.id}/dataset`)}
                    >
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{p.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString("zh-CN") : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">{editProject ? "编辑项目" : "新建项目"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">项目名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  placeholder="输入项目名称"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">备注</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="可选备注"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowDialog(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !name.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-sm font-medium"
              >
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

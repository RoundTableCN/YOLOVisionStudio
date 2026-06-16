import { useState } from "react";
import type { Label } from "@/types";
import { Plus, Trash2, Edit3, X } from "lucide-react";

interface LabelSidebarProps {
  labels: Label[];
  selectedLabelId: number | null;
  onSelectLabel: (id: number | null) => void;
  onCreateLabel: (name: string, color: string) => void;
  onUpdateLabel: (id: number, name: string, color: string) => void;
  onDeleteLabel: (id: number) => void;
}

const DEFAULT_COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FF8800", "#8800FF", "#00FF88", "#FF0088"];

export default function LabelSidebar({
  labels,
  selectedLabelId,
  onSelectLabel,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: LabelSidebarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateLabel(newName.trim(), newColor);
    setNewName("");
    setNewColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
    setShowNew(false);
  };

  const handleUpdate = (id: number) => {
    if (!editName.trim()) return;
    const label = labels.find((l) => l.id === id);
    onUpdateLabel(id, editName.trim(), label?.color || "#00FF00");
    setEditingId(null);
  };

  return (
    <div className="w-56 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">类别</h3>
          <button onClick={() => setShowNew(!showNew)} className="p-1 hover:bg-gray-700 rounded">
            <Plus size={14} />
          </button>
        </div>
        {showNew && (
          <div className="space-y-2 mb-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="类别名称"
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-1 flex-wrap">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded border-2 ${newColor === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-2 py-1 bg-blue-600 rounded text-xs">添加</button>
              <button onClick={() => setShowNew(false)} className="px-2 py-1 bg-gray-700 rounded text-xs">取消</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectLabel(null)}
          className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-800 ${
            selectedLabelId === null ? "bg-gray-800 text-white" : "text-gray-400"
          }`}
        >
          <span className="w-3 h-3 rounded border border-gray-500" />
          无 (浏览模式)
        </button>
        {labels.map((label) => (
          <div
            key={label.id}
            onClick={() => onSelectLabel(label.id)}
            className={`w-full group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 ${
              selectedLabelId === label.id ? "bg-gray-800" : ""
            }`}
          >
            {editingId === label.id ? (
              <div className="flex items-center gap-1 flex-1">
                <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: label.color }} />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-1 py-0.5 bg-gray-700 rounded text-xs focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(label.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); handleUpdate(label.id); }} className="text-green-400"><Edit3 size={10} /></button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-gray-400"><X size={10} /></button>
              </div>
            ) : (
              <>
                <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: label.color }} />
                <span className="text-xs text-gray-300 flex-1 truncate">{label.name}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(label.id); setEditName(label.name); }}
                    className="text-gray-500 hover:text-white"
                  >
                    <Edit3 size={10} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteLabel(label.id); }}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

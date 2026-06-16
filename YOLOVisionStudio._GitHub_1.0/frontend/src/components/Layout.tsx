import { NavLink, Outlet } from "react-router-dom";
import {
  FolderOpen,
  Image,
  Pencil,
  Cpu,
  Box,
  Eye,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: FolderOpen, label: "项目", end: true },
  { to: "/project/1/dataset", icon: Image, label: "数据集" },
  { to: "/project/1/annotate", icon: Pencil, label: "标注" },
  { to: "/project/1/train", icon: Cpu, label: "训练" },
  { to: "/project/1/models", icon: Box, label: "模型" },
  { to: "/project/1/inference", icon: Eye, label: "推理" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">YOLOVision</h1>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

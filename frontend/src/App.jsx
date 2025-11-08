import { useMemo, useState } from "react";
import clsx from "clsx";
import WordPreview from "./modules/word-preview/WordPreview.jsx";
import BilingualEditor from "./modules/bilingual/BilingualEditor.jsx";
import PlannedModule from "./modules/planned/PlannedModule.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const MODULES = [
  {
    id: "word-preview",
    name: "Word 导入预览",
    subtitle:
      "支持 Word (.docx) 上传，自动转换为接近原稿的排版，仅展示正文内容。",
    status: "ready",
    component: WordPreview,
  },
  {
    id: "bilingual-editor",
    name: "中英对照编辑器",
    subtitle: "双栏对照展示合同译文，支持联动高亮、译文替换与段落插入。",
    status: "ready",
    component: BilingualEditor,
  },
  {
    id: "doc-diff",
    name: "文档对比编辑器",
    subtitle:
      "规划中：原稿与修改稿并排对比，可视化展示差异并选择接受。",
    status: "planned",
    highlights: [
      "双栏展示：左侧原始文档，右侧 AI / 修改版本，保持滚动同步。",
      "差异高亮：插入、删除、修改分别使用不同标记直观呈现。",
      "审校操作：逐段接受或拒绝修改，实时回传 FastAPI 后端。",
      "版本管理：与后端联动生成版本历史，支持回滚与复核记录。",
    ],
    component: PlannedModule,
  },
];

export default function App() {
  const [activeModule, setActiveModule] = useState(MODULES[0].id);

  const activeModuleMeta = useMemo(
    () => MODULES.find((module) => module.id === activeModule) ?? MODULES[0],
    [activeModule]
  );

  const ModuleComponent = activeModuleMeta.component ?? PlannedModule;

  return (
    <div className="page">
      <div className="page__layout">
        <aside className="module-menu">
          <div className="module-menu__header">
            <h2>功能模块</h2>
            <p>切换不同的合同编辑与审校工具。</p>
          </div>
          <nav className="module-menu__list">
            {MODULES.map((module) => {
              const isActive = module.id === activeModuleMeta.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={clsx("module-menu__item", {
                    "module-menu__item--active": isActive,
                    "module-menu__item--planned": module.status === "planned",
                  })}
                >
                  <span className="module-menu__item-title">{module.name}</span>
                  {module.status === "planned" && (
                    <span className="module-menu__item-badge">规划中</span>
                  )}
                  <span className="module-menu__item-subtitle">
                    {module.subtitle}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="page__main">
          <ModuleComponent
            key={activeModuleMeta.id}
            title={activeModuleMeta.name}
            subtitle={activeModuleMeta.subtitle}
            apiBaseUrl={API_BASE_URL}
            highlights={activeModuleMeta.highlights}
            status={activeModuleMeta.status}
          />
        </div>
      </div>
    </div>
  );
}

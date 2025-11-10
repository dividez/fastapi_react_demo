import { useState } from "react";
import clsx from "clsx";
import WordPreview from "./modules/word-preview/WordPreview.jsx";
import ContractEditor from "./modules/contract-editor/ContractEditor.jsx";
import BilingualEditor from "./modules/bilingual/BilingualEditor.jsx";
import DocDiffDemo from "./modules/doc-diff/DocDiffDemo.jsx";
import PlannedModule from "./modules/planned/PlannedModule.jsx";
import ContractEditorDemo from "./modules/contract-editor-demo/ContractEditorDemo.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

const MODULES = [
  {
    id: "contract-editor",
    name: "合同导入编辑",
    subtitle:
      "导入 Word 合同后可在网页中直接修改，并一键导出 Word/PDF/JSON。",
    status: "ready",
    component: ContractEditor,
  },
  {
    id: "word-preview",
    name: "Word 导入预览",
    subtitle:
      "支持 Word (.docx) 上传，自动转换为接近原稿的排版，仅展示正文内容。",
    status: "ready",
    component: WordPreview,
  },
  {
    id: "contract-editor-demo",
    name: "多写法合同 Markdown Demo",
    subtitle:
      "演示 Markdown 协议到 Tiptap 编辑器的映射，并支持段落多写法一键切换。",
    status: "ready",
    component: ContractEditorDemo,
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
      "上传原稿与修改稿，自动转换为可阅读排版并生成差异高亮视图。",
    status: "ready",
    component: DocDiffDemo,
  },
];

export default function App() {
  const [activeModule, setActiveModule] = useState(MODULES[0].id);

  const activeModuleMeta =
    MODULES.find((module) => module.id === activeModule) ?? MODULES[0];

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

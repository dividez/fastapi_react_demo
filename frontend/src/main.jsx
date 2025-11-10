import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/base.css";
import "./styles/word-preview.css";
import "./styles/bilingual-editor.css";
import "./styles/doc-diff.css";
import "./styles/contract-editor-demo.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

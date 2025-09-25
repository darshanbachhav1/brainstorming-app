import React, { useEffect, useState, useCallback } from "react";
import "./index.css";
import "./App.css";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import { expandWithAI } from "./services/api";

// Simple contract:
// - inputs: user interactions (create/edit/move nodes, ask AI to expand)
// - outputs: local UI updates, persistent storage in localStorage, optional backend call to /api/ai/expand
// - error modes: network failure for AI calls -> fallback to local mock

const STORAGE_KEY = "brainstorm:nodes:v1";

function App() {
  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [queryingAI, setQueryingAI] = useState(false);

  useEffect(() => {
    // load saved nodes
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNodes(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to parse saved nodes", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
    } catch (e) {
      console.warn("Failed to save nodes", e);
    }
  }, [nodes]);

  const addNode = useCallback((text) => {
    if (!text || !text.trim()) return;
    const node = {
      id: Date.now().toString(),
      content: text.trim(),
      x: 40 + Math.random() * 600,
      y: 40 + Math.random() * 300,
    };
    setNodes((s) => [node, ...s]);
    setSelectedId(node.id);
  }, []);

  const updateNode = useCallback((id, patch) => {
    setNodes((s) => s.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const removeNode = useCallback((id) => {
    setNodes((s) => s.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const onAskAI = useCallback(async (node) => {
    if (!node) return;
    setQueryingAI(true);
    try {
      const result = await expandWithAI(node.content);
      // append as a new node connected visually near the original
      const newNode = {
        id: Date.now().toString(),
        content: result || "(AI had no suggestion)",
        x: node.x + 120,
        y: node.y + 20,
      };
      setNodes((s) => [newNode, ...s]);
      setSelectedId(newNode.id);
    } catch (e) {
      console.error(e);
      alert("AI request failed: " + (e.message || e));
    } finally {
      setQueryingAI(false);
    }
  }, []);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brainstorm-nodes.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed)) setNodes(parsed);
        else alert("Invalid file format: expected an array of nodes");
      } catch (err) {
        alert("Failed to import: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <h1 className="text-lg font-semibold">Brainstorm AI</h1>
        <div className="flex items-center gap-3">
          <button onClick={exportJSON} className="bg-white/20 px-3 py-1 rounded">Export</button>
          <label className="bg-white/20 px-3 py-1 rounded cursor-pointer">
            Import
            <input className="hidden" type="file" accept="application/json" onChange={(e) => importJSON(e.target.files?.[0])} />
          </label>
        </div>
      </header>

      <div className="flex flex-1 gap-4 p-4 bg-slate-50">
        <Sidebar
          nodes={nodes}
          selectedId={selectedId}
          onAdd={addNode}
          onSelect={(id) => setSelectedId(id)}
          onDelete={removeNode}
          onUpdate={updateNode}
          onAskAI={(id) => {
            const node = nodes.find((n) => n.id === id);
            onAskAI(node);
          }}
          queryingAI={queryingAI}
        />

        <Canvas
          nodes={nodes}
          selectedId={selectedId}
          onMove={(id, x, y) => updateNode(id, { x, y })}
          onSelect={(id) => setSelectedId(id)}
        />
      </div>

      <footer className="px-4 py-2 text-sm text-gray-600">Tip: drag nodes on the canvas. Use "Expand with AI" to generate new ideas.</footer>
    </div>
  );
}

export default App;

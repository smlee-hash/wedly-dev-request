"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type DevRequest = {
  id: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  app: string;
  page: string;
  no: number;
  createdTime: string;
  requester: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  "\uCD5C\uC6B0\uC120": "bg-purple-100 text-purple-700",
  "\uB192\uC74C": "bg-red-100 text-red-700",
  "\uBCF4\uD1B5": "bg-yellow-100 text-yellow-700",
  "\uB0AE\uC74C": "bg-green-100 text-green-700",
};

const STATUS_BADGE: Record<string, string> = {
  "\uC2DC\uC791 \uC804": "bg-slate-100 text-slate-600",
  "\uB300\uAE30\uC911": "bg-slate-100 text-slate-600",
  "\uC9C4\uD589 \uC911": "bg-blue-100 text-blue-700",
  "\uC644\uB8CC": "bg-green-100 text-green-700",
};

type FormStep = "input" | "structuring" | "review";

// URL params를 읽는 내부 컴포넌트
function DevRequestContent() {
  const searchParams = useSearchParams();
  // URL params로 앱/요청자/페이지 주입 (iframe 임베드 시 사용)
  const paramApp = searchParams.get("app") || "";
  const paramRequester = searchParams.get("requester") || "";
  const paramPage = searchParams.get("page") || "";

  const [requests, setRequests] = useState<DevRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [step, setStep] = useState<FormStep>("input");
  const [rawContent, setRawContent] = useState("");
  const [structuredTitle, setStructuredTitle] = useState("");
  const [structuredContent, setStructuredContent] = useState("");
  const [priority, setPriority] = useState("\uBCF4\uD1B5");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 5);
    setAttachedFiles((prev) => {
      const combined = [...prev, ...newFiles.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
      return combined.slice(0, 5);
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadImages = async (): Promise<string[]> => {
    if (attachedFiles.length === 0) return [];
    const formData = new FormData();
    for (const { file } of attachedFiles) formData.append("images", file);
    const res = await fetch("/api/dev-request/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data.map((d: { id: string }) => d.id);
  };

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (paramApp) params.set("app", paramApp);
      if (paramPage) params.set("page", paramPage);
      const qs = params.toString();
      const url = qs ? `/api/dev-request?${qs}` : "/api/dev-request";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setRequests(json.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [paramApp, paramPage]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // STEP 1→2: AI 구조화
  const handleStructure = async () => {
    if (!rawContent.trim()) return;
    setStep("structuring");
    setSubmitResult(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const res = await fetch("/api/dev-request/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: rawContent.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      if (json.success) {
        setStructuredTitle(json.data.title);
        setStructuredContent(json.data.content);
        setPriority(json.data.priority || "\uBCF4\uD1B5");
        setStep("review");
      } else {
        setStep("input");
        setSubmitResult(json.error || "\uC694\uCCAD\uC11C \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4");
      }
    } catch (e) {
      setStep("input");
      setSubmitResult((e as Error).name === "AbortError" ? "\uC694\uCCAD \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694." : "\uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
    }
  };

  // STEP 3: 확인 후 등록
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      let imageIds: string[] = [];
      if (attachedFiles.length > 0) {
        try {
          imageIds = await uploadImages();
        } catch {
          setSubmitResult("\uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC774\uBBF8\uC9C0 \uC5C6\uC774 \uB4F1\uB85D\uD558\uB824\uBA74 \uCCA8\uBD80\uB97C \uC81C\uAC70 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
          setSubmitting(false);
          return;
        }
      }
      const res = await fetch("/api/dev-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: structuredTitle,
          content: structuredContent,
          priority,
          app: paramApp || "general",
          page: paramPage || "",
          imageIds,
          requester: paramRequester || "",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitResult("\uB4F1\uB85D \uC644\uB8CC");
        setRawContent(""); setStructuredTitle(""); setStructuredContent(""); setPriority("\uBCF4\uD1B5");
        attachedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
        setAttachedFiles([]);
        setStep("input");
        setShowForm(false);
        fetchRequests();
        setTimeout(() => setSubmitResult(null), 3000);
      } else {
        setSubmitResult(json.error || "\uB178\uC158 \uB4F1\uB85D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
      }
    } catch {
      setSubmitResult("\uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/dev-request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setShowForm(false);
    setStep("input");
    setRawContent(""); setStructuredTitle(""); setStructuredContent(""); setPriority("\uBCF4\uD1B5");
    attachedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setAttachedFiles([]);
  };

  const appLabel = paramApp || "general";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-wedly-bd p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-bold text-wedly-navy flex items-center gap-2">
                <svg className="w-4 h-4 text-wedly-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                오류/개선 요청
              </h3>
              <p className="text-[12px] text-wedly-muted mt-0.5">오류나 개선사항을 요청합니다</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-wedly-accent rounded-lg hover:bg-wedly-accent/90 transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              새 요청
            </button>
          </div>

          {submitResult && (
            <div className={`px-3 py-2 rounded-lg text-[12px] font-medium mb-3 flex items-center justify-between ${submitResult.includes("\uC644\uB8CC") ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              <span>{submitResult}</span>
              {!submitResult.includes("\uC644\uB8CC") && (
                <button onClick={() => setSubmitResult(null)} className="ml-2 text-[11px] underline opacity-70 hover:opacity-100">닫기</button>
              )}
            </div>
          )}

          {showForm && (
            <div className="border border-wedly-bd rounded-xl p-4 space-y-3 mb-4 bg-bg-gray/30">
              {/* STEP 1: 입력 */}
              {step === "input" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-wedly-accent text-white text-[11px] font-bold flex items-center justify-center">1</span>
                    <span className="text-[12px] font-medium text-wedly-navy">요청 내용 입력</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">{appLabel}</span>
                    {paramPage && <span className="text-[11px] text-wedly-muted">{paramPage}</span>}
                    {paramRequester && <span className="text-[11px] text-wedly-muted ml-auto">요청자: {paramRequester}</span>}
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-wedly-t2 mb-1 block">오류/개선 내용</label>
                    <textarea
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        const imageFiles: File[] = [];
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.startsWith("image/")) {
                            const f = items[i].getAsFile();
                            if (f) imageFiles.push(f);
                          }
                        }
                        if (imageFiles.length > 0) {
                          e.preventDefault();
                          addFiles(imageFiles);
                        }
                      }}
                      placeholder="어떤 오류가 발생했는지, 어떤 개선이 필요한지 편하게 작성해주세요. 이미지를 드래그하거나 클립보드에서 붙여넣기(Ctrl+V)할 수 있습니다."
                      rows={5}
                      className={`w-full px-3 py-2 text-[13px] border rounded-lg resize-none focus:outline-none focus:border-wedly-accent transition-colors ${dragging ? "border-wedly-accent bg-bg-blue/10" : "border-wedly-bd"}`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-wedly-t2 border border-wedly-bd rounded-lg hover:bg-bg-gray transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                      이미지 첨부
                    </button>
                    <span className="text-[11px] text-wedly-muted">드래그 또는 Ctrl+V로 붙여넣기 가능 (최대 5MB)</span>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((af, i) => (
                        <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-wedly-bd/50">
                          <img src={af.preview} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeFile(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">&#10005;</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleStructure} disabled={!rawContent.trim()} className="px-4 py-2 text-[13px] font-medium text-white bg-wedly-accent rounded-lg hover:bg-wedly-accent/90 disabled:opacity-50 transition-all">
                      요청서 생성
                    </button>
                    <button onClick={resetForm} className="px-4 py-2 text-[13px] text-wedly-muted border border-wedly-bd rounded-lg">취소</button>
                  </div>
                </div>
              )}

              {/* STEP 2: AI 구조화 중 */}
              {step === "structuring" && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-wedly-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-[13px] text-wedly-muted">AI가 요청서를 구조화하고 있습니다...</p>
                </div>
              )}

              {/* STEP 3: 확인 + 등록 */}
              {step === "review" && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-wedly-accent text-white text-[11px] font-bold flex items-center justify-center">2</span>
                    <span className="text-[12px] font-medium text-wedly-navy">요청서 확인</span>
                  </div>
                  <p className="text-[11px] text-wedly-muted mb-2">{appLabel}{paramPage ? ` \u00b7 ${paramPage}` : ""}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-blue-50/60 rounded-lg border border-blue-200 p-4 min-h-[320px]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3.5 h-3.5 text-wedly-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        <span className="text-[11px] font-semibold text-wedly-accent">미리보기</span>
                      </div>
                      <div className="text-[13px] text-wedly-t1 whitespace-pre-wrap leading-relaxed">{structuredContent}</div>
                    </div>
                    <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-4 min-h-[320px] flex flex-col">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        <span className="text-[11px] font-semibold text-amber-600">직접 편집</span>
                      </div>
                      <textarea value={structuredContent} onChange={(e) => setStructuredContent(e.target.value)} className="w-full flex-1 px-3 py-2 text-[13px] border border-amber-200 bg-white rounded-lg resize-none focus:outline-none focus:border-amber-400 font-mono min-h-[270px]" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-wedly-t2 mb-1.5 block">우선 순위</label>
                    <div className="flex gap-2">
                      {["\uCD5C\uC6B0\uC120", "\uB192\uC74C", "\uBCF4\uD1B5", "\uB0AE\uC74C"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${priority === p ? PRIORITY_COLORS[p] + " border-current" : "text-wedly-t2 border-wedly-bd hover:bg-bg-gray"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {attachedFiles.length > 0 && (
                    <div>
                      <label className="text-[12px] font-medium text-wedly-t2 mb-1 block">첨부 이미지 ({attachedFiles.length}개)</label>
                      <div className="flex flex-wrap gap-2">
                        {attachedFiles.map((af, i) => (
                          <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-wedly-bd/50">
                            <img src={af.preview} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-[13px] font-medium text-white bg-wedly-accent rounded-lg hover:bg-wedly-accent/90 disabled:opacity-50 transition-all">
                      {submitting ? "등록 중..." : "노션에 등록"}
                    </button>
                    <button onClick={() => setStep("input")} className="px-4 py-2 text-[13px] text-wedly-muted border border-wedly-bd rounded-lg">다시 작성</button>
                    <button onClick={resetForm} className="px-4 py-2 text-[13px] text-wedly-muted border border-wedly-bd rounded-lg">취소</button>
                  </div>
                </>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-wedly-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-wedly-muted">등록된 요청이 없습니다</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-wedly-bd">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-wedly-bd text-[11px] font-semibold text-wedly-t2">
                    <th className="px-3 py-2.5 w-[50px] text-center">NO</th>
                    <th className="px-3 py-2.5">제목</th>
                    <th className="px-3 py-2.5 w-[100px] text-center">앱</th>
                    <th className="px-3 py-2.5 w-[80px] text-center">페이지</th>
                    <th className="px-3 py-2.5 w-[72px] text-center">요청자</th>
                    <th className="px-3 py-2.5 w-[72px] text-center">우선순위</th>
                    <th className="px-3 py-2.5 w-[72px] text-center">상태</th>
                    <th className="px-3 py-2.5 w-[90px] text-center">요청일</th>
                    <th className="px-3 py-2.5 w-[44px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const isOpen = expandedId === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedId(isOpen ? null : r.id)}
                          className={`border-b border-wedly-bd/50 cursor-pointer transition-colors ${isOpen ? "bg-blue-50/50" : "hover:bg-bg-gray/40"}`}
                        >
                          <td className="px-3 py-2.5 text-[11px] text-wedly-muted font-mono text-center">{r.no}</td>
                          <td className="px-3 py-2.5 text-[13px] font-semibold text-wedly-navy">
                            <div className="flex items-center gap-1.5">
                              <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              {r.title}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-center">
                            {r.app && <span className="font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{r.app.replace("wedly-", "")}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-wedly-t2 text-center">{r.page}</td>
                          <td className="px-3 py-2.5 text-[11px] text-wedly-t2 text-center">{r.requester}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[r.priority] || "bg-slate-100 text-slate-600"}`}>{r.priority}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-wedly-muted text-center">{new Date(r.createdTime).toLocaleDateString("ko-KR")}</td>
                          <td className="px-3 py-2.5 text-center">
                            {confirmDeleteId === r.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => { handleDelete(r.id); setConfirmDeleteId(null); setExpandedId(null); }} className="text-[10px] font-medium text-white bg-red-500 px-1.5 py-0.5 rounded hover:bg-red-600">삭제</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-slate-400 px-1.5 py-0.5 border border-slate-200 rounded hover:bg-slate-50">취소</button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }} className="text-slate-300 hover:text-red-400 transition-colors">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={9} className="p-0">
                              <div className="bg-blue-50/40 border-b border-blue-200 px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[r.priority] || "bg-slate-100 text-slate-600"}`}>{r.priority}</span>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                                    <span className="text-[11px] text-wedly-muted">{r.requester} · {new Date(r.createdTime).toLocaleDateString("ko-KR")}</span>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${r.title}\n\n${r.content}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-wedly-accent transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                    {copied ? "\uBCF5\uC0AC\uB428" : "\uBCF5\uC0AC"}
                                  </button>
                                </div>
                                <div className="bg-white rounded-lg border border-blue-100 p-5 space-y-0.5">
                                  <h3 className="text-[15px] font-bold text-wedly-navy mb-2">{r.title}</h3>
                                  {r.content && (() => {
                                    return r.content.split("\n").map((line: string, i: number) => {
                                      const trimmed = line.trim();
                                      if (!trimmed) return <div key={i} className="h-2" />;
                                      if (trimmed.startsWith("***") && trimmed.endsWith("***")) return <h3 key={i} className="text-[15px] font-bold text-wedly-navy mb-1">{trimmed.replace(/\*{3}/g, "")}</h3>;
                                      if (trimmed.startsWith("**") && trimmed.includes("**:")) {
                                        const parts = trimmed.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);
                                        if (parts) return <p key={i} className="text-[13px] leading-[1.7]"><span className="font-bold text-wedly-navy">{parts[1]}:</span> <span className="text-wedly-t1">{parts[2]}</span></p>;
                                      }
                                      if (/^\d+\./.test(trimmed)) return <p key={i} className="text-[13px] text-wedly-t1 leading-[1.7] pl-1">{trimmed}</p>;
                                      if (trimmed.startsWith("- ")) return <p key={i} className="text-[13px] text-wedly-t2 leading-[1.7] pl-4">{trimmed}</p>;
                                      if (trimmed === "---") return <hr key={i} className="my-2 border-slate-200" />;
                                      return <p key={i} className="text-[13px] text-wedly-t1 leading-[1.7]">{trimmed}</p>;
                                    });
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DevRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-wedly-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DevRequestContent />
    </Suspense>
  );
}

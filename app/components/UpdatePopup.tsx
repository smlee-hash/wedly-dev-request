"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AppUpdate {
  id: string;
  title: string;
  description: string;
  category: string;
  page: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  feature: { label: "새 기능", emoji: "✨", color: "text-wedly-accent", bg: "bg-bg-blue" },
  fix: { label: "오류 수정", emoji: "🔧", color: "text-wedly-green", bg: "bg-bg-green" },
  improve: { label: "개선", emoji: "💡", color: "text-[#7048E8]", bg: "bg-bg-purple" },
};

const DISMISSED_KEY = "wedly-dev-request-update-dismissed";

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/build-id", { cache: "no-store" });
    const { buildId } = await res.json();
    return buildId && buildId !== "unknown" ? buildId : null;
  } catch { return null; }
}

async function waitForNewBuild(currentBuildId: string | null, timeoutMs = 15000): Promise<boolean> {
  if (!currentBuildId) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const newId = await fetchBuildId();
    if (newId && newId !== currentBuildId) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export default function UpdatePopup() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const dismiss = useCallback(async () => {
    if (update) {
      try { localStorage.setItem(DISMISSED_KEY, update.id); } catch { /* iframe */ }
    }
    setDismissing(true);

    const currentBuildId = await fetchBuildId();
    await waitForNewBuild(currentBuildId);

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ignore */ }

    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  }, [update]);

  const showUpdate = useCallback((u: AppUpdate) => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === u.id) return;
    } catch { /* iframe - 항상 표시 */ }

    setUpdate(u);
    setVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
  }, []);

  // 초기 로드: 최신 업데이트 확인
  useEffect(() => {
    fetch("/api/app-updates")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) showUpdate(data);
      })
      .catch(() => {});
  }, [showUpdate]);

  // SSE 연결: 실시간 업데이트 수신
  useEffect(() => {
    const es = new EventSource("/api/app-updates/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "new-update" && msg.data) {
          showUpdate(msg.data);
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {};

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [showUpdate]);

  if (!visible || !update) return null;

  const cat = CATEGORY_LABELS[update.category] || CATEGORY_LABELS.improve;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${animating ? "opacity-100" : "opacity-0"}`}
        onClick={dismissing ? undefined : dismiss}
      />
      <div
        className={`relative bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all duration-300 ${
          animating ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
        }`}
      >
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${cat.bg} flex items-center justify-center text-base`}>
                {cat.emoji}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h3 className="text-lg font-bold text-wedly-t1 leading-snug">{update.title}</h3>
        </div>
        <div className="px-5 pb-4">
          <p className="text-sm text-wedly-t2 leading-relaxed whitespace-pre-line">{update.description}</p>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            disabled={dismissing}
            className="w-full py-3 bg-wedly-accent text-white text-sm font-semibold rounded-xl hover:bg-wedly-accent/90 transition-colors disabled:opacity-70"
          >
            {dismissing ? "업데이트 적용 중..." : "확인했어요"}
          </button>
        </div>
      </div>
    </div>
  );
}

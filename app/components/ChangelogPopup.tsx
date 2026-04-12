"use client";

import { useState, useEffect } from "react";

// ═══════════════════════════════════════
// 타입 & 카테고리 (WEDLY ERP와 동일)
// ═══════════════════════════════════════

interface ChangelogEntry {
  id: number;
  date: string;
  title: string;
  category: "feature" | "fix" | "improve" | "design" | "infra" | "refactor";
  summary: string;
  details: string[];
}

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  feature: { label: "기능 추가", color: "text-wedly-accent", bg: "bg-bg-blue" },
  fix: { label: "버그 수정", color: "text-wedly-red", bg: "bg-bg-red" },
  improve: { label: "개선", color: "text-wedly-green", bg: "bg-bg-green" },
  design: { label: "디자인", color: "text-[#7048E8]", bg: "bg-bg-purple" },
  infra: { label: "인프라", color: "text-[#E8590C]", bg: "bg-orange-50" },
  refactor: { label: "리팩토링", color: "text-wedly-navy", bg: "bg-bg-gray" },
};

// ═══════════════════════════════════════
// 업데이트 히스토리 (새 항목은 맨 위에 추가)
// ═══════════════════════════════════════

const CHANGELOG: ChangelogEntry[] = [
  {
    id: 5, date: "2026-04-13", title: "카테고리 자동 분류 및 인라인 수정 기능",
    category: "feature",
    summary: "AI가 요청 내용을 분석하여 카테고리를 자동으로 분류하고, 테이블에서 직접 수정할 수 있습니다.",
    details: [
      "요청서 생성 시 AI가 카테고리를 자동으로 판별합니다 (신규 기능/기능 개선/버그 수정/UI·UX/데이터/기타)",
      "테이블에서 카테고리, 우선순위, 상태 값을 클릭하여 바로 수정할 수 있습니다",
      "수정된 값은 노션 데이터베이스에 즉시 반영됩니다",
    ],
  },
  {
    id: 4, date: "2026-04-13", title: "업데이트 알림 팝업 추가",
    category: "feature",
    summary: "새로운 기능이 추가되거나 개선되면 팝업으로 알려드립니다.",
    details: [
      "새 업데이트가 있으면 자동으로 팝업이 표시됩니다",
      "각 항목을 클릭하면 상세 내용을 확인할 수 있습니다",
      "확인 후 다시 표시되지 않습니다",
    ],
  },
  {
    id: 3, date: "2026-04-12", title: "이미지 첨부 기능 추가",
    category: "feature",
    summary: "요청 등록 시 이미지를 첨부할 수 있습니다.",
    details: [
      "파일 선택, 드래그 앤 드롭, 클립보드 붙여넣기(Ctrl+V) 지원",
      "첨부된 이미지가 노션 페이지에 자동 반영됩니다",
      "최대 5장, 5MB 이미지 업로드 지원",
    ],
  },
  {
    id: 2, date: "2026-04-12", title: "AI 요청서 자동 구조화",
    category: "feature",
    summary: "편하게 작성한 요청 내용을 AI가 구조화된 요청서로 변환합니다.",
    details: [
      "자유롭게 작성한 내용을 AI가 제목, 본문, 우선순위로 정리합니다",
      "구조화된 요청서를 확인 후 수정할 수 있습니다",
      "노션 데이터베이스에 자동 등록됩니다",
    ],
  },
  {
    id: 1, date: "2026-04-12", title: "기능 추가 및 개선 요청 시스템 출시",
    category: "feature",
    summary: "기능 추가나 개선사항을 쉽게 요청하고 관리할 수 있는 시스템입니다.",
    details: [
      "요청 등록, 조회, 삭제 기능",
      "앱별, 페이지별 필터링 지원",
      "노션 데이터베이스와 실시간 동기화",
    ],
  },
];

// ═══════════════════════════════════════
// 컴포넌트
// ═══════════════════════════════════════

const STORAGE_KEY = "wedly-dev-request-changelog-seen";

export default function ChangelogPopup() {
  const [open, setOpen] = useState(false);
  const [newEntries, setNewEntries] = useState<ChangelogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (CHANGELOG.length === 0) return;
    try {
      const lastSeenId = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
      const unseen = CHANGELOG.filter((e) => e.id > lastSeenId);
      if (unseen.length > 0) {
        setNewEntries(unseen);
        setOpen(true);
      }
    } catch {
      // iframe 크로스오리진 등 localStorage 접근 불가 시 전체 표시
      setNewEntries(CHANGELOG);
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    const maxId = Math.max(...CHANGELOG.map((e) => e.id));
    try { localStorage.setItem(STORAGE_KEY, String(maxId)); } catch { /* iframe 환경 */ }
    setOpen(false);
  };

  if (!open || newEntries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative w-full max-w-lg max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-in">
        {/* 헤더 */}
        <div className="bg-wedly-navy px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✨</span>
            <div>
              <h2 className="text-[15px] font-bold text-white">업데이트 알림</h2>
              <p className="text-[11px] text-white/50 mt-0.5">{newEntries.length}건의 새로운 업데이트</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">&times;</button>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {newEntries.map((entry) => {
            const cat = CATEGORY_MAP[entry.category];
            const isOpen = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => setExpandedId(isOpen ? null : entry.id)}
                className="rounded-xl border border-wedly-bd/50 hover:border-wedly-accent/30 transition-all cursor-pointer"
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.color} ${cat.bg}`}>
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-wedly-muted">{entry.date}</span>
                  </div>
                  <p className="text-[13px] font-bold text-wedly-navy">{entry.title}</p>
                  <p className="text-[12px] text-wedly-muted mt-0.5 leading-relaxed">{entry.summary}</p>

                  {isOpen && entry.details.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-wedly-bd/30 space-y-1.5">
                      {entry.details.map((d, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-wedly-accent mt-1.5 shrink-0" />
                          <span className="text-[12px] text-wedly-t2 leading-relaxed">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-wedly-bd/50 px-6 py-3 shrink-0">
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-[13px] font-bold text-white bg-wedly-accent rounded-xl hover:bg-wedly-accent/90 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

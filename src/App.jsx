import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronRight, Users, ClipboardList, TrendingUp, Save, X, Target, Calendar, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxsLMkvdwgKjjhEiqbLYON7IwTeqsPGwfRMCD6B3ooiM01FvVyhkHMbCEVjheR7Pe-0Gw/exec";

const uid = () => Math.random().toString(36).slice(2, 10);

const NAV_ITEMS = [
  { id: "members", label: "メンバー設定", icon: Users },
  { id: "sheet", label: "1on1シート", icon: ClipboardList },
  { id: "history", label: "達成率推移", icon: TrendingUp },
];

function currentWeekLabel() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const m = monday.getMonth() + 1;
  const dt = monday.getDate();
  return `${m}/${dt}週`;
}

export default function OneOnOneBoard() {
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`${GAS_API_URL}?action=getMembers`);
      const data = await res.json();
      setMembers(data || []);
      if (data && data.length && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("メンバー情報の読み込みに失敗しました。GASのURLや通信状況を確認してください。");
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const persistMembers = useCallback(async (next) => {
    setMembers(next);
    setErrorMessage("");
    try {
      for (const m of next) {
        await fetch(GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "saveMember",
            payload: {
              id: m.id,
              name: m.name,
              items: JSON.stringify(m.items || [])
            }
          })
        });
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("メンバー情報の保存に失敗しました。");
    }
  }, []);

  if (loading && members.length === 0) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center text-[#F0F6FC] font-sans text-sm tracking-wide">
        スプレッドシートと同期中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#F0F6FC] font-sans selection:bg-[#E8A33D]/30">
      <Header />
      <div className="max-w-2xl mx-auto px-4 pb-32">
        {errorMessage && (
          <div className="mt-4 bg-[#ED4245]/15 border border-[#ED4245]/40 text-[#FF8585] px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm">
            <AlertCircle size={16} className="shrink-0" />
            {errorMessage}
          </div>
        )}
        {tab === "members" && (
          <MembersTab members={members} setMembers={persistMembers} />
        )}
        {tab === "sheet" && (
          <SheetTab
            members={members}
            selectedMemberId={selectedMemberId}
            setSelectedMemberId={setSelectedMemberId}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            members={members}
            selectedMemberId={selectedMemberId}
            setSelectedMemberId={setSelectedMemberId}
          />
        )}
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function Header() {
  return (
    <div className="sticky top-0 z-20 bg-[#0D1117]/90 backdrop-blur-md border-b border-[#30363D] px-4 pt-5 pb-4 shadow-sm">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-[#F2B04B] text-[11px] font-bold tracking-widest uppercase mb-1">
          <Target size={14} strokeWidth={2.5} />
          Weekly 1on1 Board
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#F0F6FC]">達成率チェックシート</h1>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#161B22]/95 backdrop-blur-md border-t border-[#30363D] z-20 shadow-lg">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 transition-all ${
                active ? "text-[#F2B04B] font-semibold" : "text-[#8B949E] hover:text-[#C9D1D9]"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[11px] tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================= MEMBER SETTING TAB =================
function MemberSettingTab({ members, setMembers, GAS_API_URL }) {
  const [newName, setNewName] = useState("");
  const [openMemberId, setOpenMemberId] = useState(members[0]?.id || null);
  const [newItemLabels, setNewItemLabels] = useState({});
  const [newItemTargets, setNewItemTargets] = useState({});
  const [newItemUnits, setNewItemUnits] = useState({});
  const [loading, setLoading] = useState(false);

  const addMember = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const payload = {
      action: "saveMember",
      payload: { name: newName.trim(), items: [] }
    };
    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        const listRes = await fetch(`${GAS_API_URL}?action=getMembers`);
        const list = await listRes.json();
        setMembers(list || []);
        setNewName("");
      }
    } catch (e) {
      console.error(e);
      alert("メンバーの追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // メンバー名変更時の処理（フォーカスが外れた時や入力時に保存）
  const updateMemberName = async (memberId, updatedName) => {
    if (!updatedName.trim()) return;
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember || targetMember.name === updatedName) return;

    const payload = {
      action: "saveMember",
      payload: { id: memberId, name: updatedName.trim(), items: targetMember.items || [] }
    };
    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        setMembers(members.map(m => m.id === memberId ? { ...m, name: updatedName.trim() } : m));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMember = async (memberId) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "deleteMember", payload: { id: memberId } })
      });
      const result = await res.json();
      if (result.status === "success") {
        setMembers(members.filter((m) => m.id !== memberId));
      }
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (memberId) => {
    const label = newItemLabels[memberId];
    const target = Number(newItemTargets[memberId]);
    const unit = newItemUnits[memberId] || "件";

    if (!label || !target) {
      alert("項目名と目標数値を入力してください");
      return;
    }

    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    const newItems = [
      ...(targetMember.items || []),
      { id: "item_" + Date.now(), label, target, unit }
    ];

    setLoading(true);
    const payload = {
      action: "saveMember",
      payload: { id: targetMember.id, name: targetMember.name, items: newItems }
    };

    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        setMembers(
          members.map((m) => (m.id === memberId ? { ...m, items: newItems } : m))
        );
        setNewItemLabels({ ...newItemLabels, [memberId]: "" });
        setNewItemTargets({ ...newItemTargets, [memberId]: "" });
      }
    } catch (e) {
      console.error(e);
      alert("項目の追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (memberId, itemId) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    const newItems = (targetMember.items || []).filter((it) => it.id !== itemId);

    setLoading(true);
    const payload = {
      action: "saveMember",
      payload: { id: targetMember.id, name: targetMember.name, items: newItems }
    };

    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        setMembers(
          members.map((m) => (m.id === memberId ? { ...m, items: newItems } : m))
        );
      }
    } catch (e) {
      console.error(e);
      alert("項目の削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-5 space-y-5">
      <div className="text-xs text-[#8B949E] leading-relaxed bg-[#161B22] border border-[#30363D] rounded-xl p-3.5">
        メンバーごとに追う目標項目（KPI）を登録します。データは全員共通で更新されます[cite: 3]。
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="メンバー名（例: 田中さん）"
          className="flex-1 bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
        />
        <button
          onClick={addMember}
          disabled={loading}
          className="bg-[#F2B04B] hover:bg-[#E8A33D] text-[#0D1117] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          追加
        </button>
      </div>

      <div className="space-y-3">
        {members.map((m) => {
          const isOpen = openMemberId === m.id;
          const items = m.items || [];

          return (
            <div
              key={m.id}
              className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-sm transition-all"
            >
              <div
                onClick={() => setOpenMemberId(isOpen ? null : m.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#21262D]/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F2B04B]/10 border border-[#F2B04B]/30 text-[#F2B04B] flex items-center justify-center font-bold text-xs">
                    {m.name.slice(0, 1)}
                  </div>
                  <div>
                    {/* 名前を直接編集できるように修正 */}
                    <input
                      type="text"
                      value={m.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const updated = e.target.value;
                        setMembers(members.map(mem => mem.id === m.id ? { ...mem, name: updated } : mem));
                      }}
                      onBlur={(e) => updateMemberName(m.id, e.target.value)}
                      className="bg-transparent font-bold text-xs text-[#F0F6FC] focus:outline-none focus:border-b focus:border-[#F2B04B] w-32"
                    />
                    <div className="text-[11px] text-[#8B949E] mt-0.5">
                      目標項目：{items.length}件[cite: 3]
                    </div>
                  </div>
                </div>
                <div className="text-[#8B949E]">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#30363D] space-y-3 bg-[#0D1117]/40">
                  <div className="space-y-2 pt-2">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-[#F0F6FC]">
                          {it.label}{" "}
                          <span className="text-[#8B949E] font-normal ml-1">
                            (目標: {it.target}{it.unit}/月)
                          </span>
                        </span>
                        <button
                          onClick={() => removeItem(m.id, it.id)}
                          className="text-[#6E7681] hover:text-[#FF8585] p-1 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-2.5">
                    <div className="text-[11px] font-bold text-[#8B949E]">新しい目標項目を追加</div>
                    <div className="flex gap-2">
                      <input
                        value={newItemLabels[m.id] || ""}
                        onChange={(e) =>
                          setNewItemLabels({ ...newItemLabels, [m.id]: e.target.value })
                        }
                        placeholder="項目名（例: 紹介数）[cite: 3]"
                        className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                      />
                      <input
                        value={newItemTargets[m.id] || ""}
                        onChange={(e) =>
                          setNewItemTargets({
                            ...newItemTargets,
                            [m.id]: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                        inputMode="numeric"
                        placeholder="目標[cite: 3]"
                        className="w-14 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-center text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                      />
                      <select
                        value={newItemUnits[m.id] || "件"}
                        onChange={(e) =>
                          setNewItemUnits({ ...newItemUnits, [m.id]: e.target.value })
                        }
                        className="w-16 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                      >
                        <option value="件">件</option>
                        <option value="万円">万円</option>
                        <option value="回">回</option>
                        <option value="人">人</option>
                        <option value="本">本</option>
                      </select>
                      <button
                        onClick={() => addItem(m.id)}
                        className="bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#F2B04B] p-2 rounded-lg shrink-0 flex items-center justify-center transition-all"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 text-right">
                    <button
                      onClick={() => deleteMember(m.id)}
                      className="text-[11px] text-[#FF8585] hover:underline flex items-center gap-1 ml-auto font-medium"
                    >
                      <Trash2 size={12} />
                      このメンバーを削除[cite: 3]
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= SHEET TAB =================
function SheetTab({ members, selectedMemberId, setSelectedMemberId }) {
  const [week, setWeek] = useState(currentWeekLabel());
  const [viewMode, setViewMode] = useState("week");
  const [achievements, setAchievements] = useState({});
  const [reflection, setReflection] = useState("");
  const [nextActions, setNextActions] = useState([{ when: "", who: "", what: "" }]);
  const [executionChecks, setExecutionChecks] = useState([]);
  const [prevPrevNotDone, setPrevPrevNotDone] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [records, setRecords] = useState([]);

  const member = members.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (!member) return;
    setLoadingRecord(true);

    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const allRecords = await res.json();
        setRecords(allRecords || []);
        
        const currentRec = allRecords.find((r) => r.week === week);
        if (currentRec) {
          setAchievements(currentRec.achievements || {});
          setReflection(currentRec.reflection || "");
          setNextActions(
            currentRec.nextActions && currentRec.nextActions.length
              ? currentRec.nextActions
              : [{ when: "", who: "", what: "" }]
          );
          setExecutionChecks(currentRec.executionChecks || []);
        } else {
          setAchievements({});
          setReflection("");
          setNextActions([{ when: "", who: "", what: "" }]);

          if (allRecords.length > 0) {
            const prevRec = allRecords[allRecords.length - 1];
            const prevActions = (prevRec?.nextActions || []).filter((a) => a.when || a.who || a.what);
            setExecutionChecks(prevActions.map((a) => ({ ...a, done: null, note: "" })));

            const prevExec = prevRec?.executionChecks || [];
            const repeated = prevExec.filter((e) => e.done === false).map((e) => e.what);
            setPrevPrevNotDone(repeated);
          } else {
            setExecutionChecks([]);
            setPrevPrevNotDone([]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingRecord(false);
        setSaved(false);
      }
    })();
  }, [member?.id, week]);

  if (!members.length) {
    return (
      <div className="pt-20 text-center text-xs text-[#8B949E]">
        先に「メンバー設定」タブでメンバーと目標項目を登録してください
      </div>
    );
  }

  const getAdjustedMonth = (weekStr) => {
    if (!weekStr) return null;
    const match = weekStr.match(/(\d{1,2})[\/\-月](\d{1,2})?/);
    if (!match) return null;
    let m = parseInt(match[1], 10);
    let d = match[2] ? parseInt(match[2], 10) : null;

    if (m === 9 && d && d >= 28) {
      return 10;
    }
    return m;
  };

  const targetMonth = getAdjustedMonth(week);

  const pastMonthRecords = (records || []).filter((r) => {
    const isTargetMember = (r.memberId && r.memberId === member?.id) || (r.name && r.name === member?.name);
    if (!isTargetMember || !r.week || r.week === week) return false;

    return getAdjustedMonth(r.week) === targetMonth;
  });

  const currentItems = member?.items || [];

  const monthlyTotals = {};
  currentItems.forEach((it) => {
    let sum = Number(achievements[it.id]?.actual ?? 0);
    pastMonthRecords.forEach((r) => {
      const ach = r.achievements || {};
      if (ach[it.id]?.actual) {
        sum += Number(ach[it.id].actual);
      }
    });
    monthlyTotals[it.id] = sum;
  });

  let avgRate = 0;
  if (viewMode === "week") {
    avgRate = currentItems.length
      ? Math.round(
          currentItems.reduce((sum, it) => {
            const actual = Number(achievements[it.id]?.actual ?? 0);
            return sum + Math.min(100, (actual / it.target) * 100 || 0);
          }, 0) / currentItems.length
        )
      : 0;
  } else {
    avgRate = currentItems.length
      ? Math.round(
          currentItems.reduce((sum, it) => {
            const totalActual = monthlyTotals[it.id] || 0;
            return sum + Math.min(100, (totalActual / it.target) * 100 || 0);
          }, 0) / currentItems.length
        )
      : 0;
  }

  const save = async () => {
    setLoadingRecord(true);
    const cleanActions = nextActions.filter((a) => a.when || a.who || a.what);

    const payload = {
      action: "saveRecord",
      payload: {
        memberId: member.id,
        week: week,
        actualValue: 0,
        achievementRate: avgRate,
        reflection: reflection,
        nextAction: JSON.stringify(cleanActions),
        executionChecks: JSON.stringify(executionChecks),
        achievements: JSON.stringify(achievements)
      }
    };

    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      alert("保存に失敗しました。通信環境を確認してください。");
      console.error(e);
    } finally {
      setLoadingRecord(false);
    }
  };

  return (
    <div className="pt-5 space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-none">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMemberId(m.id)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              m.id === selectedMemberId
                ? "bg-[#F2B04B] text-[#0D1117] border-[#F2B04B] shadow-sm"
                : "bg-[#161B22] text-[#8B949E] border-[#30363D] hover:border-[#484F58]"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-2.5 bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#C9D1D9]">
        <Calendar size={15} className="text-[#8B949E] shrink-0" />
        <span className="text-[#8B949E]">対象週:</span>
        <input
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="bg-transparent flex-1 text-xs font-semibold text-[#F0F6FC] focus:outline-none"
        />
      </div>
      
      <div className="flex bg-[#161B22] border border-[#30363D] p-1 rounded-xl gap-1">
        <button
          onClick={() => setViewMode("week")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            viewMode === "week"
              ? "bg-[#F2B04B] text-[#0D1117] shadow-sm"
              : "text-[#8B949E] hover:text-[#C9D1D9]"
          }`}
        >
          週の達成率
        </button>
        <button
          onClick={() => setViewMode("month")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            viewMode === "month"
              ? "bg-[#F2B04B] text-[#0D1117] shadow-sm"
              : "text-[#8B949E] hover:text-[#C9D1D9]"
          }`}
        >
          月の達成率（累計）
        </button>
      </div>

      {member && (!member.items || member.items.length === 0) && (
        <div className="text-xs text-[#8B949E] text-center py-10 bg-[#161B22]/50 border border-[#30363D] rounded-xl">
          {member.name}さんの目標項目が未登録です。「メンバー設定」で追加してください。
        </div>
      )}

      {member && member.items && member.items.length > 0 && (
        <>
          {executionChecks.length > 0 && (
            <div className="bg-[#161B22] border border-[#ED4245]/30 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="text-[11px] font-bold text-[#FF8585] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8585]"></span>
                先週決めたアクションの振り返り
              </div>
              {executionChecks.map((e, idx) => {
                const isRepeat = e.done === false && prevPrevNotDone.includes(e.what);
                return (
                  <div key={idx} className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 space-y-2.5">
                    <div className="text-xs text-[#C9D1D9] font-medium leading-relaxed">
                      <span className="text-[#8B949E]">【行動】</span> {e.when || "―"} ／ {e.who || "―"} ／ {e.what || "―"}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const next = [...executionChecks];
                          next[idx] = { ...next[idx], done: true };
                          setExecutionChecks(next);
                        }}
                        className={`flex-1 text-xs font-bold rounded-lg py-1.5 border transition-all ${
                          e.done === true
                            ? "bg-[#238636] border-[#238636] text-white shadow-sm"
                            : "bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#484F58]"
                        }`}
                      >
                        できた
                      </button>
                      <button
                        onClick={() => {
                          const next = [...executionChecks];
                          next[idx] = { ...next[idx], done: false };
                          setExecutionChecks(next);
                        }}
                        className={`flex-1 text-xs font-bold rounded-lg py-1.5 border transition-all ${
                          e.done === false
                            ? "bg-[#DA3633] border-[#DA3633] text-white shadow-sm"
                            : "bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#484F58]"
                        }`}
                      >
                        できなかった
                      </button>
                    </div>
                    <input
                      value={e.note || ""}
                      onChange={(ev) => {
                        const next = [...executionChecks];
                        next[idx] = { ...next[idx], note: ev.target.value };
                        setExecutionChecks(next);
                      }}
                      placeholder={e.done === false ? "何が障害だった？" : "結果はどうだった？"}
                      className="w-full bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                    />
                    {isRepeat && (
                      <div className="text-[11px] text-[#FF8585] font-semibold bg-[#ED4245]/10 border border-[#ED4245]/20 rounded-lg px-2.5 py-1.5">
                        2週連続で未達です。今週は「方法・相手・目標」のいずれかを見直しましょう
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-gradient-to-r from-[#161B22] to-[#21262D] border border-[#30363D] rounded-xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider">
                {viewMode === "week" ? "今週の平均達成率" : "今月の累計達成率"}
              </div>
              <div className="text-3xl font-extrabold text-[#F2B04B] tabular-nums mt-0.5">
                {avgRate}<span className="text-xl ml-0.5">%</span>
              </div>
            </div>
            <div className="text-right text-[11px] text-[#8B949E] leading-relaxed">
              {viewMode === "week" ? (
                <>
                  登録項目数：<span className="text-[#F0F6FC] font-semibold">{member.items.length}</span> 件
                  <br />
                  {week}
                </>
              ) : (
                <>
                  {targetMonth ? `${targetMonth}月` : ""}累計モード
                  <br />
                  <span className="text-[#F0F6FC] font-semibold">9/28週等も含めて自動集計</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {member.items.map((it) => {
              const actual = achievements[it.id]?.actual ?? "";
              const valForCalc = viewMode === "week" ? Number(actual) || 0 : monthlyTotals[it.id] || 0;
              const rate = Math.min(
                100,
                Math.round((valForCalc / it.target) * 100)
              );

              return (
                <div
                  key={it.id}
                  className="bg-[#161B22] border border-[#30363D] rounded-xl p-3.5 shadow-sm space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#F0F6FC]">{it.label}</span>
                    <div className="text-right">
                      <span className="text-[#8B949E]">
                        目標: <strong className="text-[#C9D1D9]">{it.target}</strong> {it.unit}
                      </span>
                    </div>
                  </div>

                  {viewMode === "week" ? (
                    // 週の達成率モード：入力欄を表示
                    <div className="flex items-center gap-3">
                      <input
                        value={actual}
                        onChange={(e) =>
                          setAchievements({
                            ...achievements,
                            [it.id]: { actual: e.target.value.replace(/[^0-9.]/g, "") },
                          })
                        }
                        inputMode="decimal"
                        placeholder="0"
                        className="w-16 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1.5 text-xs text-center font-bold text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                      />
                      <span className="text-xs text-[#8B949E] shrink-0">{it.unit}</span>
                      <div className="flex-1 h-2 bg-[#21262D] rounded-full overflow-hidden border border-[#30363D]/40">
                        <div
                          className="h-full bg-[#F2B04B] transition-all duration-300"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs w-10 text-right tabular-nums font-semibold text-[#8B949E]">
                        {rate}%
                      </span>
                    </div>
                  ) : (
                    // 月の達成率モード（累計）：入力欄をなくして累計結果のみをすっきり表示
                    <div className="flex items-center gap-3 pt-1">
                      <div className="text-xs text-[#F2B04B] font-bold shrink-0">
                        月間累計: <span className="text-sm">{monthlyTotals[it.id] || 0}</span> {it.unit}
                      </div>
                      <div className="flex-1 h-2 bg-[#21262D] rounded-full overflow-hidden border border-[#30363D]/40">
                        <div
                          className="h-full bg-[#F2B04B] transition-all duration-300"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs w-10 text-right tabular-nums font-semibold text-[#8B949E]">
                        {rate}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-bold text-[#C9D1D9] mb-1.5 block">
                この一週間の振り返り
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                placeholder="うまくいった要因・改善点は？"
                className="w-full bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B] resize-none leading-relaxed"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#C9D1D9] mb-1 block">
                来週の具体アクション（5W1H）
              </label>
              <p className="text-[11px] text-[#8B949E] mb-2.5">
                行動を迷わないよう「いつ・誰に・何を」まで具体化します。
              </p>
              <div className="space-y-2.5">
                {nextActions.map((a, idx) => (
                  <div key={idx} className="bg-[#0D1117] border border-[#30363D] rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-[#F2B04B]">
                        アクション {idx + 1}
                      </span>
                      {nextActions.length > 1 && (
                        <button
                          onClick={() =>
                            setNextActions(nextActions.filter((_, i) => i !== idx))
                          }
                          className="p-1 text-[#6E7681] hover:text-[#FF8585]"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={a.when}
                        onChange={(e) => {
                          const next = [...nextActions];
                          next[idx] = { ...next[idx], when: e.target.value };
                          setNextActions(next);
                        }}
                        placeholder="いつ（例: 火曜10時）"
                        className="bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                      />
                      <input
                        value={a.who}
                        onChange={(e) => {
                          const next = [...nextActions];
                          next[idx] = { ...next[idx], who: e.target.value };
                          setNextActions(next);
                        }}
                        placeholder="誰に（例: ○○様）"
                        className="bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                      />
                    </div>
                    <input
                      value={a.what}
                      onChange={(e) => {
                        const next = [...nextActions];
                        next[idx] = { ...next[idx], what: e.target.value };
                        setNextActions(next);
                      }}
                      placeholder="何を（例: LINEで進捗報告メッセージを送る）"
                      className="w-full bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setNextActions([...nextActions, { when: "", who: "", what: "" }])
                }
                className="mt-2 text-xs text-[#F2B04B] hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus size={14} strokeWidth={2.5} />
                アクションを追加
              </button>
            </div>
          </div>

          <button
            onClick={save}
            disabled={loadingRecord}
            className="w-full bg-[#F2B04B] hover:bg-[#E8A33D] text-[#0D1117] font-bold text-sm rounded-xl py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md mt-2"
          >
            {saved ? (
              "保存を完了しました！"
            ) : (
              <>
                <Save size={16} strokeWidth={2.5} />
                この週の記録を保存
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

// ================= HISTORY TAB =================
function HistoryTab({ members, selectedMemberId, setSelectedMemberId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyViewMode, setHistoryViewMode] = useState("week");

  const member = members.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const data = await res.json();
        setRecords(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [member?.id]);

  if (!members.length) {
    return (
      <div className="pt-20 text-center text-xs text-[#8B949E]">
        先に「メンバー設定」タブでメンバーを登録してください
      </div>
    );
  }

  const weeklyChartData = records.map((r) => ({
    label: r.week,
    rate: r.achievementRate
  }));

  const monthlyRatesMap = {};

  records.forEach((r) => {
    if (!r.week || r.achievementRate === undefined || r.achievementRate === null) return;

    const match = r.week.match(/(\d{1,2})[\/\-月](\d{1,2})?/);

    if (match) {
      let month = parseInt(match[1], 10);
      const day = match[2] ? parseInt(match[2], 10) : null;

      if (month === 9 && day && day >= 28) {
        month = 10;
      }

      const monthKey = `${month}月`;
      if (!monthlyRatesMap[monthKey]) {
        monthlyRatesMap[monthKey] = [];
      }
      monthlyRatesMap[monthKey].push(Number(r.achievementRate));
    } else {
      if (!monthlyRatesMap[r.week]) {
        monthlyRatesMap[r.week] = [];
      }
      monthlyRatesMap[r.week].push(Number(r.achievementRate));
    }
  });

  const monthlyChartData = Object.keys(monthlyRatesMap).map((key) => {
    const rates = monthlyRatesMap[key];
    const sum = rates.reduce((acc, curr) => acc + curr, 0);
    const avg = rates.length > 0 ? Math.round(sum / rates.length) : 0;

    return {
      label: key,
      rate: avg
    };
  });

  const chartData = historyViewMode === "week" ? weeklyChartData : monthlyChartData;

  return (
    <div className="pt-5 space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-none">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMemberId(m.id)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              m.id === selectedMemberId
                ? "bg-[#F2B04B] text-[#0D1117] border-[#F2B04B] shadow-sm"
                : "bg-[#161B22] text-[#8B949E] border-[#30363D] hover:border-[#484F58]"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-xs text-[#8B949E] py-12">データを読み込み中…</div>
      ) : chartData.length === 0 ? (
        <div className="text-center text-xs text-[#8B949E] py-12 bg-[#161B22]/50 border border-[#30363D] rounded-xl">
          まだ記録がありません。1on1シートで記録を保存してください。
        </div>
      ) : (
        <>
          <div className="flex bg-[#161B22] border border-[#30363D] p-1 rounded-xl gap-1 mb-4">
            <button
              onClick={() => setHistoryViewMode("week")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                historyViewMode === "week"
                  ? "bg-[#F2B04B] text-[#0D1117] shadow-sm"
                  : "text-[#8B949E] hover:text-[#C9D1D9]"
              }`}
            >
              週ごとの推移
            </button>
            <button
              onClick={() => setHistoryViewMode("month")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                historyViewMode === "month"
                  ? "bg-[#F2B04B] text-[#0D1117] shadow-sm"
                  : "text-[#8B949E] hover:text-[#C9D1D9]"
              }`}
            >
              月ごとの推移
            </button>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4.5 shadow-sm">
            <div className="text-xs font-bold text-[#C9D1D9] mb-3">
              {historyViewMode === "week" ? "週別 達成率推移グラフ（%）" : "月別 達成率推移グラフ（%）"}
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#30363D" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8B949E", fontSize: 10 }} axisLine={{ stroke: "#30363D" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8B949E", fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={70} stroke="#ED4245" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ background: "#161B22", border: "1px solid #30363D", borderRadius: 8, fontSize: 12, color: "#F0F6FC" }}
                  labelStyle={{ color: "#F2B04B", fontWeight: "bold" }}
                  formatter={(value) => [`${value}%`, "達成率"]}
                />
                <Line type="monotone" dataKey="rate" name="達成率" stroke="#F2B04B" strokeWidth={2.5} dot={{ r: 4, fill: "#F2B04B" }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-[10px] text-[#8B949E] mt-2 flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#ED4245] inline-block"></span>
              達成目標ライン (70%)
            </div>
          </div>

          <div className="space-y-3">
            {[...records].reverse().map((rec, idx) => (
              <div key={idx} className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm space-y-2">
                <div className="text-xs font-bold text-[#F2B04B] border-b border-[#30363D]/60 pb-1.5 flex justify-between">
                  <span>{rec.week}</span>
                  <span className="text-[#C9D1D9]">達成率: {rec.achievementRate}%</span>
                </div>
                {rec.reflection && (
                  <div className="text-xs text-[#C9D1D9] whitespace-pre-wrap leading-relaxed">
                    <span className="text-[#8B949E] font-medium block mb-0.5">振り返り:</span>
                    {rec.reflection}
                  </div>
                )}
                {rec.executionChecks && rec.executionChecks.length > 0 && (
                  <div className="text-xs text-[#C9D1D9] space-y-1">
                    <span className="text-[#8B949E] font-medium">先週の実行結果:</span>
                    {rec.executionChecks.map((e, i) => (
                      <div key={i} className="pl-2 text-[11px] text-[#8B949E]">
                        {e.done === true ? "✓ 実行" : e.done === false ? "✕ 未達" : "―"} {e.what || "―"}
                        {e.note ? `（${e.note}）` : ""}
                      </div>
                    ))}
                  </div>
                )}
                {rec.nextActions && rec.nextActions.length > 0 && (
                  <div className="text-xs text-[#C9D1D9] space-y-1 pt-1">
                    <span className="text-[#8B949E] font-medium">決定アクション:</span>
                    {rec.nextActions.map((a, i) => (
                      <div key={i} className="pl-2 text-[11px] text-[#C9D1D9]">
                        ・{a.when || "―"} ／ {a.who || "―"} ／ {a.what || "―"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
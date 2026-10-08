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

// ================= MEMBERS TAB =================
function MembersTab({ members, setMembers }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState([{ label: "", target: "", unit: "" }]);
  
  // 編集・展開しているメンバーのIDを管理（nullなら全て閉じている状態）
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const addItemField = () => {
    setItems([...items, { label: "", target: "", unit: "" }]);
  };

  const removeItemField = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleAddMember = () => {
    if (!name.trim()) {
      alert("メンバー名を入力してください");
      return;
    }
    const validItems = items.filter((i) => i.label.trim() && i.target);
    if (validItems.length === 0) {
      alert("有効な目標項目を1件以上入力してください");
      return;
    }

    const newMember = {
      id: "m_" + Date.now(),
      name: name.trim(),
      items: validItems.map((item, idx) => ({
        id: "item_" + Date.now() + "_" + idx,
        label: item.label,
        target: Number(item.target),
        unit: item.unit || "件"
      }))
    };

    setMembers([...members, newMember]);
    setName("");
    setItems([{ label: "", target: "", unit: "" }]);
  };

  const handleDeleteMember = (id) => {
    if (!confirm("本当にこのメンバーを削除しますか？")) return;
    setMembers(members.filter((m) => m.id !== id));
    if (expandedMemberId === id) setExpandedMemberId(null);
  };

  // 編集パネルを開閉した時の初期値セット
  const toggleExpand = (m) => {
    if (expandedMemberId === m.id) {
      setExpandedMemberId(null);
    } else {
      setExpandedMemberId(m.id);
      // 編集用のローカルステートに現在の値をコピー
      setEditValues({
        name: m.name,
        items: m.items ? JSON.parse(JSON.stringify(m.items)) : []
      });
    }
  };

  const handleUpdateEditItem = (idx, field, value) => {
    const newItems = [...editValues.items];
    newItems[idx][field] = value;
    setEditValues({ ...editValues, items: newItems });
  };

  const handleAddEditItem = () => {
    setEditValues({
      ...editValues,
      items: [...editValues.items, { id: "item_" + Date.now(), label: "", target: "", unit: "件" }]
    });
  };

  const handleRemoveEditItem = (idx) => {
    setEditValues({
      ...editValues,
      items: editValues.items.filter((_, i) => i !== idx)
    });
  };

  const handleSaveMember = (id) => {
    if (!editValues.name.trim()) {
      alert("メンバー名を入力してください");
      return;
    }
    const updated = members.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          name: editValues.name.trim(),
          items: editValues.items.map((it) => ({
            ...it,
            target: Number(it.target) || 0
          }))
        };
      }
      return m;
    });
    setMembers(updated);
    setExpandedMemberId(null);
    alert("メンバー情報を更新しました！");
  };

  return (
    <div className="pt-5 space-y-6 max-w-2xl mx-auto px-4">
      <div className="text-xs text-[#8B949E] text-center">
        メンバーごとに追う目標項目（KPI）を登録します。データは全員共通で更新されます。
      </div>

      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="メンバー名（例：田中さん）"
            className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
          />
          <button
            onClick={handleAddMember}
            className="bg-[#F2B04B] hover:bg-[#E8A33D] text-[#0D1117] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
          >
            <Plus size={15} strokeWidth={2.5} />
            追加
          </button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-[#30363D]/60">
            <div className="text-[11px] font-semibold text-[#8B949E] pt-2">初期目標項目の設定</div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-[#0D1117] p-2 rounded-xl border border-[#30363D]">
                <input
                  value={item.label}
                  onChange={(e) => updateItem(idx, "label", e.target.value)}
                  placeholder="項目名 (例: 売上)"
                  className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                />
                <input
                  value={item.target}
                  onChange={(e) => updateItem(idx, "target", e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="目標数"
                  className="w-16 bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-center text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                />
                <input
                  value={item.unit}
                  onChange={(e) => updateItem(idx, "unit", e.target.value)}
                  placeholder="単位"
                  className="w-16 bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-center text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                />
                {items.length > 1 && (
                  <button
                    onClick={() => removeItemField(idx)}
                    className="p-1 text-[#6E7681] hover:text-[#FF8585]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addItemField}
              className="text-xs text-[#F2B04B] hover:underline flex items-center gap-1 font-semibold pt-1"
            >
              <Plus size={13} strokeWidth={2.5} />
              項目を追加
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {members.length === 0 ? (
          <div className="text-xs text-[#8B949E] text-center py-10 bg-[#161B22]/50 border border-[#30363D] rounded-xl">
            メンバーが登録されていません
          </div>
        ) : (
          members.map((m) => {
            const isExpanded = expandedMemberId === m.id;
            const initialChar = m.name ? m.name.charAt(0) : "M";

            return (
              <div
                key={m.id}
                className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden transition-all shadow-sm"
              >
                {/* 一覧行（クリックまたは右側矢印で展開） */}
                <div
                  onClick={() => toggleExpand(m)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#21262D]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#21262D] border border-[#30363D] flex items-center justify-center text-xs font-bold text-[#F2B04B]">
                      {initialChar}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#F0F6FC]">{m.name}</div>
                      <div className="text-xs text-[#8B949E] mt-0.5">
                        目標項目：{m.items?.length || 0} 件
                      </div>
                    </div>
                  </div>
                  <button className="p-2 text-[#8B949E] hover:text-[#F0F6FC] transition-transform">
                    <ChevronRight
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        isExpanded ? "rotate-90 text-[#F2B04B]" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* 展開されたときのみ表示される編集エリア */}
                {isExpanded && (
                  <div className="bg-[#0D1117] border-t border-[#30363D] p-4 space-y-4 animate-fadeIn">
                    <div>
                      <label className="text-xs font-semibold text-[#8B949E] block mb-1">
                        メンバー名編集
                      </label>
                      <input
                        value={editValues.name}
                        onChange={(e) =>
                          setEditValues({ ...editValues, name: e.target.value })
                        }
                        className="w-full bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[#8B949E] block">
                        目標項目の編集
                      </label>
                      {editValues.items.map((it, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-[#161B22] p-2 rounded-xl border border-[#30363D]">
                          <input
                            value={it.label}
                            onChange={(e) => handleUpdateEditItem(idx, "label", e.target.value)}
                            placeholder="項目名"
                            className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                          />
                          <input
                            value={it.target}
                            onChange={(e) =>
                              handleUpdateEditItem(idx, "target", e.target.value.replace(/[^0-9.]/g, ""))
                            }
                            placeholder="目標数"
                            className="w-16 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-center text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                          />
                          <input
                            value={it.unit}
                            onChange={(e) => handleUpdateEditItem(idx, "unit", e.target.value)}
                            placeholder="単位"
                            className="w-16 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-center text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                          />
                          <button
                            onClick={() => handleRemoveEditItem(idx)}
                            className="p-1 text-[#6E7681] hover:text-[#FF8585]"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleAddEditItem}
                        className="text-xs text-[#F2B04B] hover:underline flex items-center gap-1 font-semibold pt-1"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                        項目を追加
                      </button>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#30363D]/60">
                      <button
                        onClick={() => handleSaveMember(m.id)}
                        className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        変更を保存
                      </button>
                      <button
                        onClick={() => handleDeleteMember(m.id)}
                        className="bg-[#DA3633]/20 hover:bg-[#DA3633]/30 text-[#FF8585] border border-[#DA3633]/40 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
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

  // React.useRef を使用してエラーを回避
  const dateInputRef = React.useRef(null);

  const member = members.find((m) => m.id === selectedMemberId);

  // カレンダーで日付が選択された時の処理（YYYY-MM-DD -> M/D週）
  const handleDateChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const dateObj = new Date(val);
    if (!isNaN(dateObj.getTime())) {
      const m = dateObj.getMonth() + 1;
      const d = dateObj.getDate();
      setWeek(`${m}/${d}週`);
    }
  };

  // アイコンクリック時にカレンダーを強制オープン
  const openDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === "function") {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

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

  // 対象週の「月」を取得（例: 10/5週 -> 10）
  const match = week ? week.match(/(\d{1,2})[\/\-月](\d{1,2})?/) : null;
  let targetMonth = match ? parseInt(match[1], 10) : null;
  const targetDay = match && match[2] ? parseInt(match[2], 10) : null;

  if (targetMonth === 9 && targetDay && targetDay >= 28) {
    targetMonth = 10;
  }

  // 同月の過去レコード（選択中の週を除く）を抽出
  const pastMonthRecords = (records || []).filter((r) => {
    const isTargetMember = (r.memberId && r.memberId === member?.id) || (r.name && r.name === member?.name);
    if (!isTargetMember || !r.week || r.week === week) return false;

    const rMatch = r.week.match(/(\d{1,2})[\/\-月](\d{1,2})?/);
    if (rMatch) {
      let m = parseInt(rMatch[1], 10);
      let d = rMatch[2] ? parseInt(rMatch[2], 10) : null;
      if (m === 9 && d && d >= 28) m = 10;
      return m === targetMonth;
    }
    return false;
  });

  const currentItems = member?.items || [];

  // 各目標項目の月間累計実績値を算出（同月の過去週の実績 + 今週の入力値）
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

  // 全項目の平均達成率（週モード / 月累計モード）
  let avgRate = 0;
  if (viewMode === "week") {
    avgRate = currentItems.length
      ? Math.round(
          currentItems.reduce((sum, it) => {
            const actual = Number(achievements[it.id]?.actual ?? 0);
            return sum + (it.target > 0 ? (actual / it.target) * 100 : 0);
          }, 0) / currentItems.length
        )
      : 0;
  } else {
    avgRate = currentItems.length
      ? Math.round(
          currentItems.reduce((sum, it) => {
            const totalActual = monthlyTotals[it.id] || 0;
            return sum + (it.target > 0 ? (totalActual / it.target) * 100 : 0);
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
      
      {/* 対象週設定バー */}
      <div className="flex items-center gap-2.5 bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#C9D1D9] relative">
        <button
          type="button"
          onClick={openDatePicker}
          className="p-1 -m-1 text-[#8B949E] hover:text-[#F2B04B] transition-colors cursor-pointer rounded-md focus:outline-none flex items-center justify-center"
          title="カレンダーから日付を選択"
        >
          <Calendar size={16} />
        </button>

        {/* 隠し日付入力フィールド（クリック時に showPicker を発火） */}
        <input
          type="date"
          ref={dateInputRef}
          onChange={handleDateChange}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />

        <span className="text-[#8B949E] shrink-0">対象週:</span>
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
                  <span className="text-[#F0F6FC] font-semibold">過去週＋今週入力を自動集計</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {member.items.map((it) => {
              const actual = achievements[it.id]?.actual ?? "";
              const valForCalc = viewMode === "week" ? Number(actual) || 0 : monthlyTotals[it.id] || 0;
              const rate = it.target > 0 ? Math.round((valForCalc / it.target) * 100) : 0;

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
                      {viewMode === "month" && (
                        <div className="text-[10px] text-[#F2B04B] font-semibold mt-0.5">
                          今月累計: {monthlyTotals[it.id] || 0} {it.unit}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {viewMode === "week" ? (
                      <>
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
                      </>
                    ) : (
                      <div className="text-xs font-semibold text-[#F2B04B] shrink-0 min-w-[70px]">
                        累計: {monthlyTotals[it.id] || 0} {it.unit}
                      </div>
                    )}

                    <div className="flex-1 h-2 bg-[#21262D] rounded-full overflow-hidden border border-[#30363D]/40">
                      <div
                        className="h-full bg-[#F2B04B] transition-all duration-300"
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs w-10 text-right tabular-nums font-semibold text-[#8B949E]">
                      {rate}%
                    </span>
                  </div>
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
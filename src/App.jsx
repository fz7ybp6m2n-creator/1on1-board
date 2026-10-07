import React, { useState, useEffect, Component } from "react";
import { Calendar, Save, Plus, X, Users, FileText, BarChart2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from "recharts";

// ================= クラッシュ防止用 Error Boundary =================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Component Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-[#161B22] border border-[#DA3633] rounded-xl text-center my-6">
          <h3 className="text-sm font-bold text-[#FF8585] mb-2">レンダリングエラーが発生しました</h3>
          <p className="text-xs text-[#8B949E] font-mono break-all mb-4">
            {this.state.error && this.state.error.toString()}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 bg-[#21262D] border border-[#30363D] rounded-lg text-xs font-semibold text-[#F0F6FC] hover:border-[#484F58]"
          >
            ページを再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================= 共通ヘルパー関数 =================
function getAdjustedMonth(weekStr) {
  if (!weekStr || typeof weekStr !== "string") return null;
  const match = weekStr.match(/(\d{1,2})[\/\-月](\d{1,2})/);
  if (!match) {
    const mMatch = weekStr.match(/(\d{1,2})/);
    return mMatch ? parseInt(mMatch[1], 10) : null;
  }
  let m = parseInt(match[1], 10);
  let d = parseInt(match[2], 10);

  if (d >= 28) {
    m = m === 12 ? 1 : m + 1;
  }
  return m;
}

// ================= 1. SHEET TAB (1on1シート) =================
export function SheetTab({
  members = [],
  selectedMemberId,
  setSelectedMemberId,
  GAS_API_URL,
  currentWeekLabel
}) {
  const [week, setWeek] = useState(() =>
    typeof currentWeekLabel === "function" ? currentWeekLabel() : "9/28"
  );
  const [viewMode, setViewMode] = useState("week");
  const [achievements, setAchievements] = useState({});
  const [reflection, setReflection] = useState("");
  const [nextActions, setNextActions] = useState([{ when: "", who: "", what: "" }]);
  const [executionChecks, setExecutionChecks] = useState([]);
  const [prevPrevNotDone, setPrevPrevNotDone] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [records, setRecords] = useState([]);

  const member = Array.isArray(members) ? members.find((m) => m.id === selectedMemberId) : null;

  useEffect(() => {
    if (!member || !GAS_API_URL) return;
    let ignore = false;
    setLoadingRecord(true);

    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const allRecords = await res.json();
        if (ignore) return;

        const recordList = Array.isArray(allRecords) ? allRecords : [];
        setRecords(recordList);

        const currentRec = recordList.find((r) => r.week === week);
        if (currentRec) {
          setAchievements(currentRec.achievements || {});
          setReflection(currentRec.reflection || "");
          setNextActions(
            Array.isArray(currentRec.nextActions) && currentRec.nextActions.length > 0
              ? currentRec.nextActions
              : [{ when: "", who: "", what: "" }]
          );
          setExecutionChecks(Array.isArray(currentRec.executionChecks) ? currentRec.executionChecks : []);
        } else {
          setAchievements({});
          setReflection("");
          setNextActions([{ when: "", who: "", what: "" }]);

          if (recordList.length > 0) {
            const prevRec = recordList[recordList.length - 1];
            const prevActions = (Array.isArray(prevRec?.nextActions) ? prevRec.nextActions : []).filter(
              (a) => a && (a.when || a.who || a.what)
            );
            setExecutionChecks(prevActions.map((a) => ({ ...a, done: null, note: "" })));

            const prevExec = Array.isArray(prevRec?.executionChecks) ? prevRec.executionChecks : [];
            const repeated = prevExec.filter((e) => e && e.done === false).map((e) => e.what);
            setPrevPrevNotDone(repeated);
          } else {
            setExecutionChecks([]);
            setPrevPrevNotDone([]);
          }
        }
      } catch (e) {
        if (!ignore) console.error("レコードの取得に失敗しました:", e);
      } finally {
        if (!ignore) {
          setLoadingRecord(false);
          setSaved(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [member?.id, week, GAS_API_URL]);

  if (!members || !members.length) {
    return (
      <div className="pt-20 text-center text-xs text-[#8B949E]">
        先に「メンバー設定」タブでメンバーと目標項目を登録してください
      </div>
    );
  }

  const targetMonth = getAdjustedMonth(week);

  const pastMonthRecords = (records || []).filter((r) => {
    if (!r) return false;
    const isTargetMember =
      (r.memberId && r.memberId === member?.id) || (r.name && r.name === member?.name);
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
  if (currentItems.length > 0) {
    const totalRate = currentItems.reduce((sum, it) => {
      const targetVal = Number(it.target) || 0;
      if (targetVal <= 0) return sum;

      const valForCalc =
        viewMode === "week"
          ? Number(achievements[it.id]?.actual ?? 0)
          : monthlyTotals[it.id] || 0;

      const itemRate = Math.min(100, (valForCalc / targetVal) * 100);
      return sum + itemRate;
    }, 0);

    avgRate = Math.round(totalRate / currentItems.length);
  }

  const save = async () => {
    if (!member) return;
    setLoadingRecord(true);
    const cleanActions = nextActions.filter((a) => a && (a.when || a.who || a.what));

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
      } else {
        throw new Error(result.message || "Save failed");
      }
    } catch (e) {
      alert("保存に失敗しました。通信環境を確認してください。");
      console.error(e);
    } finally {
      setLoadingRecord(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="pt-5 space-y-5">
        {/* メンバー切り替え */}
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

        {/* 対象週 */}
        <div className="flex items-center gap-2.5 bg-[#161B22] border border-[#30363D] rounded-xl px-3.5 py-2.5 text-xs text-[#C9D1D9]">
          <Calendar size={15} className="text-[#8B949E] shrink-0" />
          <span className="text-[#8B949E]">対象週:</span>
          <input
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="bg-transparent flex-1 text-xs font-semibold text-[#F0F6FC] focus:outline-none"
          />
        </div>

        {/* 表示切替 */}
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

        {/* 目標未登録時 */}
        {member && (!member.items || member.items.length === 0) && (
          <div className="text-xs text-[#8B949E] text-center py-10 bg-[#161B22]/50 border border-[#30363D] rounded-xl">
            {member.name}さんの目標項目が未登録です。「メンバー設定」で追加してください。
          </div>
        )}

        {member && member.items && member.items.length > 0 && (
          <>
            {/* 先週のアクション振り返り */}
            {executionChecks.length > 0 && (
              <div className="bg-[#161B22] border border-[#ED4245]/30 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="text-[11px] font-bold text-[#FF8585] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF8585]"></span>
                  先週決めたアクションの振り返り
                </div>
                {executionChecks.map((e, idx) => {
                  if (!e) return null;
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

            {/* 達成率サマリー */}
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
                    <span className="text-[#F0F6FC] font-semibold">月末28日以降も含めて自動集計</span>
                  </>
                )}
              </div>
            </div>

            {/* 目標入力 */}
            <div className="space-y-3">
              {member.items.map((it) => {
                const actual = achievements[it.id]?.actual ?? "";
                const valForCalc = viewMode === "week" ? Number(actual) || 0 : monthlyTotals[it.id] || 0;
                const targetVal = Number(it.target) || 0;
                const rate = targetVal > 0 ? Math.min(100, Math.round((valForCalc / targetVal) * 100)) : 0;

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
                      <input
                        value={actual}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[０-９]/g, (s) =>
                            String.fromCharCode(s.charCodeAt(0) - 0xfee0)
                          );
                          const clean = raw.replace(/[^0-9.]/g, "");
                          setAchievements({
                            ...achievements,
                            [it.id]: { actual: clean }
                          });
                        }}
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
                  </div>
                );
              })}
            </div>

            {/* 振り返り・アクション */}
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
                          value={a?.when || ""}
                          onChange={(e) => {
                            const next = [...nextActions];
                            next[idx] = { ...next[idx], when: e.target.value };
                            setNextActions(next);
                          }}
                          placeholder="いつ（例: 火曜10時）"
                          className="bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] placeholder-[#6E7681] focus:outline-none focus:border-[#F2B04B]"
                        />
                        <input
                          value={a?.who || ""}
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
                        value={a?.what || ""}
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

            {/* 保存ボタン */}
            <button
              onClick={save}
              disabled={loadingRecord}
              className={`w-full text-[#0D1117] font-bold text-sm rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all shadow-md mt-2 ${
                loadingRecord
                  ? "bg-[#F2B04B]/60 cursor-not-allowed"
                  : "bg-[#F2B04B] hover:bg-[#E8A33D] active:scale-[0.98]"
              }`}
            >
              {saved ? (
                "保存を完了しました！"
              ) : loadingRecord ? (
                "保存中..."
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
    </ErrorBoundary>
  );
}

// ================= 2. HISTORY TAB (履歴・グラフ) =================
export function HistoryTab({
  members = [],
  selectedMemberId,
  setSelectedMemberId,
  GAS_API_URL
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyViewMode, setHistoryViewMode] = useState("week");

  const member = Array.isArray(members) ? members.find((m) => m.id === selectedMemberId) : null;

  useEffect(() => {
    if (!member || !GAS_API_URL) return;
    let ignore = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const data = await res.json();
        if (!ignore) {
          setRecords(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!ignore) console.error("履歴データの取得に失敗しました:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [member?.id, GAS_API_URL]);

  if (!members || !members.length) {
    return (
      <div className="pt-20 text-center text-xs text-[#8B949E]">
        先に「メンバー設定」タブでメンバーを登録してください
      </div>
    );
  }

  const weeklyChartData = (records || []).map((r) => ({
    label: r?.week || "",
    rate: Number(r?.achievementRate) || 0
  }));

  const monthlyRatesMap = {};

  (records || []).forEach((r) => {
    if (!r || !r.week || r.achievementRate === undefined || r.achievementRate === null) return;

    const adjustedMonth = getAdjustedMonth(r.week);
    const monthKey = adjustedMonth ? `${adjustedMonth}月` : r.week;

    if (!monthlyRatesMap[monthKey]) {
      monthlyRatesMap[monthKey] = {
        sum: 0,
        count: 0,
        sortKey: adjustedMonth || 99
      };
    }
    monthlyRatesMap[monthKey].sum += Number(r.achievementRate) || 0;
    monthlyRatesMap[monthKey].count += 1;
  });

  const monthlyChartData = Object.keys(monthlyRatesMap)
    .sort((a, b) => monthlyRatesMap[a].sortKey - monthlyRatesMap[b].sortKey)
    .map((key) => {
      const data = monthlyRatesMap[key];
      const avg = data.count > 0 ? Math.round(data.sum / data.count) : 0;
      return {
        label: key,
        rate: avg
      };
    });

  const chartData = historyViewMode === "week" ? weeklyChartData : monthlyChartData;

  return (
    <ErrorBoundary>
      <div className="pt-5 space-y-5">
        {/* メンバー切り替え */}
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
            {/* 表示切替 */}
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

            {/* グラフ表示 */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4.5 shadow-sm">
              <div className="text-xs font-bold text-[#C9D1D9] mb-3">
                {historyViewMode === "week"
                  ? "週別 達成率推移グラフ（%）"
                  : "月別 達成率推移グラフ（%）"}
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#30363D" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#8B949E", fontSize: 10 }}
                    axisLine={{ stroke: "#30363D" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#8B949E", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine y={70} stroke="#ED4245" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{
                      background: "#161B22",
                      border: "1px solid #30363D",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#F0F6FC"
                    }}
                    labelStyle={{ color: "#F2B04B", fontWeight: "bold" }}
                    formatter={(value) => [`${value}%`, "達成率"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="達成率"
                    stroke="#F2B04B"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#F2B04B" }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="text-[10px] text-[#8B949E] mt-2 flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#ED4245] inline-block"></span>
                達成目標ライン (70%)
              </div>
            </div>

            {/* 過去ログ一覧 */}
            <div className="space-y-3">
              {[...records].reverse().map((rec, idx) => {
                if (!rec) return null;
                return (
                  <div
                    key={idx}
                    className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm space-y-2"
                  >
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
                    {Array.isArray(rec.executionChecks) && rec.executionChecks.length > 0 && (
                      <div className="text-xs text-[#C9D1D9] space-y-1">
                        <span className="text-[#8B949E] font-medium">先週の実行結果:</span>
                        {rec.executionChecks.map((e, i) => (
                          <div key={i} className="pl-2 text-[11px] text-[#8B949E]">
                            {e?.done === true ? "✓ 実行" : e?.done === false ? "✕ 未達" : "―"}{" "}
                            {e?.what || "―"}
                            {e?.note ? `（${e.note}）` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(rec.nextActions) && rec.nextActions.length > 0 && (
                      <div className="text-xs text-[#C9D1D9] space-y-1 pt-1">
                        <span className="text-[#8B949E] font-medium">決定アクション:</span>
                        {rec.nextActions.map((a, i) => (
                          <div key={i} className="pl-2 text-[11px] text-[#C9D1D9]">
                            ・{a?.when || "―"} ／ {a?.who || "―"} ／ {a?.what || "―"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

// ================= 3. MEMBERS TAB (メンバー設定) =================
export function MembersTab({ members = [], setMembers, GAS_API_URL }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState([
    { id: "item_1", label: "", target: "", unit: "" }
  ]);
  const [saving, setSaving] = useState(false);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: `item_${Date.now()}`, label: "", target: "", unit: "" }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddMember = async () => {
    if (!name.trim()) {
      alert("メンバー名を入力してください");
      return;
    }

    const validItems = items.filter((it) => it.label.trim() !== "");
    if (validItems.length === 0) {
      alert("少なくとも1つの目標項目を設定してください");
      return;
    }

    const newMember = {
      id: `mem_${Date.now()}`,
      name: name.trim(),
      items: validItems
    };

    setSaving(true);
    try {
      if (GAS_API_URL) {
        await fetch(GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "saveMember",
            payload: newMember
          })
        });
      }
      if (typeof setMembers === "function") {
        setMembers([...members, newMember]);
      }
      setName("");
      setItems([{ id: "item_1", label: "", target: "", unit: "" }]);
      alert("メンバーを追加しました");
    } catch (e) {
      console.error(e);
      alert("メンバーの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="pt-5 space-y-6">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-[#F2B04B] uppercase tracking-wider">
            新規メンバー登録
          </h3>

          <div>
            <label className="text-xs text-[#8B949E] block mb-1">メンバー名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 熊谷 啓"
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[#8B949E] block">目標項目の設定</label>
            {items.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => handleItemChange(idx, "label", e.target.value)}
                  placeholder="項目名（例: 物件動画）"
                  className="flex-2 bg-[#0D1117] border border-[#30363D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                />
                <input
                  type="number"
                  value={item.target}
                  onChange={(e) => handleItemChange(idx, "target", e.target.value)}
                  placeholder="目標数"
                  className="w-16 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                />
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                  placeholder="単位"
                  className="w-14 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#F2B04B]"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-[#6E7681] hover:text-[#FF8585]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-[#F2B04B] hover:underline flex items-center gap-1 font-semibold pt-1"
            >
              <Plus size={14} /> 項目を追加
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={saving}
            className="w-full bg-[#238636] hover:bg-[#2EA043] text-white font-bold text-xs rounded-lg py-2.5 transition-all shadow-sm"
          >
            {saving ? "登録中..." : "メンバーを保存"}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#8B949E]">登録済みメンバー一覧</h3>
          {members.length === 0 ? (
            <div className="text-xs text-[#8B949E] text-center py-6 bg-[#161B22]/50 border border-[#30363D] rounded-xl">
              まだメンバーが登録されていません
            </div>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="bg-[#161B22] border border-[#30363D] rounded-xl p-3.5 space-y-2"
              >
                <div className="text-xs font-bold text-[#F0F6FC]">{m.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {m.items?.map((it) => (
                    <span
                      key={it.id}
                      className="text-[11px] bg-[#0D1117] border border-[#30363D] text-[#8B949E] px-2 py-0.5 rounded-md"
                    >
                      {it.label}: {it.target} {it.unit}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ================= 4. MAIN APP COMPONENT =================
const MOCK_MEMBERS = [
  {
    id: "mem_1",
    name: "熊谷 啓",
    items: [
      { id: "item_1", label: "物件動画投稿数", target: 3, unit: "本" },
      { id: "item_2", label: "LINE問合せ対応数", target: 10, unit: "件" },
      { id: "item_3", label: "契約獲得数", target: 2, unit: "件" }
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("sheet"); // "sheet" | "history" | "members"
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = useState("mem_1");

  const GAS_API_URL = "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";

  const getCurrentWeekLabel = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    return `${month}/${date}週`;
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#F0F6FC] font-sans antialiased pb-12">
      <div className="max-w-md mx-auto px-4">
        {/* ヘッダー */}
        <header className="pt-6 pb-4 border-b border-[#30363D]">
          <h1 className="text-lg font-bold text-[#F2B04B]">1on1 ミーティングシート</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">目標進捗・アクション管理</p>
        </header>

        {/* タブ切替 */}
        <div className="flex border-b border-[#30363D] mt-4">
          <button
            onClick={() => setActiveTab("sheet")}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "sheet"
                ? "border-[#F2B04B] text-[#F2B04B]"
                : "border-transparent text-[#8B949E] hover:text-[#C9D1D9]"
            }`}
          >
            <FileText size={14} />
            1on1シート
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "history"
                ? "border-[#F2B04B] text-[#F2B04B]"
                : "border-transparent text-[#8B949E] hover:text-[#C9D1D9]"
            }`}
          >
            <BarChart2 size={14} />
            履歴・グラフ
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "members"
                ? "border-[#F2B04B] text-[#F2B04B]"
                : "border-transparent text-[#8B949E] hover:text-[#C9D1D9]"
            }`}
          >
            <Users size={14} />
            メンバー設定
          </button>
        </div>

        {/* タブコンテンツ */}
        <main>
          {activeTab === "sheet" && (
            <SheetTab
              members={members}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              GAS_API_URL={GAS_API_URL}
              currentWeekLabel={getCurrentWeekLabel}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              members={members}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              GAS_API_URL={GAS_API_URL}
            />
          )}

          {activeTab === "members" && (
            <MembersTab
              members={members}
              setMembers={setMembers}
              GAS_API_URL={GAS_API_URL}
            />
          )}
        </main>
      </div>
    </div>
  );
}
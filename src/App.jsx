import React, { useState, useEffect } from "react";
import { Calendar, Save, Plus, X } from "lucide-react";
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

// ================= 共通ヘルパー関数 =================
// 週文字列（例: "2026-09-28", "9/28", "9月28日週"）から「月」と「日」を解析し、28日以降は翌月扱いにする
function getAdjustedMonth(weekStr) {
  if (!weekStr) return null;
  const match = weekStr.match(/(\d{1,2})[\/\-月](\d{1,2})/);
  if (!match) {
    const mMatch = weekStr.match(/(\d{1,2})/);
    return mMatch ? parseInt(mMatch[1], 10) : null;
  }
  let m = parseInt(match[1], 10);
  let d = parseInt(match[2], 10);

  // 28日以降の週は翌月扱いにするルール
  if (d >= 28) {
    m = m === 12 ? 1 : m + 1;
  }
  return m;
}

// ================= SHEET TAB =================
export function SheetTab({
  members,
  selectedMemberId,
  setSelectedMemberId,
  GAS_API_URL,
  currentWeekLabel
}) {
  const [week, setWeek] = useState(() =>
    typeof currentWeekLabel === "function" ? currentWeekLabel() : ""
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

  const member = members.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (!member || !GAS_API_URL) return;
    let ignore = false;
    setLoadingRecord(true);

    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const allRecords = await res.json();
        if (ignore) return;

        setRecords(allRecords || []);

        const currentRec = (allRecords || []).find((r) => r.week === week);
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

          if (allRecords && allRecords.length > 0) {
            const prevRec = allRecords[allRecords.length - 1];
            const prevActions = (prevRec?.nextActions || []).filter(
              (a) => a.when || a.who || a.what
            );
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
        if (!ignore) {
          console.error("レコードの取得に失敗しました:", e);
        }
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

  if (!members.length) {
    return (
      <div className="pt-20 text-center text-xs text-[#8B949E]">
        先に「メンバー設定」タブでメンバーと目標項目を登録してください
      </div>
    );
  }

  const targetMonth = getAdjustedMonth(week);

  // 同月の過去レコード（選択中の週を除く）
  const pastMonthRecords = (records || []).filter((r) => {
    const isTargetMember =
      (r.memberId && r.memberId === member?.id) || (r.name && r.name === member?.name);
    if (!isTargetMember || !r.week || r.week === week) return false;

    return getAdjustedMonth(r.week) === targetMonth;
  });

  const currentItems = member?.items || [];

  // 各目標項目の月間累計実績値
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

  // 平均達成率（週 / 月累計）
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

      {/* モード切り替え */}
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

      {/* 目標未設定 */}
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

          {/* 平均達成率表示 */}
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

          {/* 各目標項目の入力欄 */}
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

          {/* 振り返りとアクション作成 */}
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
  );
}

// ================= HISTORY TAB =================
export function HistoryTab({
  members,
  selectedMemberId,
  setSelectedMemberId,
  GAS_API_URL
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyViewMode, setHistoryViewMode] = useState("week");

  const member = members.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (!member || !GAS_API_URL) return;
    let ignore = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}?action=getRecords&memberId=${member.id}`);
        const data = await res.json();
        if (!ignore) {
          setRecords(data || []);
        }
      } catch (e) {
        if (!ignore) {
          console.error("履歴データの取得に失敗しました:", e);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [member?.id, GAS_API_URL]);

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

    const adjustedMonth = getAdjustedMonth(r.week);
    const monthKey = adjustedMonth ? `${adjustedMonth}月` : r.week;

    if (!monthlyRatesMap[monthKey]) {
      monthlyRatesMap[monthKey] = {
        sum: 0,
        count: 0,
        sortKey: adjustedMonth || 99
      };
    }
    monthlyRatesMap[monthKey].sum += Number(r.achievementRate);
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
          {/* 表示モード切り替え */}
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
            {[...records].reverse().map((rec, idx) => (
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
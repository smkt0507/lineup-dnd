import { useMemo } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type { LineupState, Player } from "../models";

/**
 * DnD ID設計
 * - 選手カード（プール/配置済み共通）: player:<playerId>
 * - 打順の行（並べ替え用）: batterRow:<uid>
 * - 打順の「配置先」: batterDrop:<uid>
 * - ベンチの「配置先」: benchDrop
 * - ベンチの並べ替えアイテム: benchItem:<playerId>
 * - 投手配置先: spDrop:<slot> / rpDrop:<slot> / clDrop
 * - ゴミ箱（外す）: trash
 */

/**
 * 打順側の守備位置
 * - 投手の打順起用は「大谷翔平のみ」許可だが、守備位置は基本DH想定なので P は出さない
 */
export const BATTER_POS = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

export function useLineupLogic(players: Player[]) {
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  /**
   * 「大谷翔平」判定
   * - データ上で「大谷 翔平」などスペースが入っても一致させる
   */
  const isOhtani = (p: Player) =>
    p.type === "P" && p.name.replace(/\s+/g, "") === "大谷翔平";

  /**
   * 指定プレイヤーを全ての配置箇所から削除する
   */
  function removePlayerEverywhere(
    prev: LineupState,
    playerId: string,
  ): LineupState {
    const batters = prev.batters.map((b) =>
      b.playerId === playerId ? { ...b, playerId: null } : b,
    );
    const bench = prev.bench.filter((id) => id !== playerId);
    const sp = prev.pitchers.sp.map((p) =>
      p.playerId === playerId ? { ...p, playerId: null } : p,
    );
    const rp = prev.pitchers.rp.map((p) =>
      p.playerId === playerId ? { ...p, playerId: null } : p,
    );
    const cl =
      prev.pitchers.cl.playerId === playerId
        ? { ...prev.pitchers.cl, playerId: null }
        : prev.pitchers.cl;

    return {
      ...prev,
      batters,
      bench,
      pitchers: { ...prev.pitchers, sp, rp, cl },
    };
  }

  /**
   * 使用済みプレイヤーIDを取得
   */
  function getUsedPlayerIds(state: LineupState): Set<string> {
    const ids = new Set<string>();

    state.batters.forEach((b) => {
      if (b.playerId) ids.add(b.playerId);
    });

    state.bench.forEach((id) => {
      ids.add(id);
    });

    state.pitchers.sp.forEach((p) => {
      if (p.playerId) ids.add(p.playerId);
    });

    state.pitchers.rp.forEach((p) => {
      if (p.playerId) ids.add(p.playerId);
    });

    if (state.pitchers.cl.playerId) {
      ids.add(state.pitchers.cl.playerId);
    }

    return ids;
  }

  /**
   * ドラッグ終了イベントを処理
   */
  function handleDragEnd(
    state: LineupState,
    setState: (updater: (prev: LineupState) => LineupState) => void,
    e: DragEndEvent,
  ) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    // 1) 打順（行）の並べ替え
    if (activeId.startsWith("batterRow:") && overId.startsWith("batterRow:")) {
      const aUid = activeId.replace("batterRow:", "");
      const oUid = overId.replace("batterRow:", "");
      const oldIndex = state.batters.findIndex((b) => b.uid === aUid);
      const newIndex = state.batters.findIndex((b) => b.uid === oUid);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setState((prev) => ({
          ...prev,
          batters: arrayMove(prev.batters, oldIndex, newIndex),
        }));
      }
      return;
    }

    // 2) ベンチ並べ替え
    if (activeId.startsWith("benchItem:") && overId.startsWith("benchItem:")) {
      const aPid = activeId.replace("benchItem:", "");
      const oPid = overId.replace("benchItem:", "");
      const oldIndex = state.bench.findIndex((x) => x === aPid);
      const newIndex = state.bench.findIndex((x) => x === oPid);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setState((prev) => ({
          ...prev,
          bench: arrayMove(prev.bench, oldIndex, newIndex),
        }));
      }
      return;
    }

    // 3) 選手カード（プール/配置済み共通）は player:<id>
    if (!activeId.startsWith("player:")) return;
    const playerId = activeId.replace("player:", "");
    const player = playerMap.get(playerId);
    if (!player) return;

    // 4) ゴミ箱：外す
    if (overId === "trash") {
      setState((prev) => removePlayerEverywhere(prev, playerId));
      return;
    }

    // 5) 打順への配置（野手 + 大谷翔平のみ）
    if (overId.startsWith("batterDrop:")) {
      const canBat = player.type === "B" || isOhtani(player);
      if (!canBat) return;

      const uid = overId.replace("batterDrop:", "");
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          batters: next.batters.map((b) =>
            b.uid === uid ? { ...b, playerId } : b,
          ),
        };
        return next;
      });
      return;
    }

    // 6) ベンチに入れる（ベンチは野手のみ）
    if (overId === "benchDrop") {
      if (player.type !== "B") return;
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = { ...next, bench: [...next.bench, playerId] };
        return next;
      });
      return;
    }

    // 7) 投手枠（投手のみ）
    if (overId.startsWith("spDrop:")) {
      if (player.type !== "P") return;
      const slot = Number(overId.replace("spDrop:", ""));
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: {
            ...next.pitchers,
            sp: next.pitchers.sp.map((p) =>
              p.slot === slot ? { ...p, playerId } : p,
            ),
          },
        };
        return next;
      });
      return;
    }

    if (overId.startsWith("rpDrop:")) {
      if (player.type !== "P") return;
      const slot = Number(overId.replace("rpDrop:", ""));
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: {
            ...next.pitchers,
            rp: next.pitchers.rp.map((p) =>
              p.slot === slot ? { ...p, playerId } : p,
            ),
          },
        };
        return next;
      });
      return;
    }

    if (overId === "clDrop") {
      if (player.type !== "P") return;
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: { ...next.pitchers, cl: { slot: 1, playerId } },
        };
        return next;
      });
      return;
    }
  }

  return {
    playerMap,
    isOhtani,
    removePlayerEverywhere,
    getUsedPlayerIds,
    handleDragEnd,
  };
}

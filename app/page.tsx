"use client";

import { useEffect, useState } from "react";
import { act, BIG_BLIND, estimatedStrength, shouldRevealHand, startGame, type Card, type Game, type Player, type Suit } from "./poker";

type Locale = "zh" | "en";
type Chat = { id: number; name: string; text: string; accent?: boolean };

const rankLabel = (r: number) => ({ 14: "A", 13: "K", 12: "Q", 11: "J", 10: "10" }[r] ?? String(r));
const suitLabel = (s: Suit) => ({ s: "♠", h: "♥", d: "♦", c: "♣" }[s]);
const isRed = (s: Suit) => s === "h" || s === "d";
const money = (n: number) => n.toLocaleString();
const copy = {
  zh: {
    title: "无限牌桌", table: "练习桌", blinds: "盲注", hand: "第 {n} 手牌", settings: "游戏设置",
    language: "语言", chinese: "中文", english: "English", pot: "底池", yourTurn: "轮到你行动", thinking: "正在思考…",
    nextHand: "开始下一手牌", fold: "弃牌", call: "跟注", check: "过牌", raiseTo: "加注至", raiseAmount: "加注额",
    difficulty: "对局难度", adjust: "可随时调整", difficultyAria: "机器人难度 {n} 级", chat: "牌桌聊天", online: "{n} 人在线",
    collapse: "收起聊天", practice: "本局为练习筹码", placeholder: "说点什么…", tipTitle: "读牌提示",
    tip: "留意每个人的下注节奏，慢慢形成你自己的判断。", chips: "筹码", won: "赢得", tableWin: "赢得牌桌",
    quick: ["打得漂亮", "想想看 🤔", "好运！"], bot: ["这张牌有意思。", "别眨眼 👀", "压力给到你了。", "我只是跟着感觉走。"],
  },
  en: {
    title: "Infinite Table", table: "Practice Table", blinds: "Blinds", hand: "Hand {n}", settings: "Game settings",
    language: "Language", chinese: "中文", english: "English", pot: "Pot", yourTurn: "Your turn", thinking: "is thinking…",
    nextHand: "Next hand", fold: "Fold", call: "Call", check: "Check", raiseTo: "Raise to", raiseAmount: "Raise amount",
    difficulty: "Table difficulty", adjust: "Adjust anytime", difficultyAria: "Bot difficulty level {n}", chat: "Table chat", online: "{n} online",
    collapse: "Collapse chat", practice: "Practice chips only", placeholder: "Say something…", tipTitle: "Table read",
    tip: "Watch each player's betting rhythm and build your own read over time.", chips: "chips", won: "wins", tableWin: "wins the table",
    quick: ["Nice hand", "Let me think 🤔", "Good luck!"], bot: ["Interesting card.", "Don't blink 👀", "The pressure is on.", "I'm just going with the flow."],
  },
} as const;

const phaseNames: Record<Locale, Record<Game["phase"], string>> = {
  zh: { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌" },
  en: { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown" },
};
const knownChat: Record<string, string> = {
  "今晚桌子有点硬啊 🙂": "Tough table tonight 🙂", "慢慢来，牌会说话。": "Take it slow. The cards will talk.",
  "这张牌有意思。": "Interesting card.", "别眨眼 👀": "Don't blink 👀", "压力给到你了。": "The pressure is on.", "我只是跟着感觉走。": "I'm just going with the flow.",
};

function botDecision(g: Game, p: Player, difficulty: number) {
  const skill = (difficulty - 1) / 9;
  const noise = 0.34 - skill * 0.27;
  const strength = estimatedStrength(p, g.community) + (Math.random() - 0.5) * noise;
  const toCall = g.currentBet - p.bet;
  const odds = toCall / Math.max(1, g.pot + g.players.reduce((s, x) => s + x.bet, 0) + toCall);
  const pressure = toCall / Math.max(1, p.stack + p.bet);
  const positionalEdge = ((p.id - g.dealer + 6) % 6) / 5;
  const threshold = 0.47 - p.looseness * 0.2 + odds * (0.3 + skill * 0.35) + pressure * (0.18 + skill * 0.2) - positionalEdge * skill * 0.045;
  if (Math.random() > 0.76 + skill * 0.22) {
    return { type: Math.random() < 0.24 && toCall > 0 ? "fold" as const : "call" as const };
  }
  if (toCall > 0 && strength < threshold) return { type: "fold" as const };
  const bluff = Math.random() < p.aggression * (0.05 + skill * 0.09) && toCall < p.stack * 0.15;
  if ((strength > 0.69 - p.aggression * 0.13 - skill * 0.035 || bluff) && p.stack > toCall + g.minRaise && Math.random() < 0.24 + p.aggression * 0.32 + skill * 0.12) {
    const sizing = 0.28 + p.aggression * 0.35 + skill * 0.22;
    const size = g.currentBet + Math.max(g.minRaise, Math.round((g.pot * sizing) / 10) * 10);
    return { type: "raise" as const, amount: size };
  }
  return { type: "call" as const };
}

function CardView({ card, hidden = false, small = false }: { card?: Card; hidden?: boolean; small?: boolean }) {
  if (hidden || !card) return <div className={`card back ${small ? "small" : ""}`}><span>✦</span></div>;
  return <div className={`card ${isRed(card.suit) ? "red" : "black"} ${small ? "small" : ""}`}><b>{rankLabel(card.rank)}</b><span>{suitLabel(card.suit)}</span></div>;
}

const seatClass = ["seat s0", "seat s1", "seat s2", "seat s3", "seat s4", "seat s5"];

export default function Home() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return ready ? <PokerGame /> : <main className="app-shell" aria-busy="true" />;
}

function PokerGame() {
  const [game, setGame] = useState<Game>(() => startGame());
  const [chat, setChat] = useState<Chat[]>([{ id: 1, name: "Mia", text: "今晚桌子有点硬啊 🙂" }, { id: 2, name: "Victor", text: "慢慢来，牌会说话。" }]);
  const [message, setMessage] = useState("");
  const [raiseTo, setRaiseTo] = useState(60);
  const [difficulty, setDifficulty] = useState(7);
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = window.localStorage.getItem("flow-table-language");
    return saved === "en" || saved === "zh" ? saved : "zh";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[locale];
  const displayName = (name: string) => name;
  const displayAction = (action: string) => {
    if (locale === "zh" || !action) return action;
    if (action.startsWith("小盲 ")) return action.replace("小盲 ", "Small blind ");
    if (action.startsWith("大盲 ")) return action.replace("大盲 ", "Big blind ");
    if (action.startsWith("跟注 ")) return action.replace("跟注 ", "Call ");
    if (action.startsWith("加注至 ")) return action.replace("加注至 ", "Raise to ");
    return ({ "弃牌": "Fold", "已弃牌": "Folded", "过牌": "Check", "出局": "Out" } as Record<string, string>)[action] ?? action;
  };
  const displayWinner = (winner: string) => {
    if (locale === "zh" || !winner) return winner;
    return winner.split(" · ").map((result) => {
      if (result.endsWith(" 赢得牌桌")) return `${displayName(result.replace(" 赢得牌桌", ""))} ${t.tableWin}`;
      const [name, amount] = result.split(" 赢得 ");
      return `${displayName(name)} ${t.won} ${amount}`;
    }).join(" · ");
  };
  const human = game.players[5];
  const yourTurn = game.phase !== "showdown" && game.turn === 5 && !human.eliminated && !human.folded && !human.allIn;
  const callAmount = Math.max(0, game.currentBet - human.bet);
  const tablePot = game.pot + game.players.reduce((s, p) => s + p.bet, 0);
  const seatedCount = game.players.filter((player) => !player.eliminated).length;
  const nextHandCount = game.players.filter((player) => !player.eliminated && player.stack >= BIG_BLIND).length;
  const raiseFloor = Math.max(game.currentBet + game.minRaise, 40);
  const raiseCeiling = human.stack + human.bet;
  const displayedRaiseTo = Math.min(Math.max(raiseTo, raiseFloor), Math.max(raiseFloor, raiseCeiling));
  const canRaise = yourTurn && raiseCeiling > game.currentBet;

  useEffect(() => {
    if (game.phase === "showdown" || game.players[game.turn]?.human) return;
    const timer = setTimeout(() => {
      const player = game.players[game.turn];
      const decision = botDecision(game, player, difficulty);
      if (Math.random() < 0.13) {
        const lines = copy[locale].bot;
        setChat((current) => [...current.slice(-6), { id: Date.now(), name: player.name, text: lines[Math.floor(Math.random() * lines.length)] }]);
      }
      setGame((current) => {
        if (current.phase === "showdown" || current.turn !== player.id || current.players[current.turn]?.human) return current;
        return act(current, player.id, decision.type, decision.amount);
      });
    }, 1600 + Math.random() * 1200);
    return () => clearTimeout(timer);
  }, [game, difficulty, locale]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("flow-table-language", locale);
  }, [locale]);

  const send = (text = message) => {
    const clean = text.trim(); if (!clean) return;
    setChat((c) => [...c.slice(-7), { id: Date.now(), name: "你", text: clean, accent: true }]); setMessage("");
  };
  const status = game.phase === "showdown" ? displayWinner(game.winner) : yourTurn ? t.yourTurn : `${displayName(game.players[game.turn]?.name ?? "")} ${t.thinking}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">♠</span><div><strong>{t.title}</strong><small>NO LIMIT HOLD’EM</small></div></div>
        <div className="table-meta"><span className="live-dot" /> {t.table} · {t.blinds} 10 / 20 <i /> {t.hand.replace("{n}", String(game.handNo))}</div>
        <div className="settings-wrap">
          <button className={`icon-button ${menuOpen ? "open" : ""}`} aria-label={t.settings} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>•••</button>
          {menuOpen && <div className="settings-menu" role="dialog" aria-label={t.language}>
            <div className="settings-label"><span>{t.language}</span><b>{locale === "zh" ? "中" : "EN"}</b></div>
            <div className="language-switch" role="group" aria-label={t.language}>
              <button className={locale === "zh" ? "selected" : ""} onClick={() => { setLocale("zh"); setMenuOpen(false); }}>{t.chinese}</button>
              <button className={locale === "en" ? "selected" : ""} onClick={() => { setLocale("en"); setMenuOpen(false); }}>{t.english}</button>
            </div>
          </div>}
        </div>
      </header>

      <section className="game-layout">
        <div className="table-stage">
          <div className="felt">
            <div className="felt-line" />
            <div className="center-board">
              <div className="pot-label">{t.pot} <b>{money(tablePot)}</b></div>
              <div className="community-cards">
                {[0, 1, 2, 3, 4].map((i) => game.community[i] ? <CardView key={i} card={game.community[i]} /> : <div className="card-slot" key={i} />)}
              </div>
              <div className={`turn-status ${yourTurn ? "active" : ""}`}>{status}</div>
            </div>

            {game.players.map((p, i) => (
              <div className={`${seatClass[i]} ${game.turn === i && game.phase !== "showdown" ? "thinking" : ""} ${p.folded ? "folded" : ""} ${p.eliminated ? "eliminated" : ""}`} key={p.id}>
                <div className="hole-cards">{shouldRevealHand(p, game.phase) ? p.hand.map((c, n) => <CardView card={c} small key={n} />) : p.hand.length > 0 ? <><CardView hidden small /><CardView hidden small /></> : null}</div>
                <div className="player-row">
                  <div className="avatar">{p.avatar}</div>
                  <div className="player-copy"><strong>{displayName(p.name)}{p.human && <em>YOU</em>}</strong><span>{money(p.stack)} {t.chips}</span></div>
                  {game.dealer === i && <b className="dealer">D</b>}
                </div>
                {p.action && <div className="action-pill">{displayAction(p.action)}</div>}
                {p.bet > 0 && <div className="chips"><i /><i /><i /><span>{p.bet}</span></div>}
              </div>
            ))}
          </div>

          <div className="controls">
            <div className="phase-chip">{phaseNames[locale][game.phase]}</div>
            {game.phase === "showdown" ? <button disabled={nextHandCount < 2} className="primary wide" onClick={() => setGame((g) => startGame(g))}>{t.nextHand} <span>→</span></button> : <>
              <button disabled={!yourTurn} className="action-button danger" onClick={() => setGame((g) => act(g, 5, "fold"))}>{t.fold} <kbd>F</kbd></button>
              <button disabled={!yourTurn} className="action-button call-button" onClick={() => setGame((g) => act(g, 5, "call"))}>{callAmount ? `${t.call} ${callAmount}` : t.check}<kbd>C</kbd></button>
              <div className="raise-control">
                <button disabled={!canRaise} className="primary" onClick={() => setGame((g) => act(g, 5, "raise", displayedRaiseTo))}>{t.raiseTo} {displayedRaiseTo}</button>
                <div className="stepper"><button disabled={!canRaise} onClick={() => setRaiseTo((n) => Math.max(raiseFloor, n - 20))}>−</button><input disabled={!canRaise} aria-label={t.raiseAmount} type="range" min={Math.min(raiseFloor, raiseCeiling)} max={Math.max(raiseFloor, raiseCeiling)} step="20" value={displayedRaiseTo} onChange={(e) => setRaiseTo(+e.target.value)} /><button disabled={!canRaise} onClick={() => setRaiseTo((n) => Math.min(raiseCeiling, n + 20))}>＋</button></div>
              </div>
            </>}
          </div>
        </div>

        <aside className="chat-panel">
          <div className="difficulty-panel">
            <div className="difficulty-title"><div><strong>{t.difficulty}</strong><span>{t.adjust}</span></div><b>{difficulty}<small>/10</small></b></div>
            <input aria-label={t.difficultyAria.replace("{n}", String(difficulty))} type="range" min="1" max="10" step="1" value={difficulty} onChange={(e) => setDifficulty(+e.target.value)} />
            <div className="difficulty-scale">{Array.from({ length: 10 }, (_, i) => <span className={i < difficulty ? "filled" : ""} key={i}>{i + 1}</span>)}</div>
          </div>
          <div className="chat-head"><div><strong>{t.chat}</strong><span>{t.online.replace("{n}", String(seatedCount))}</span></div><button aria-label={t.collapse}>⌄</button></div>
          <div className="messages"><div className="system-line"><span>{t.practice}</span></div>{chat.map((m) => <div className={`message ${m.accent ? "mine" : ""}`} key={m.id}><b>{displayName(m.name)}</b><p>{locale === "en" ? (knownChat[m.text] ?? m.text) : m.text}</p></div>)}</div>
          <div className="quick-replies">{t.quick.map((x) => <button key={x} onClick={() => send(x)}>{x}</button>)}</div>
          <div className="composer"><button aria-label="Emoji" onClick={() => send("😄")}>☺</button><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.placeholder} /><button className="send" aria-label="Send" onClick={() => send()}>↑</button></div>
          <div className="tip"><span>■</span><p><b>{t.tipTitle}</b>{t.tip}</p></div>
        </aside>
      </section>
    </main>
  );
}

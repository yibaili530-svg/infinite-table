"use client";

import { useEffect, useMemo, useState } from "react";

type Suit = "s" | "h" | "d" | "c";
type Locale = "zh" | "en";
type Card = { rank: number; suit: Suit };
type Phase = "preflop" | "flop" | "turn" | "river" | "showdown";
type Player = {
  id: number; name: string; tag: string; avatar: string; stack: number; bet: number;
  folded: boolean; allIn: boolean; human: boolean; hand: Card[]; action: string;
  aggression: number; looseness: number;
};
type Chat = { id: number; name: string; text: string; accent?: boolean };
type Game = {
  players: Player[]; deck: Card[]; community: Card[]; phase: Phase; pot: number;
  currentBet: number; minRaise: number; turn: number; dealer: number; acted: number[];
  handNo: number; winner: string;
};

const SUITS: Suit[] = ["s", "h", "d", "c"];
const rankLabel = (r: number) => ({ 14: "A", 13: "K", 12: "Q", 11: "J", 10: "10" }[r] ?? String(r));
const suitLabel = (s: Suit) => ({ s: "♠", h: "♥", d: "♦", c: "♣" }[s]);
const isRed = (s: Suit) => s === "h" || s === "d";
const money = (n: number) => n.toLocaleString();
const copy = {
  zh: {
    title: "无限牌桌", table: "练习桌", blinds: "盲注", hand: "第 {n} 手牌", settings: "游戏设置",
    language: "语言", chinese: "中文", english: "English", pot: "底池", yourTurn: "轮到你行动", thinking: "正在思考…",
    nextHand: "开始下一手牌", fold: "弃牌", call: "跟注", check: "过牌", raiseTo: "加注至", raiseAmount: "加注额",
    difficulty: "对局难度", adjust: "可随时调整", difficultyAria: "机器人难度 {n} 级", chat: "牌桌聊天", online: "6 人在线",
    collapse: "收起聊天", practice: "本局为练习筹码", placeholder: "说点什么…", tipTitle: "读牌提示",
    tip: "留意每个人的下注节奏，慢慢形成你自己的判断。", chips: "筹码", won: "赢得",
    quick: ["打得漂亮", "想想看 🤔", "好运！"], bot: ["这张牌有意思。", "别眨眼 👀", "压力给到你了。", "我只是跟着感觉走。"],
  },
  en: {
    title: "Infinite Table", table: "Practice Table", blinds: "Blinds", hand: "Hand {n}", settings: "Game settings",
    language: "Language", chinese: "中文", english: "English", pot: "Pot", yourTurn: "Your turn", thinking: "is thinking…",
    nextHand: "Next hand", fold: "Fold", call: "Call", check: "Check", raiseTo: "Raise to", raiseAmount: "Raise amount",
    difficulty: "Table difficulty", adjust: "Adjust anytime", difficultyAria: "Bot difficulty level {n}", chat: "Table chat", online: "6 online",
    collapse: "Collapse chat", practice: "Practice chips only", placeholder: "Say something…", tipTitle: "Table read",
    tip: "Watch each player's betting rhythm and build your own read over time.", chips: "chips", won: "wins",
    quick: ["Nice hand", "Let me think 🤔", "Good luck!"], bot: ["Interesting card.", "Don't blink 👀", "The pressure is on.", "I'm just going with the flow."],
  },
} as const;

const phaseNames: Record<Locale, Record<Phase, string>> = {
  zh: { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌" },
  en: { preflop: "Pre-flop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown" },
};
const knownChat: Record<string, string> = {
  "今晚桌子有点硬啊 🙂": "Tough table tonight 🙂", "慢慢来，牌会说话。": "Take it slow. The cards will talk.",
  "这张牌有意思。": "Interesting card.", "别眨眼 👀": "Don't blink 👀", "压力给到你了。": "The pressure is on.", "我只是跟着感觉走。": "I'm just going with the flow.",
};

const templates = [
  { name: "Ethan", tag: "紧凶", avatar: "E", aggression: 0.78, looseness: 0.28 },
  { name: "Nova", tag: "数学派", avatar: "N", aggression: 0.58, looseness: 0.42 },
  { name: "Victor", tag: "老练", avatar: "V", aggression: 0.49, looseness: 0.34 },
  { name: "Mia", tag: "捕猎型", avatar: "M", aggression: 0.67, looseness: 0.52 },
  { name: "Archer", tag: "松凶", avatar: "A", aggression: 0.88, looseness: 0.68 },
  { name: "You", tag: "玩家", avatar: "Y", aggression: 0.5, looseness: 0.5 },
];

function shuffledDeck(deterministic = false) {
  const d: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ rank: r, suit: s });
  let seed = 93271;
  const random = deterministic ? () => ((seed = (seed * 48271) % 2147483647) / 2147483647) : Math.random;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function scoreFive(cards: Card[]) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  if (unique[0] === 14) unique.push(1);
  let straight = 0;
  for (let i = 0; i <= unique.length - 5; i++) if (unique[i] - unique[i + 4] === 4) straight = Math.max(straight, unique[i]);
  const pack = (cat: number, vals: number[]) => {
    const padded = [...vals, 0, 0, 0, 0, 0].slice(0, 5);
    return padded.reduce((n, v) => n * 15 + v, cat);
  };
  if (flush && straight) return pack(8, [straight]);
  if (groups[0][1] === 4) return pack(7, [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return pack(6, [groups[0][0], groups[1][0]]);
  if (flush) return pack(5, ranks);
  if (straight) return pack(4, [straight]);
  if (groups[0][1] === 3) return pack(3, [groups[0][0], ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a)]);
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return pack(2, [Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]]);
  if (groups[0][1] === 2) return pack(1, [groups[0][0], ...groups.slice(1).map((g) => g[0]).sort((a, b) => b - a)]);
  return pack(0, ranks);
}

function handScore(cards: Card[]) {
  if (cards.length < 5) return 0;
  let best = 0;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) best = Math.max(best, scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]));
  return best;
}

function preflopStrength([a, b]: Card[]) {
  const hi = Math.max(a.rank, b.rank), lo = Math.min(a.rank, b.rank);
  let s = (hi + lo) / 30;
  if (a.rank === b.rank) s = 0.54 + hi / 30;
  if (a.suit === b.suit) s += 0.07;
  if (hi - lo <= 2) s += 0.06;
  if (hi >= 13) s += 0.07;
  return Math.min(1, s);
}

function estimatedStrength(p: Player, community: Card[]) {
  if (!community.length) return preflopStrength(p.hand);
  const score = handScore([...p.hand, ...community]);
  const scale = Math.pow(15, 5);
  const cat = Math.floor(score / scale);
  const all = [...p.hand, ...community];
  const paired = p.hand.some((c) => all.filter((x) => x.rank === c.rank).length > 1);
  const flushDraw = SUITS.some((s) => all.filter((c) => c.suit === s).length >= 4);
  const base = [0.2, 0.43, 0.58, 0.68, 0.76, 0.82, 0.9, 0.95, 0.99][Math.min(8, cat)] ?? 0.2;
  return Math.min(1, base + (paired ? 0.05 : 0) + (flushDraw ? 0.07 : 0));
}

function startGame(previous?: Game): Game {
  const deck = shuffledDeck(!previous);
  const dealer = previous ? (previous.dealer + 1) % 6 : 2;
  const players = templates.map((t, i) => ({ ...t, id: i, stack: previous?.players[i].stack && previous.players[i].stack > 80 ? previous.players[i].stack : 2000, bet: 0, folded: false, allIn: false, human: i === 5, hand: [deck.pop()!, deck.pop()!], action: "" }));
  const sb = (dealer + 1) % 6, bb = (dealer + 2) % 6;
  players[sb].stack -= 10; players[sb].bet = 10; players[sb].action = "小盲 10";
  players[bb].stack -= 20; players[bb].bet = 20; players[bb].action = "大盲 20";
  return { players, deck, community: [], phase: "preflop", pot: 0, currentBet: 20, minRaise: 20, turn: (bb + 1) % 6, dealer, acted: [], handNo: (previous?.handNo ?? 0) + 1, winner: "" };
}

function nextEligible(g: Game, from: number) {
  for (let n = 1; n <= 6; n++) {
    const i = (from + n) % 6, p = g.players[i];
    if (!p.folded && !p.allIn) return i;
  }
  return from;
}

function settleIfReady(g: Game): Game {
  const alive = g.players.filter((p) => !p.folded);
  if (alive.length === 1) {
    const total = g.pot + g.players.reduce((s, p) => s + p.bet, 0);
    g.players[alive[0].id].stack += total; g.pot = 0; g.winner = `${alive[0].name} 赢得 ${money(total)}`; g.phase = "showdown"; return g;
  }
  const active = alive.filter((p) => !p.allIn);
  const roundDone = active.every((p) => g.acted.includes(p.id) && p.bet === g.currentBet);
  if (!roundDone) return g;
  g.pot += g.players.reduce((s, p) => s + p.bet, 0);
  g.players.forEach((p) => { p.bet = 0; p.action = p.folded ? "已弃牌" : ""; });
  g.currentBet = 0; g.minRaise = 20; g.acted = [];
  if (g.phase === "river" || active.length === 0) {
    while (g.community.length < 5) g.community.push(g.deck.pop()!);
    const ranked = alive.map((p) => ({ p, score: handScore([...p.hand, ...g.community]) })).sort((a, b) => b.score - a.score);
    const winners = ranked.filter((x) => x.score === ranked[0].score);
    const share = Math.floor(g.pot / winners.length); winners.forEach((x) => x.p.stack += share);
    g.winner = `${winners.map((x) => x.p.name).join("、")} 赢得 ${money(g.pot)}`; g.pot = 0; g.phase = "showdown"; return g;
  }
  const count = g.phase === "preflop" ? 3 : 1;
  for (let i = 0; i < count; i++) g.community.push(g.deck.pop()!);
  g.phase = g.phase === "preflop" ? "flop" : g.phase === "flop" ? "turn" : "river";
  g.turn = nextEligible(g, g.dealer);
  return g;
}

function act(game: Game, id: number, type: "fold" | "call" | "raise", raiseAmount = 0) {
  const g: Game = structuredClone(game), p = g.players[id];
  if (type === "fold") { p.folded = true; p.action = "弃牌"; }
  else if (type === "call") {
    const need = Math.min(p.stack, g.currentBet - p.bet);
    p.stack -= need; p.bet += need; p.allIn = p.stack === 0; p.action = need ? `跟注 ${need}` : "过牌";
  } else {
    const target = Math.min(p.bet + p.stack, Math.max(g.currentBet + g.minRaise, raiseAmount));
    const add = target - p.bet; p.stack -= add; p.bet = target; p.allIn = p.stack === 0;
    g.minRaise = Math.max(20, target - g.currentBet); g.currentBet = target; g.acted = []; p.action = `加注至 ${target}`;
  }
  g.acted.push(id); g.turn = nextEligible(g, id);
  return settleIfReady(g);
}

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
  const [game, setGame] = useState<Game>(() => startGame());
  const [chat, setChat] = useState<Chat[]>([{ id: 1, name: "Mia", text: "今晚桌子有点硬啊 🙂" }, { id: 2, name: "Victor", text: "慢慢来，牌会说话。" }]);
  const [message, setMessage] = useState("");
  const [raiseTo, setRaiseTo] = useState(60);
  const [difficulty, setDifficulty] = useState(7);
  const [locale, setLocale] = useState<Locale>("zh");
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[locale];
  const displayName = (name: string) => name;
  const displayAction = (action: string) => {
    if (locale === "zh" || !action) return action;
    if (action.startsWith("小盲 ")) return action.replace("小盲 ", "Small blind ");
    if (action.startsWith("大盲 ")) return action.replace("大盲 ", "Big blind ");
    if (action.startsWith("跟注 ")) return action.replace("跟注 ", "Call ");
    if (action.startsWith("加注至 ")) return action.replace("加注至 ", "Raise to ");
    return ({ "弃牌": "Fold", "已弃牌": "Folded", "过牌": "Check" } as Record<string, string>)[action] ?? action;
  };
  const displayWinner = (winner: string) => {
    if (locale === "zh" || !winner) return winner;
    const [names, amount] = winner.split(" 赢得 ");
    return `${names.split("、").map(displayName).join(" & ")} ${t.won} ${amount}`;
  };
  const human = game.players[5];
  const yourTurn = game.phase !== "showdown" && game.turn === 5 && !human.folded && !human.allIn;
  const callAmount = Math.max(0, game.currentBet - human.bet);
  const tablePot = game.pot + game.players.reduce((s, p) => s + p.bet, 0);

  useEffect(() => {
    if (game.phase === "showdown" || game.players[game.turn]?.human) return;
    const timer = setTimeout(() => {
      setGame((current) => {
        if (current.phase === "showdown" || current.players[current.turn]?.human) return current;
        const p = current.players[current.turn], d = botDecision(current, p, difficulty);
        if (Math.random() < 0.13) {
          const lines = t.bot;
          setChat((c) => [...c.slice(-6), { id: Date.now(), name: p.name, text: lines[Math.floor(Math.random() * lines.length)] }]);
        }
        return act(current, p.id, d.type, d.amount);
      });
    }, 1600 + Math.random() * 1200);
    return () => clearTimeout(timer);
  }, [game, difficulty, locale]);

  useEffect(() => {
    const saved = window.localStorage.getItem("flow-table-language");
    if (saved === "en" || saved === "zh") setLocale(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("flow-table-language", locale);
  }, [locale]);

  useEffect(() => setRaiseTo(Math.max(game.currentBet + game.minRaise, 40)), [game.currentBet, game.minRaise]);

  const send = (text = message) => {
    const clean = text.trim(); if (!clean) return;
    setChat((c) => [...c.slice(-7), { id: Date.now(), name: "你", text: clean, accent: true }]); setMessage("");
  };
  const status = useMemo(() => game.phase === "showdown" ? displayWinner(game.winner) : yourTurn ? t.yourTurn : `${displayName(game.players[game.turn]?.name ?? "")} ${t.thinking}`, [game, yourTurn, locale]);

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
              <div className={`${seatClass[i]} ${game.turn === i && game.phase !== "showdown" ? "thinking" : ""} ${p.folded ? "folded" : ""}`} key={p.id}>
                <div className="hole-cards">{p.human || game.phase === "showdown" ? p.hand.map((c, n) => <CardView card={c} small key={n} />) : <><CardView hidden small /><CardView hidden small /></>}</div>
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
            {game.phase === "showdown" ? <button className="primary wide" onClick={() => setGame((g) => startGame(g))}>{t.nextHand} <span>→</span></button> : <>
              <button disabled={!yourTurn} className="action-button danger" onClick={() => setGame((g) => act(g, 5, "fold"))}>{t.fold} <kbd>F</kbd></button>
              <button disabled={!yourTurn} className="action-button call-button" onClick={() => setGame((g) => act(g, 5, "call"))}>{callAmount ? `${t.call} ${callAmount}` : t.check}<kbd>C</kbd></button>
              <div className="raise-control">
                <button disabled={!yourTurn} className="primary" onClick={() => setGame((g) => act(g, 5, "raise", raiseTo))}>{t.raiseTo} {raiseTo}</button>
                <div className="stepper"><button onClick={() => setRaiseTo((n) => Math.max(game.currentBet + game.minRaise, n - 20))}>−</button><input aria-label={t.raiseAmount} type="range" min={Math.max(game.currentBet + game.minRaise, 40)} max={Math.max(80, human.stack + human.bet)} step="20" value={Math.min(raiseTo, human.stack + human.bet)} onChange={(e) => setRaiseTo(+e.target.value)} /><button onClick={() => setRaiseTo((n) => Math.min(human.stack + human.bet, n + 20))}>＋</button></div>
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
          <div className="chat-head"><div><strong>{t.chat}</strong><span>{t.online}</span></div><button aria-label={t.collapse}>⌄</button></div>
          <div className="messages"><div className="system-line"><span>{t.practice}</span></div>{chat.map((m) => <div className={`message ${m.accent ? "mine" : ""}`} key={m.id}><b>{displayName(m.name)}</b><p>{locale === "en" ? (knownChat[m.text] ?? m.text) : m.text}</p></div>)}</div>
          <div className="quick-replies">{t.quick.map((x) => <button key={x} onClick={() => send(x)}>{x}</button>)}</div>
          <div className="composer"><button aria-label="Emoji" onClick={() => send("😄")}>☺</button><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t.placeholder} /><button className="send" aria-label="Send" onClick={() => send()}>↑</button></div>
          <div className="tip"><span>■</span><p><b>{t.tipTitle}</b>{t.tip}</p></div>
        </aside>
      </section>
    </main>
  );
}

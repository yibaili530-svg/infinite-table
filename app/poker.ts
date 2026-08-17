export type Suit = "s" | "h" | "d" | "c";
export type Card = { rank: number; suit: Suit };
export type Phase = "preflop" | "flop" | "turn" | "river" | "showdown";
export type Player = {
  id: number;
  name: string;
  tag: string;
  avatar: string;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
  human: boolean;
  hand: Card[];
  action: string;
  aggression: number;
  looseness: number;
};
export type Game = {
  players: Player[];
  deck: Card[];
  community: Card[];
  phase: Phase;
  pot: number;
  contributions: number[];
  currentBet: number;
  minRaise: number;
  turn: number;
  dealer: number;
  acted: number[];
  handNo: number;
  winner: string;
};

export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
const SUITS: Suit[] = ["s", "h", "d", "c"];

const templates = [
  { name: "Ethan", tag: "紧凶", avatar: "E", aggression: 0.78, looseness: 0.28 },
  { name: "Nova", tag: "数学派", avatar: "N", aggression: 0.58, looseness: 0.42 },
  { name: "Victor", tag: "老练", avatar: "V", aggression: 0.49, looseness: 0.34 },
  { name: "Mia", tag: "捕猎型", avatar: "M", aggression: 0.67, looseness: 0.52 },
  { name: "Archer", tag: "松凶", avatar: "A", aggression: 0.88, looseness: 0.68 },
  { name: "You", tag: "玩家", avatar: "Y", aggression: 0.5, looseness: 0.5 },
];

const money = (n: number) => n.toLocaleString();

export function shuffledDeck(random: () => number = Math.random) {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function scoreFive(cards: Card[]) {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  if (unique[0] === 14) unique.push(1);
  let straight = 0;
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) straight = Math.max(straight, unique[i]);
  }
  const pack = (category: number, values: number[]) => {
    const padded = [...values, 0, 0, 0, 0, 0].slice(0, 5);
    return padded.reduce((score, value) => score * 15 + value, category);
  };
  if (flush && straight) return pack(8, [straight]);
  if (groups[0][1] === 4) return pack(7, [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return pack(6, [groups[0][0], groups[1][0]]);
  if (flush) return pack(5, ranks);
  if (straight) return pack(4, [straight]);
  if (groups[0][1] === 3) return pack(3, [groups[0][0], ...groups.slice(1).map((group) => group[0]).sort((a, b) => b - a)]);
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return pack(2, [Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]]);
  if (groups[0][1] === 2) return pack(1, [groups[0][0], ...groups.slice(1).map((group) => group[0]).sort((a, b) => b - a)]);
  return pack(0, ranks);
}

export function handScore(cards: Card[]) {
  if (cards.length < 5) return 0;
  let best = 0;
  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            best = Math.max(best, scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]));
          }
        }
      }
    }
  }
  return best;
}

export function preflopStrength([a, b]: Card[]) {
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  let strength = (hi + lo) / 30;
  if (a.rank === b.rank) strength = 0.54 + hi / 30;
  if (a.suit === b.suit) strength += 0.07;
  if (hi - lo <= 2) strength += 0.06;
  if (hi >= 13) strength += 0.07;
  return Math.min(1, strength);
}

export function estimatedStrength(player: Player, community: Card[]) {
  if (!community.length) return preflopStrength(player.hand);
  const score = handScore([...player.hand, ...community]);
  const category = Math.floor(score / Math.pow(15, 5));
  const all = [...player.hand, ...community];
  const paired = player.hand.some((card) => all.filter((candidate) => candidate.rank === card.rank).length > 1);
  const flushDraw = SUITS.some((suit) => all.filter((card) => card.suit === suit).length >= 4);
  const base = [0.2, 0.43, 0.58, 0.68, 0.76, 0.82, 0.9, 0.95, 0.99][Math.min(8, category)] ?? 0.2;
  return Math.min(1, base + (paired ? 0.05 : 0) + (flushDraw ? 0.07 : 0));
}

export function shouldRevealHand(player: Player, phase: Phase) {
  return player.hand.length > 0 && (player.human || (phase === "showdown" && !player.folded));
}

function nextSeat(players: Player[], from: number, predicate: (player: Player) => boolean) {
  for (let offset = 1; offset <= players.length; offset++) {
    const id = (from + offset) % players.length;
    if (predicate(players[id])) return id;
  }
  return from;
}

function nextEligible(game: Game, from: number) {
  return nextSeat(game.players, from, (player) => !player.eliminated && !player.folded && !player.allIn);
}

function commitChips(game: Game, player: Player, amount: number) {
  const committed = Math.max(0, Math.min(player.stack, amount));
  player.stack -= committed;
  player.bet += committed;
  game.contributions[player.id] += committed;
  player.allIn = player.stack === 0;
  return committed;
}

export function startGame(previous?: Game, random: () => number = Math.random): Game {
  const deck = shuffledDeck(random);
  const players: Player[] = templates.map((template, id) => {
    const stack = previous ? previous.players[id].stack : 2000;
    const eliminated = previous ? previous.players[id].eliminated || stack < BIG_BLIND : false;
    return {
      ...template,
      id,
      stack,
      bet: 0,
      folded: eliminated,
      allIn: false,
      eliminated,
      human: id === 5,
      hand: [],
      action: eliminated ? "出局" : "",
    };
  });
  const seated = players.filter((player) => !player.eliminated);
  const dealer = previous
    ? nextSeat(players, previous.dealer, (player) => !player.eliminated)
    : seated[Math.min(2, seated.length - 1)]?.id ?? 0;
  const base: Game = {
    players,
    deck,
    community: [],
    phase: seated.length >= 2 ? "preflop" : "showdown",
    pot: 0,
    contributions: players.map(() => 0),
    currentBet: 0,
    minRaise: BIG_BLIND,
    turn: dealer,
    dealer,
    acted: [],
    handNo: (previous?.handNo ?? 0) + 1,
    winner: seated.length === 1 ? `${seated[0].name} 赢得牌桌` : "",
  };
  if (seated.length < 2) return base;

  for (let round = 0; round < 2; round++) {
    seated.forEach((player) => player.hand.push(deck.pop()!));
  }
  const smallBlindId = nextSeat(players, dealer, (player) => !player.eliminated);
  const bigBlindId = nextSeat(players, smallBlindId, (player) => !player.eliminated);
  const smallBlind = commitChips(base, players[smallBlindId], SMALL_BLIND);
  const bigBlind = commitChips(base, players[bigBlindId], BIG_BLIND);
  players[smallBlindId].action = `小盲 ${smallBlind}`;
  players[bigBlindId].action = `大盲 ${bigBlind}`;
  base.currentBet = Math.max(smallBlind, bigBlind);
  base.turn = nextEligible(base, bigBlindId);
  return base;
}

export function distributePots(game: Game) {
  const levels = [...new Set(game.contributions.filter((amount) => amount > 0))].sort((a, b) => a - b);
  const payouts = new Map<number, number>();
  let previousLevel = 0;

  levels.forEach((level) => {
    const contributors = game.players.filter((player) => game.contributions[player.id] >= level);
    const amount = (level - previousLevel) * contributors.length;
    previousLevel = level;
    const eligible = contributors.filter((player) => !player.folded && !player.eliminated);
    if (!eligible.length || amount <= 0) return;
    const ranked = eligible
      .map((player) => ({ player, score: handScore([...player.hand, ...game.community]) }))
      .sort((a, b) => b.score - a.score);
    const winners = ranked
      .filter((entry) => entry.score === ranked[0].score)
      .map((entry) => entry.player)
      .sort((a, b) => ((a.id - game.dealer + game.players.length) % game.players.length) - ((b.id - game.dealer + game.players.length) % game.players.length));
    const share = Math.floor(amount / winners.length);
    const remainder = amount % winners.length;
    winners.forEach((winner, index) => {
      const payout = share + (index < remainder ? 1 : 0);
      winner.stack += payout;
      payouts.set(winner.id, (payouts.get(winner.id) ?? 0) + payout);
    });
  });

  game.winner = [...payouts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => `${game.players[id].name} 赢得 ${money(amount)}`)
    .join(" · ");
  game.pot = 0;
  game.phase = "showdown";
  return game;
}

function settleIfReady(game: Game): Game {
  const alive = game.players.filter((player) => !player.eliminated && !player.folded);
  if (alive.length === 1) {
    const total = game.pot + game.players.reduce((sum, player) => sum + player.bet, 0);
    alive[0].stack += total;
    game.pot = 0;
    game.winner = `${alive[0].name} 赢得 ${money(total)}`;
    game.phase = "showdown";
    return game;
  }
  const active = alive.filter((player) => !player.allIn);
  const roundDone = active.every((player) => game.acted.includes(player.id) && player.bet === game.currentBet);
  if (!roundDone) return game;

  game.pot += game.players.reduce((sum, player) => sum + player.bet, 0);
  game.players.forEach((player) => {
    player.bet = 0;
    player.action = player.eliminated ? "出局" : player.folded ? "已弃牌" : "";
  });
  game.currentBet = 0;
  game.minRaise = BIG_BLIND;
  game.acted = [];

  if (game.phase === "river" || active.length <= 1) {
    while (game.community.length < 5) game.community.push(game.deck.pop()!);
    return distributePots(game);
  }
  const count = game.phase === "preflop" ? 3 : 1;
  for (let i = 0; i < count; i++) game.community.push(game.deck.pop()!);
  game.phase = game.phase === "preflop" ? "flop" : game.phase === "flop" ? "turn" : "river";
  game.turn = nextEligible(game, game.dealer);
  return game;
}

export function act(game: Game, id: number, type: "fold" | "call" | "raise", raiseAmount = 0) {
  const next: Game = structuredClone(game);
  const player = next.players[id];
  if (player.eliminated || player.folded || player.allIn) return next;

  if (type === "fold") {
    player.folded = true;
    player.action = "弃牌";
  } else if (type === "call") {
    const need = Math.max(0, next.currentBet - player.bet);
    const committed = commitChips(next, player, need);
    player.action = committed ? `跟注 ${committed}` : "过牌";
  } else {
    const previousBet = next.currentBet;
    const availableTarget = player.bet + player.stack;
    if (availableTarget <= previousBet) {
      const committed = commitChips(next, player, Math.max(0, previousBet - player.bet));
      player.action = committed ? `跟注 ${committed}` : "过牌";
    } else {
      const minimumTarget = previousBet + next.minRaise;
      const target = Math.min(availableTarget, Math.max(minimumTarget, raiseAmount));
      const committed = commitChips(next, player, target - player.bet);
      const raiseSize = target - previousBet;
      if (raiseSize >= next.minRaise) {
        next.minRaise = raiseSize;
        next.acted = [];
      }
      next.currentBet = Math.max(previousBet, target);
      player.action = `加注至 ${player.bet}`;
      if (!committed) player.action = "过牌";
    }
  }
  if (!next.acted.includes(id)) next.acted.push(id);
  next.turn = nextEligible(next, id);
  return settleIfReady(next);
}

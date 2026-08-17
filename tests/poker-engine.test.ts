import assert from "node:assert/strict";
import test from "node:test";
import { act, distributePots, shouldRevealHand, startGame, type Card, type Game, type Player } from "../app/poker.ts";

const card = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

function player(id: number, hand: Card[]): Player {
  return {
    id,
    name: ["Ethan", "Nova", "Victor"][id] ?? `P${id}`,
    tag: "",
    avatar: String(id),
    stack: 0,
    bet: 0,
    folded: false,
    allIn: true,
    eliminated: false,
    human: false,
    hand,
    action: "",
    aggression: 0.5,
    looseness: 0.5,
  };
}

test("the first hand uses the supplied random source", () => {
  const low = startGame(undefined, () => 0.01);
  const high = startGame(undefined, () => 0.99);
  assert.notDeepEqual(low.players.map((p) => p.hand), high.players.map((p) => p.hand));
});

test("players below one big blind are eliminated from the next hand", () => {
  const previous = startGame(undefined, () => 0.25);
  previous.players[0].stack = 19;
  const next = startGame(previous, () => 0.75);
  assert.equal(next.players[0].eliminated, true);
  assert.equal(next.players[0].hand.length, 0);
  assert.equal(next.players[0].action, "出局");
  assert.notEqual(next.dealer, 0);
  assert.notEqual(next.turn, 0);
});

test("main pot and side pots pay only eligible players", () => {
  const players = [
    player(0, [card(14, "s"), card(14, "d")]),
    player(1, [card(12, "s"), card(12, "h")]),
    player(2, [card(8, "s"), card(7, "s")]),
  ];
  const game: Game = {
    players,
    deck: [],
    community: [card(2, "c"), card(3, "d"), card(4, "h"), card(9, "s"), card(13, "c")],
    phase: "river",
    pot: 600,
    contributions: [100, 200, 300],
    currentBet: 0,
    minRaise: 20,
    turn: 0,
    dealer: 2,
    acted: [],
    handNo: 1,
    winner: "",
  };
  distributePots(game);
  assert.deepEqual(players.map((p) => p.stack), [300, 200, 100]);
  assert.equal(players.reduce((sum, p) => sum + p.stack, 0), 600);
});

test("a short all-in never lowers the current bet", () => {
  const game = startGame(undefined, () => 0.5);
  game.currentBet = 100;
  game.players[0].bet = 0;
  game.players[0].stack = 50;
  game.contributions[0] = 0;
  const next = act(game, 0, "raise", 200);
  assert.equal(next.currentBet, 100);
  assert.equal(next.players[0].stack, 0);
  assert.equal(next.players[0].bet, 50);
  assert.equal(next.contributions[0], 50);
});

test("folded opponents never reveal their hole cards at showdown", () => {
  const opponent = player(1, [card(14, "s"), card(13, "s")]);
  opponent.folded = true;
  assert.equal(shouldRevealHand(opponent, "showdown"), false);

  opponent.folded = false;
  assert.equal(shouldRevealHand(opponent, "showdown"), true);

  opponent.human = true;
  opponent.folded = true;
  assert.equal(shouldRevealHand(opponent, "showdown"), true);
});

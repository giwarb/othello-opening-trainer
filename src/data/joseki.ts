export type Joseki = {
  id: string;
  name: string;
  color: "black" | "white"; // user plays this color
  moves: string[]; // full sequence: moves[ply] alternates black/white
};

export const JOSEKI_LIST: Joseki[] = [
  // ── 白番 (user plays white) ──────────────────────────────────────────────
  {
    id: "tori",
    name: "酉定石",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b3", "c2", "e3"],
  },
  {
    id: "neko",
    name: "猫",
    color: "white",
    moves: ["f5", "d6", "c4", "d3"],
  },
  {
    id: "usagi",
    name: "兎",
    color: "white",
    moves: ["f5", "d6", "c5", "f4"],
  },
  {
    id: "zarigani",
    name: "ザリガニ",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c5", "f4"],
  },
  {
    id: "ebi",
    name: "海老",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c6", "f4"],
  },
  {
    id: "nokan",
    name: "ノーカン",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "f6", "g5"],
  },
  {
    id: "brightwell",
    name: "ブライトウェル",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "e3", "f6"],
  },
  {
    id: "leaders_tiger",
    name: "Leader's Tiger",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "e6", "b3"],
  },
  {
    id: "akkun",
    name: "あっくん",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b3", "e2", "c6"],
  },
  {
    id: "no_roseville",
    name: "Noローズビル",
    color: "white",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b3", "d2", "c6"],
  },
  // ── 黒番 (user plays black) ──────────────────────────────────────────────
  {
    id: "roseville",
    name: "ローズビル",
    color: "black",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b3", "c2"],
  },
  {
    id: "ushi",
    name: "牛",
    color: "black",
    moves: ["f5", "f6", "e6"],
  },
  {
    id: "nezumi",
    name: "鼠",
    color: "black",
    moves: ["f5", "f4", "e3"],
  },
  {
    id: "ryu",
    name: "龍",
    color: "black",
    moves: ["f5", "d6", "c3", "f4", "f6"],
  },
  {
    id: "missile",
    name: "ミサイル",
    color: "black",
    moves: ["f5", "d6", "c3", "g5", "c6"],
  },
  {
    id: "torake",
    name: "虎系犬素",
    color: "black",
    moves: ["f5", "d6", "c3", "f3", "d3"],
  },
  {
    id: "yes_ryu",
    name: "イエス流",
    color: "black",
    moves: ["f5", "d6", "c3", "d3", "c4", "b3", "c6"],
  },
  {
    id: "berg_tiger",
    name: "Berg Tiger",
    color: "black",
    moves: ["f5", "d6", "c3", "d3", "c4", "b5", "c5"],
  },
  {
    id: "banana",
    name: "バナナ",
    color: "black",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b4", "b5"],
  },
  {
    id: "mako_tora",
    name: "まこ虎",
    color: "black",
    moves: ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b5", "c6"],
  },
];

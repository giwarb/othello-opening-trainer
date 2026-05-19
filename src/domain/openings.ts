import openingBook from "../data/othello_openings.json";

export type OpeningRecord = {
  id: string;
  primary_name: string;
  aliases: string[];
  japanese_names: string[];
  sequence: string;
  moves: string[];
  move_count: number;
  family: "diagonal" | "perpendicular" | "parallel" | "unknown";
  tags: string[];
  sources: string[];
  source_notes: string[];
  parent_id: string | null;
};

export type OpeningBook = {
  schema: string;
  openings: OpeningRecord[];
};

export const openings = (openingBook as OpeningBook).openings
  .filter((opening) => opening.moves.length >= 2)
  .map((opening) => ({
    ...opening,
    moves: opening.moves.map((move) => move.toLowerCase()),
  }));

export type OpeningNode = {
  move?: string;
  ply: number;
  children: Map<string, OpeningNode>;
  terminalOpenings: OpeningRecord[];
  reachableOpenings: OpeningRecord[];
};

export function createOpeningTree(
  records: OpeningRecord[] = openings,
): OpeningNode {
  const root: OpeningNode = {
    ply: 0,
    children: new Map(),
    terminalOpenings: [],
    reachableOpenings: [...records],
  };

  for (const record of records) {
    let node = root;
    record.moves.forEach((move, index) => {
      if (!node.children.has(move)) {
        node.children.set(move, {
          move,
          ply: index + 1,
          children: new Map(),
          terminalOpenings: [],
          reachableOpenings: [],
        });
      }
      const child = node.children.get(move);
      if (!child) {
        throw new Error(`Failed to insert opening move: ${move}`);
      }
      node = child;
      node.reachableOpenings.push(record);
    });
    node.terminalOpenings.push(record);
  }

  return root;
}

export function findNode(
  root: OpeningNode,
  moves: string[],
): OpeningNode | null {
  let node: OpeningNode | undefined = root;
  for (const move of moves) {
    node = node.children.get(move.toLowerCase());
    if (!node) {
      return null;
    }
  }
  return node;
}

export function displayName(opening: OpeningRecord): string {
  const names = [
    opening.primary_name,
    ...opening.japanese_names.filter((name) => name !== opening.primary_name),
    ...opening.aliases,
  ];
  return names.slice(0, 2).join(" / ");
}

const japaneseNameMap: Record<string, string> = {
  "Diagonal Opening": "斜め取り",
  "Perpendicular Opening": "縦取り",
  "Parallel Opening": "並び取り",
  Tiger: "虎",
  Cat: "猫",
  "No-Cat": "ノーカン",
  NoCat: "ノーカン",
  Cow: "牛",
  Buffalo: "バッファロー",
  Horse: "馬",
  Italian: "イタリアン",
  Ganglion: "ギャングリオン",
  Swallow: "燕",
  Heath: "飛び出し",
  Snake: "蛇",
  "Raccoon Dog": "狸",
  "X-square Opening": "X打ち",
  "Wing Variation": "ウィング",
  "Semi-Wing Variation": "セミウィング",
};

export function japaneseName(opening: OpeningRecord): string {
  const explicit = opening.japanese_names.find((name) =>
    [...name].some((char) => char.charCodeAt(0) > 127),
  );
  if (explicit) {
    return explicit;
  }
  return japaneseNameMap[opening.primary_name] ?? opening.primary_name;
}

export function josekiLabel(opening: OpeningRecord): string {
  const name = japaneseName(opening);
  return name.endsWith("定石") ? name : `${name}定石`;
}

export function openingSearchText(opening: OpeningRecord): string {
  return [
    opening.primary_name,
    japaneseName(opening),
    ...opening.aliases,
    ...opening.japanese_names,
    opening.sequence,
    opening.family,
  ]
    .join(" ")
    .toLowerCase();
}

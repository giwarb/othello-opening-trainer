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

export function openingSearchText(opening: OpeningRecord): string {
  return [
    opening.primary_name,
    ...opening.aliases,
    ...opening.japanese_names,
    opening.sequence,
    opening.family,
  ]
    .join(" ")
    .toLowerCase();
}

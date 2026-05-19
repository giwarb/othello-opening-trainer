export type Color = "black" | "white";
export type Cell = Color | null;
export type Board = Cell[][];
export type Coord = `${string}${number}`;

const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function opponent(color: Color): Color {
  return color === "black" ? "white" : "black";
}

export function initialBoard(): Board {
  const board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(null));
  board[3][3] = "white";
  board[3][4] = "black";
  board[4][3] = "black";
  board[4][4] = "white";
  return board;
}

export function coordToPoint(coord: string): { row: number; col: number } {
  const file = coord[0]?.toLowerCase();
  const rank = Number(coord.slice(1));
  const col = files.indexOf(file as (typeof files)[number]);
  if (col < 0 || !Number.isInteger(rank) || rank < 1 || rank > 8) {
    throw new Error(`Invalid Othello coordinate: ${coord}`);
  }
  return { row: rank - 1, col };
}

export function pointToCoord(row: number, col: number): string {
  return `${files[col]}${row + 1}`;
}

export function colorForPly(ply: number): Color {
  return ply % 2 === 0 ? "black" : "white";
}

export function getFlips(board: Board, coord: string, color: Color): string[] {
  const { row, col } = coordToPoint(coord);
  if (board[row][col]) {
    return [];
  }

  const flips: string[] = [];
  for (const [dr, dc] of directions) {
    const line: string[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const cell = board[r][c];
      if (!cell) {
        line.length = 0;
        break;
      }
      if (cell === color) {
        break;
      }
      line.push(pointToCoord(r, c));
      r += dr;
      c += dc;
    }
    if (r < 0 || r >= 8 || c < 0 || c >= 8 || board[r][c] !== color) {
      continue;
    }
    flips.push(...line);
  }
  return flips;
}

export function legalMoves(board: Board, color: Color): string[] {
  const moves: string[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const coord = pointToCoord(row, col);
      if (getFlips(board, coord, color).length > 0) {
        moves.push(coord);
      }
    }
  }
  return moves;
}

export function applyMove(board: Board, coord: string, color: Color): Board {
  const flips = getFlips(board, coord, color);
  if (flips.length === 0) {
    throw new Error(`Illegal move ${coord} for ${color}`);
  }
  const next = board.map((row) => [...row]);
  const { row, col } = coordToPoint(coord);
  next[row][col] = color;
  for (const flip of flips) {
    const point = coordToPoint(flip);
    next[point.row][point.col] = color;
  }
  return next;
}

export function boardFromMoves(moves: string[]): Board {
  return moves.reduce(
    (board, move, index) => applyMove(board, move, colorForPly(index)),
    initialBoard(),
  );
}

export function discCounts(board: Board): Record<Color, number> {
  return board.flat().reduce(
    (counts, cell) => {
      if (cell) {
        counts[cell] += 1;
      }
      return counts;
    },
    { black: 0, white: 0 },
  );
}

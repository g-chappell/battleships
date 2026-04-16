export const GRID_SIZE = 10;

export enum CellState {
  Empty = 'empty',
  Ship = 'ship',
  Hit = 'hit',
  Miss = 'miss',
  Land = 'land',
  LandRevealed = 'land_revealed',
}

export enum ShipType {
  Carrier = 'carrier',
  Battleship = 'battleship',
  Cruiser = 'cruiser',
  Submarine = 'submarine',
  Destroyer = 'destroyer',
}

export const SHIP_LENGTHS: Record<ShipType, number> = {
  [ShipType.Carrier]: 5,
  [ShipType.Battleship]: 4,
  [ShipType.Cruiser]: 3,
  [ShipType.Submarine]: 3,
  [ShipType.Destroyer]: 2,
};

export const SHIP_NAMES: Record<ShipType, string> = {
  [ShipType.Carrier]: 'Carrier',
  [ShipType.Battleship]: 'Battleship',
  [ShipType.Cruiser]: 'Cruiser',
  [ShipType.Submarine]: 'Submarine',
  [ShipType.Destroyer]: 'Destroyer',
};

export enum Orientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export interface Coordinate {
  row: number;
  col: number;
}

export interface ShipPlacement {
  type: ShipType;
  start: Coordinate;
  orientation: Orientation;
}

export interface Ship {
  type: ShipType;
  cells: Coordinate[];
  hits: Set<string>; // "row,col" strings for quick lookup
}

export type CellGrid = CellState[][];

export enum GamePhase {
  Placement = 'placement',
  Playing = 'playing',
  Finished = 'finished',
}

export enum ShotResult {
  Miss = 'miss',
  Hit = 'hit',
  Sink = 'sink',
}

export interface ShotOutcome {
  result: ShotResult;
  coordinate: Coordinate;
  sunkShip?: ShipType;
  // True when the shot landed on a ship but was absorbed by a defensive
  // trait (Ironclad armor or Coastal Cover). UI uses this to render a
  // ricochet marker and play a deflection sound so the player knows the
  // shot did something even though `result` is downgraded to Miss.
  deflected?: boolean;
  // Which trait caused the deflect. Used by UI/audio to pick the right
  // visual/sound channel (copper-ring vs rocky-shore splash).
  deflectionSource?: 'ironclad' | 'coastal';
  // Depth Charge retaliation: if hitting a Destroyer cell triggered the
  // Destroyer's Depth Charge, the 6 retaliatory outcomes are attached here
  // so the UI can replay them on the attacker's board.
  depthChargeShots?: ShotOutcome[];
}

export interface GameState {
  phase: GamePhase;
  currentTurn: 'player' | 'opponent';
  playerBoard: CellGrid;
  opponentBoard: CellGrid;
  playerShips: Ship[];
  opponentShips: Ship[];
  winner: 'player' | 'opponent' | null;
  turnCount: number;
  shotHistory: ShotOutcome[];
}

export function coordKey(coord: Coordinate): string {
  return `${coord.row},${coord.col}`;
}

export function parseCoordKey(key: string): Coordinate {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

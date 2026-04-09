import { Board } from './Board';
import {
  GamePhase,
  type ShipPlacement,
  type Coordinate,
  type ShotOutcome,
  ShotResult,
  ShipType,
} from './types';

export class GameEngine {
  playerBoard: Board;
  opponentBoard: Board;
  phase: GamePhase = GamePhase.Placement;
  currentTurn: 'player' | 'opponent' = 'player';
  winner: 'player' | 'opponent' | null = null;
  turnCount: number = 0;
  shotHistory: ShotOutcome[] = [];
  playerShotCount: number = 0;
  opponentShotCount: number = 0;
  // Accuracy tracking: counts every action (shots + abilities) and hits
  totalPlayerActions: number = 0;
  totalPlayerHits: number = 0;
  totalOpponentActions: number = 0;
  totalOpponentHits: number = 0;

  constructor() {
    this.playerBoard = new Board();
    this.opponentBoard = new Board();
  }

  placePlayerShip(placement: ShipPlacement): boolean {
    if (this.phase !== GamePhase.Placement) return false;
    return this.playerBoard.placeShip(placement);
  }

  placeOpponentShip(placement: ShipPlacement): boolean {
    if (this.phase !== GamePhase.Placement) return false;
    return this.opponentBoard.placeShip(placement);
  }

  startGame(): boolean {
    if (this.phase !== GamePhase.Placement) return false;
    if (!this.playerBoard.allShipsPlaced() || !this.opponentBoard.allShipsPlaced()) return false;

    this.phase = GamePhase.Playing;
    this.currentTurn = 'player';
    this.turnCount = 1;
    return true;
  }

  playerShoot(coord: Coordinate): ShotOutcome | null {
    if (this.phase !== GamePhase.Playing || this.currentTurn !== 'player') return null;
    if (!this.opponentBoard.isValidTarget(coord)) return null;

    const outcome = this.opponentBoard.receiveShot(coord);
    this.shotHistory.push(outcome);
    this.playerShotCount++;

    if (this.opponentBoard.allShipsSunk()) {
      this.phase = GamePhase.Finished;
      this.winner = 'player';
      return outcome;
    }

    // Only switch turn on miss — hits give consecutive turns
    if (outcome.result === ShotResult.Miss) {
      this.currentTurn = 'opponent';
    }
    return outcome;
  }

  opponentShoot(coord: Coordinate): ShotOutcome | null {
    if (this.phase !== GamePhase.Playing || this.currentTurn !== 'opponent') return null;
    if (!this.playerBoard.isValidTarget(coord)) return null;

    const outcome = this.playerBoard.receiveShot(coord);
    this.shotHistory.push(outcome);
    this.opponentShotCount++;

    if (this.playerBoard.allShipsSunk()) {
      this.phase = GamePhase.Finished;
      this.winner = 'opponent';
      return outcome;
    }

    // Only switch turn on miss
    if (outcome.result === ShotResult.Miss) {
      this.currentTurn = 'player';
      this.turnCount++;
    }
    return outcome;
  }

  getPlayerShipsRemaining(): number {
    return this.playerBoard.ships.filter((s) => s.hits.size < s.cells.length).length;
  }

  getOpponentShipsRemaining(): number {
    return this.opponentBoard.ships.filter((s) => s.hits.size < s.cells.length).length;
  }

  getPlayerShotAccuracy(): number {
    if (this.totalPlayerActions === 0) return 0;
    return this.totalPlayerHits / this.totalPlayerActions;
  }

  /** Record an action (shot or ability) for accuracy tracking. Call AFTER trait processing. */
  recordPlayerAction(didHit: boolean): void {
    this.totalPlayerActions++;
    if (didHit) this.totalPlayerHits++;
  }

  recordOpponentAction(didHit: boolean): void {
    this.totalOpponentActions++;
    if (didHit) this.totalOpponentHits++;
  }

  getSunkShipTypes(board: Board): ShipType[] {
    return board.ships
      .filter((s) => s.hits.size === s.cells.length)
      .map((s) => s.type);
  }
}

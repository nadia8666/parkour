import Blocks from "Code/Core/Registry/Blocks";
import { Utility } from "Code/Shared/Utility/Utility";
import type { BlockState } from "../Block/BlockState";
import type { Level } from "./Level";

export class Chunk {
	constructor(
		public Level: Level,
		public Key: Vector3,
		public Blocks: BlockState[] = [],
	) {}

	/**
	 * gets the blockstate at a position
	 * @param Position world pos
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns target blockstate
	 */
	public GetBlockAt(Position: Vector3, NoAir?: true) {
		const Object = this.Blocks[Utility.Vector.ToIndex(Position) - 1];
		return NoAir ? Object : (Object ?? Blocks.Air);
	}

	/**
	 * writes a blockstate in the level
	 * @param Position world pos
	 * @param State target blockstate
	 */
	public SetBlockAt(Position: Vector3, State: BlockState) {
		const Index = Utility.Vector.ToIndex(Position);
		this.Level.OnStateUpdate(this, this.Blocks[Index - 1], State);
		this.Blocks[Index - 1] = State;
	}

	/**
     * writes multiple blockstates into this specific chunk
     * @param Entries array of position and state pairs
     */
    public SetBlocksAt(Entries: { Position: Vector3, State: BlockState }[]) {
        for (const { Position, State } of Entries) {
            const Index = Utility.Vector.ToIndex(Position);
            const Prev = this.Blocks[Index - 1];
            
            this.Level.OnStateUpdate(this, Prev, State);
            this.Blocks[Index - 1] = State;
        }
    }

    /**
     * gets multiple blockstates from this specific chunk
     * @param Positions array of world positions
     * @param NoAir forces the get to return undefined instead of generating air
     */
    public GetBlocksAt(Positions: Vector3[], NoAir?: true): (BlockState | undefined)[] {
        return Positions.map(Pos => this.GetBlockAt(Pos, NoAir));
    }

	// TODO: IMPLEMENT
	/**
	 * UNFINISHED
	 */
	public Unload() {}
	
	/**
	 * UNFINISHED
	 */
	public Serialize() {}
	
	/**
	 * UNFINISHED
	 */
	public Deserialize() {}

	public static ToKey(Position: Vector3) {
		return Utility.Vector.ToKey(Position);
	}

	public static FromKey(ChunkKey: Vector3) {
		return Utility.Vector.FromKey(ChunkKey);
	}
}

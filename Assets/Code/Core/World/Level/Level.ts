import { Utility } from "Code/Shared/Utility/Utility";
import type { BlockState } from "../Block/BlockState";
import { Chunk } from "./Chunk/Chunk";

export class Level {
	public Chunks = new Map<Vector3, Chunk>();

	/**
	 * writes a blockstate in the level
	 * @param Position world pos
	 * @param State target blockstate
	 * @param LoadChunk should the chunk automatically load (will not execute set if undefined)
	 */
	public SetBlockAt(Position: Vector3, State: BlockState, LoadChunk?: true) {
		const Key = Utility.Vector.ToKey(Position);
		const TargetChunk = this.Chunks.getOrInsertComputed(Key, (Key: Vector3) => (LoadChunk ? new Chunk(this, Key) : (undefined as unknown as Chunk)));
		TargetChunk?.SetBlockAt(Position, State);
	}

	/**
	 * sets block state damage for a blockpos
	 * @param Position world pos
	 * @param Damage damage as a float [0, 1]
	 */
	public SetBlockDamageAt(Position: Vector3, Damage: number) {
		this.GetChunkAt(Position)?.SetBlockDamageAt(Position, Damage);
	}

	/**
	 * gets the blockstate at a position
	 * @param Position world pos
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns target blockstate, CAN be undefind is NoAir is true
	 */
	public GetBlockAt(Position: Vector3, NoAir?: true) {
		const Key = Utility.Vector.ToKey(Position);
		return this.Chunks.getOrInsertComputed(Key, () => new Chunk(this, Key)).GetBlockAt(Position, NoAir);
	}

	/**
	 * writes multiple blockstates in the level
	 * @param Entries array of position and state pairs
	 * @param ForceLoad should the chunks automatically load
	 */
	public SetBlocksAt(Entries: { Position: Vector3; State: BlockState }[], ForceLoad?: true) {
		const Grouped = new Map<Vector3, { Position: Vector3; State: BlockState }[]>();

		for (const Entry of Entries) {
			const Key = Utility.Vector.ToKey(Entry.Position);
			if (!Grouped.has(Key)) Grouped.set(Key, []);
			Grouped.get(Key)!.push(Entry);
		}

		for (const [Key, ChunkEntries] of Grouped) {
			const TargetChunk = this.Chunks.getOrInsertComputed(Key, (K: Vector3) => (ForceLoad ? new Chunk(this, K) : (undefined as unknown as Chunk)));
			TargetChunk?.SetBlocksAt(ChunkEntries);
		}
	}

	/**
	 * gets multiple blockstates at once
	 * @param Positions array of world positions
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns blocks, CAN be undefind is NoAir is true
	 */
	public GetBlocksAt(Positions: Vector3[], NoAir?: true) {
		return Positions.map((Pos) => this.GetBlockAt(Pos, NoAir));
	}

	/**
	 * get chunk at position, does not generate a chunk if missing
	 * @see {@link Level.Chunks}
	 * @param Position world pos
	 * @returns chunk
	 */
	public GetChunkAt(Position: Vector3) {
		return this.Chunks.get(Utility.Vector.ToKey(Position));
	}

	// last state coming from an unloaded chunk can be undefined instead of air
	public OnStateUpdate(_Chunk: Chunk, _LastState: BlockState | undefined, _NewState: BlockState) {}

	/**
	 *
	 * @param ChunkKey
	 */
	public UnloadChunk(ChunkKey: Vector3) {
		const Chunk = this.Chunks.get(ChunkKey);
		Chunk?.Unload();

		return this.Chunks.delete(ChunkKey);
	}
}

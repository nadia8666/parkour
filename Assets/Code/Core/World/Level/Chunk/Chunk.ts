import Core from "Code/Core/Core";
import Blocks from "Code/Core/Registry/Blocks";
import { Utility } from "Code/Shared/Utility/Utility";
import { BlockModel } from "../../Block/BlockDef";
import type { BlockState } from "../../Block/BlockState";
import type { Level } from "../Level";

export class ChunkMeshRenderer {
	constructor(private Chunk: Chunk) {}

	public Rebuild() {}
}

export class ChunkCollisionRenderer {
	public ColliderComponents: BoxCollider[] = [];
	constructor(private Chunk: Chunk) {}

	public Rebuild() {
		this.ColliderComponents.forEach((Collider) => Destroy(Collider));
		this.ColliderComponents.clear();

		const Solid = new Set<number>();
		const Visited = new Set<number>();

		for (const [Index, State] of pairs(this.Chunk.Blocks)) if (!State.Block.Definition.NoCollide && State.Block.Definition.ModelType === BlockModel.Box) Solid.add(Index);

		for (let y = 0; y < 16; y++) {
			for (let z = 0; z < 16; z++) {
				for (let x = 0; x < 16; x++) {
					const Start = Utility.Vector.ToIndex(new Vector3(x, y, z));
					if (!Solid.has(Start) || Visited.has(Start)) continue;

					let Width = 1;
					while (x + Width < 16) {
						const Next = Utility.Vector.ToIndex(new Vector3(x + Width, y, z));
						if (!Solid.has(Next) || Visited.has(Next)) break;
						Width++;
					}

					let Depth = 1;
					let ExpandZ = true;
					while (z + Depth < 16 && ExpandZ) {
						for (let dx = 0; dx < Width; dx++) {
							const Next = Utility.Vector.ToIndex(new Vector3(x + dx, y, z + Depth));
							if (!Solid.has(Next) || Visited.has(Next)) {
								ExpandZ = false;
								break;
							}
						}
						if (ExpandZ) Depth++;
					}

					let Height = 1;
					let ExpandY = true;
					while (y + Height < 16 && ExpandY) {
						for (let dz = 0; dz < Depth; dz++) {
							for (let dx = 0; dx < Width; dx++) {
								const Next = Utility.Vector.ToIndex(new Vector3(x + dx, y + Height, z + dz));
								if (!Solid.has(Next) || Visited.has(Next)) {
									ExpandY = false;
									break;
								}
							}
							if (!ExpandY) break;
						}
						if (ExpandY) Height++;
					}

					for (let dy = 0; dy < Height; dy++) {
						for (let dz = 0; dz < Depth; dz++) {
							for (let dx = 0; dx < Width; dx++) {
								Visited.add(Utility.Vector.ToIndex(new Vector3(x + dx, y + dy, z + dz)));
							}
						}
					}

					task.spawn(() => {
						const Collider = this.Chunk.GameObject.AddComponent<BoxCollider>();
						this.ColliderComponents.push(Collider);

						Collider.size = new Vector3(Width, Height, Depth);
						Collider.center = this.Chunk.FromLocalPos(new Vector3(x + (Width - 1) / 2, y + (Height - 1) / 2, z + (Depth - 1) / 2));
					});
				}
			}
		}
	}
}

export class Chunk {
	public IsDirty = false;
	public GameObject;
	private MeshRenderer = new ChunkMeshRenderer(this);
	private CollisionRenderer = new ChunkCollisionRenderer(this);

	constructor(
		public Level: Level,
		public Key: Vector3,
		public Blocks: BlockState[] = [],
	) {
		this.GameObject = GameObject.Create(`Chunk${this.Key}`);
		task.delay(5, () => this.MarkDirty());
	}

	public MarkDirty() {
		this.IsDirty = true;

		task.spawn(() => Core().World.QueueChunkRebuild(this));
	}

	public RebuildCollision() {
		this.IsDirty = false;
		this.CollisionRenderer.Rebuild();
	}

	public RebuildMesh() {}

	/**
	 * gets the blockstate at a position
	 * @param Position world pos
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns target blockstate
	 */
	public GetBlockAt(Position: Vector3, NoAir?: true) {
		const Object = this.Blocks[Utility.Vector.ToIndexS(this.ToLocalPos(Position)) - 1];
		return NoAir ? Object : (Object ?? Blocks.Air);
	}

	/**
	 * writes a blockstate in the level
	 * @param Position world pos
	 * @param State target blockstate
	 */
	public SetBlockAt(Position: Vector3, State: BlockState) {
		const Index = Utility.Vector.ToIndexS(this.ToLocalPos(Position));
		this.Level.OnStateUpdate(this, this.Blocks[Index - 1], State);
		this.Blocks[Index - 1] = State;
	}

	/**
	 * writes multiple blockstates into this specific chunk
	 * @param Entries array of position and state pairs
	 */
	public SetBlocksAt(Entries: { Position: Vector3; State: BlockState }[]) {
		for (const { Position, State } of Entries) {
			const Index = Utility.Vector.ToIndexS(this.ToLocalPos(Position));
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
		return Positions.map((Pos) => this.GetBlockAt(Pos, NoAir));
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

	public ToLocalPos(Position: Vector3) {
		return Position.sub(Utility.Vector.FromKey(this.Key));
	}

	public FromLocalPos(Position: Vector3) {
		return Position.add(Utility.Vector.FromKey(this.Key));
	}
}

import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import Blocks from "Code/Core/Registry/Blocks";
import { Utility } from "Code/Shared/Utility/Utility";
import type { Block } from "../../Block/Block";
import { BlockModel } from "../../Block/BlockDef";
import type { BlockState } from "../../Block/BlockState";
import type { Level } from "../Level";

export class ChunkMeshRenderer {
	public Filter;
	public Renderer;
	public Mesh;

	constructor(private Chunk: Chunk) {
		this.Filter = Chunk.GameObject.AddComponent<MeshFilter>();
		this.Mesh = this.Filter.mesh;
		this.Renderer = Chunk.GameObject.AddComponent<MeshRenderer>();
	}

	public Rebuild() {
		const Mesh = this.Mesh;
		Mesh.Clear();

		const Blocks = this.Chunk.Blocks;
		const Level = this.Chunk.Level;
		const ChunkKey = this.Chunk.Key;

		const Vertices: Vector3[] = [];
		const Normals: Vector3[] = [];
		const UVs: Vector2[] = [];
		const MaterialTriangles = new Map<Material, number[]>();

		const MakeQuad = (Mat: Material, V1: Vector3, V2: Vector3, V3: Vector3, V4: Vector3, N: Vector3, W: number, H: number, Inverse: boolean) => {
			const Verts = Vertices.size();
			if (Inverse) {
				Vertices.push(V1, V4, V3, V2);
				UVs.push(new Vector2(0, 0), new Vector2(0, H), new Vector2(W, H), new Vector2(W, 0));
			} else {
				Vertices.push(V1, V2, V3, V4);
				UVs.push(new Vector2(0, 0), new Vector2(W, 0), new Vector2(W, H), new Vector2(0, H));
			}
			Normals.push(N, N, N, N);

			let Tris = MaterialTriangles.get(Mat);
			if (!Tris) {
				Tris = [];
				MaterialTriangles.set(Mat, Tris);
			}
			Tris.push(Verts, Verts + 1, Verts + 2, Verts, Verts + 2, Verts + 3);
		};

		const MaskMat: (Material | undefined)[] = [];
		const MaskBlock: (Block | undefined)[] = [];
		const MaskDamage: (number | undefined)[] = [];

		Utility.Vector.GetAdjacent(Vector3.zero).forEach((Vec) => this.ProcessAxis(Vec, Blocks, Level.Chunks.get(ChunkKey.add(Vec)), MaskMat, MaskBlock, MaskDamage, MakeQuad));

		Mesh.SetVertices(Vertices);
		Mesh.SetNormals(Normals);
		Mesh.SetUVs(0, UVs);

		const MaterialsArray: Material[] = [];
		Mesh.subMeshCount = MaterialTriangles.size();

		let SubmeshIndex = 0;
		for (const [Mat, Tris] of MaterialTriangles) {
			MaterialsArray.push(Mat);
			Mesh.SetTriangles(Tris, SubmeshIndex);
			SubmeshIndex++;
		}

		this.Renderer.materials = MaterialsArray;
	}

	public ProcessAxis(
		Axis: Vector3,
		Blocks: BlockState[],
		AdjChunk: Chunk | undefined,
		MaskMat: (Material | undefined)[],
		MaskBlock: (Block | undefined)[],
		MaskDamage: (number | undefined)[],
		EmitQuad: (Mat: Material, V1: Vector3, V2: Vector3, V3: Vector3, V4: Vector3, N: Vector3, W: number, H: number, Reversed: boolean, Damage: number) => void,
	) {
		let D = 0;
		let Sign = 1;
		if (Axis.x !== 0) {
			D = 0;
			Sign = math.sign(Axis.x);
		} else if (Axis.y !== 0) {
			D = 1;
			Sign = math.sign(Axis.y);
		} else if (Axis.z !== 0) {
			D = 2;
			Sign = math.sign(Axis.z);
		}

		const UIdx = (D + 1) % 3;
		const VIdx = (D + 2) % 3;
		const FaceOffset = Sign > 0 ? 1 : 0;
		const GetIndex = (X: number, Y: number, Z: number) => ((Z << 8) | (Y << 4) | X) - 1;
		const C = [0, 0, 0];

		for (let W = 0; W < 16; W++) {
			C[D] = W;

			for (let J = 0; J < 16; J++) {
				C[UIdx] = J;
				for (let I = 0; I < 16; I++) {
					C[VIdx] = I;

					const X = C[0],
						Y = C[1],
						Z = C[2];
					const State = Blocks[GetIndex(X, Y, Z)];
					const Blk = State?.Block;

					if (!Blk || Blk.Definition.ModelType !== BlockModel.Box) continue;

					let AdjBlock: Block | undefined;

					if ((Sign > 0 && W === 15) || (Sign < 0 && W === 0)) {
						if (AdjChunk) {
							const AdjC = [X, Y, Z];
							AdjC[D] = Sign > 0 ? 0 : 15;
							AdjBlock = AdjChunk.Blocks[GetIndex(AdjC[0], AdjC[1], AdjC[2])]?.Block;
						}
					} else {
						const NextC = [X, Y, Z];
						NextC[D] = W + Sign;
						AdjBlock = Blocks[GetIndex(NextC[0], NextC[1], NextC[2])]?.Block;
					}

					if (!AdjBlock || AdjBlock.Definition.IsTransparent()) {
						MaskMat[(J << 4) | I] = Blk.Definition.GetTextureFor(Axis);
						MaskBlock[(J << 4) | I] = Blk;
						MaskDamage[(J << 4) | I] = State.Damage || 0;
					}
				}
			}

			for (let J = 0; J < 16; J++) {
				for (let I = 0; I < 16; ) {
					const Idx = (J << 4) | I;
					const Mat = MaskMat[Idx];
					const Blk = MaskBlock[Idx];
					const Dmg = MaskDamage[Idx];

					if (Mat && Blk && Dmg !== undefined) {
						let Width = 1;
						while (I + Width < 16 && MaskMat[(J << 4) | (I + Width)] === Mat && MaskBlock[(J << 4) | (I + Width)] === Blk && MaskDamage[(J << 4) | (I + Width)] === Dmg) {
							Width++;
						}

						let Height = 1;
						let Done = false;
						while (J + Height < 16) {
							for (let K = 0; K < Width; K++) {
								const CIdx = ((J + Height) << 4) | (I + K);
								if (MaskMat[CIdx] !== Mat || MaskBlock[CIdx] !== Blk || MaskDamage[CIdx] !== Dmg) {
									Done = true;
									break;
								}
							}
							if (Done) break;
							Height++;
						}

						const MakeVert = (WPos: number, UPos: number, VPos: number) => {
							const Arr = [0, 0, 0];
							Arr[D] = WPos + FaceOffset;
							Arr[UIdx] = UPos;
							Arr[VIdx] = VPos;
							return new Vector3(Arr[0], Arr[1], Arr[2]);
						};

						const V1 = MakeVert(W, J, I);
						const V2 = MakeVert(W, J, I + Width);
						const V3 = MakeVert(W, J + Height, I + Width);
						const V4 = MakeVert(W, J + Height, I);

						if (Sign < 0) {
							EmitQuad(Mat, V4, V3, V2, V1, Axis, Width, Height, true, Dmg);
						} else {
							EmitQuad(Mat, V1, V2, V3, V4, Axis, Width, Height, true, Dmg);
						}

						for (let L = 0; L < Height; L++) {
							for (let K = 0; K < Width; K++) {
								const Clr = ((J + L) << 4) | (I + K);
								MaskMat[Clr] = undefined;
								MaskBlock[Clr] = undefined;
								MaskDamage[Clr] = undefined;
							}
						}
						I += Width;
					} else {
						I++;
					}
				}
			}
		}
	}
}

export class ChunkDamageRenderer {
	public Filter: MeshFilter;
	public Renderer: MeshRenderer;
	public Mesh: Mesh;

	constructor(private Chunk: Chunk) {
		const Obj = GameObject.Create(`Damage`);
		Obj.transform.SetParent(Chunk.GameObject.transform);
		Obj.transform.localPosition = Vector3.zero;

		this.Filter = Obj.AddComponent<MeshFilter>();
		this.Renderer = Obj.AddComponent<MeshRenderer>();
		this.Mesh = this.Filter.mesh;
		this.Renderer.material = Asset.LoadAsset("Assets/Resources/Materials/BlockDamage.mat");
	}

	public Rebuild() {
		const Vertices: Vector3[] = [];
		const UVs: Vector2[] = [];
		const Triangles: number[] = [];
		const Normals: Vector3[] = [];
		const Blocks = this.Chunk.Blocks;
		const Level = this.Chunk.Level;

		for (const Index of this.Chunk.DamagedBlocks) {
			const State = Blocks[Index - 1];
			if (!State || State.Damage <= 0) continue;

			const LocalPos = Utility.Vector.FromIndexS(Index);
			const WorldPos = this.Chunk.FromLocalPos(LocalPos);

			for (const Axis of Utility.Vector.GetAdjacent(Vector3.zero)) {
				const AdjBlock = Level.GetBlockAt(WorldPos.add(Axis));
				if (!AdjBlock || AdjBlock.Block.Definition.IsTransparent()) {
					const VCount = Vertices.size();
					let Tangent = Vector3.up;
					if (math.abs(Axis.y) > 0.9) Tangent = Vector3.forward;
					const Tangent2 = Vector3.Cross(Axis, Tangent);

					Vertices.push(
						LocalPos.add(Axis.mul(0.5)).add(Tangent.mul(-0.5)).add(Tangent2.mul(-0.5)),
						LocalPos.add(Axis.mul(0.5)).add(Tangent.mul(0.5)).add(Tangent2.mul(-0.5)),
						LocalPos.add(Axis.mul(0.5)).add(Tangent.mul(0.5)).add(Tangent2.mul(0.5)),
						LocalPos.add(Axis.mul(0.5)).add(Tangent.mul(-0.5)).add(Tangent2.mul(0.5)),
					);

					const DmgUV = new Vector2(State.Damage, 0);
					UVs.push(DmgUV, DmgUV, DmgUV, DmgUV);
					Normals.push(Axis, Axis, Axis, Axis);
					Triangles.push(VCount, VCount + 1, VCount + 2, VCount, VCount + 2, VCount + 3);
				}
			}
		}

		this.Mesh.Clear();
		if (Vertices.size() > 0) {
			this.Mesh.SetVertices(Vertices);
			this.Mesh.SetNormals(Normals);
			this.Mesh.SetUVs(1, UVs);
			this.Mesh.SetTriangles(Triangles, 0);
		}
	}
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
						Collider.center = new Vector3(x + (Width - 1) / 2, y + (Height - 1) / 2, z + (Depth - 1) / 2).add(Vector3.one.div(2));
					});
				}
			}
		}
	}
}

export class Chunk {
	public IsDirty = false;
	public DirtyFlag = {
		Collision: false,
		Visual: false,
	};
	public GameObject;
	private MeshRenderer;
	private DamageRenderer;
	private CollisionRenderer;
	public DamagedBlocks = new Set<number>();

	constructor(
		public Level: Level,
		public Key: Vector3,
		public Blocks: BlockState[] = [],
	) {
		this.GameObject = GameObject.Create(`Chunk${this.Key}`);
		this.GameObject.transform.position = Utility.Vector.FromKey(this.Key);

		this.MeshRenderer = new ChunkMeshRenderer(this);
		this.CollisionRenderer = new ChunkCollisionRenderer(this);
		this.DamageRenderer = new ChunkDamageRenderer(this);

		Utility.Vector.GetAdjacent(this.Key).forEach((Key) => Level.Chunks.get(Key)?.MarkDirty());
		this.MarkDirty();
	}

	public MarkDirty(Flag?: ("Collision" | "Visual")[]) {
		if (Flag) {
			this.DirtyFlag.Collision = this.DirtyFlag.Collision || Flag.includes("Collision");
			this.DirtyFlag.Visual = this.DirtyFlag.Visual || Flag.includes("Visual");
		} else {
			for (const [Index] of pairs(this.DirtyFlag)) this.DirtyFlag[Index] = true;
		}

		if (this.IsDirty) return;
		this.IsDirty = true;

		task.spawn(() => Core().World.QueueChunkRebuild(this));
	}

	public Rebuild() {
		if (!this.IsDirty) return;
		this.IsDirty = false;

		if (this.DirtyFlag.Collision) {
			this.CollisionRenderer.Rebuild();
			this.DirtyFlag.Collision = false;
		}

		if ($CLIENT && this.DirtyFlag.Visual) {
			this.MeshRenderer.Rebuild();
			this.DirtyFlag.Visual = false;
		}
	}

	/**
	 * gets the blockstate at a position
	 * @param Position world pos
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns target blockstate, CAN be undefind is NoAir is true
	 */
	public GetBlockAt(Position: Vector3, NoAir?: true) {
		const Object = this.Blocks[Utility.Vector.ToIndexS(this.ToLocalPos(Position)) - 1];
		return NoAir ? Object : (Object ?? Blocks.Air.NewBlockState());
	}

	/**
	 * writes a blockstate in the level
	 * @param Position world pos
	 * @param State target blockstate
	 */
	public SetBlockAt(Position: Vector3, State: BlockState) {
		const LocalPos = this.ToLocalPos(Position);
		const Index = Utility.Vector.ToIndexS(LocalPos);
		this.Level.OnStateUpdate(this, this.Blocks[Index - 1], State);
		this.Blocks[Index - 1] = State;

		if (LocalPos.x === 0 || LocalPos.z === 0 || LocalPos.y === 0 || LocalPos.x === 15 || LocalPos.z === 15 || LocalPos.y === 15)
			Utility.Vector.GetAdjacent(Position).forEach((Pos) => {
				const Key = Chunk.ToKey(Pos);
				if (Key !== this.Key) this.Level.Chunks.get(Key)?.MarkDirty(["Visual"]);
			});

		this.MarkDirty();
	}

	/**
	 * writes multiple blockstates into this specific chunk
	 * @param Entries array of position and state pairs
	 */
	public SetBlocksAt(Entries: { Position: Vector3; State: BlockState }[]) {
		const LoadAdj = new Set<Vector3>();
		for (const { Position, State } of Entries) {
			const LocalPos = this.ToLocalPos(Position);
			const Index = Utility.Vector.ToIndexS(LocalPos);
			const Prev = this.Blocks[Index - 1];

			this.Level.OnStateUpdate(this, Prev, State);
			this.Blocks[Index - 1] = State;

			if (LocalPos.x === 0 || LocalPos.z === 0 || LocalPos.y === 0 || LocalPos.x === 15 || LocalPos.z === 15 || LocalPos.y === 15) LoadAdj.add(Position);
		}

		const AdjChunks = new Set<Chunk>();
		LoadAdj.forEach((Position) =>
			Utility.Vector.GetAdjacent(Position).forEach((Pos) => {
				const Key = Chunk.ToKey(Pos);
				if (Key !== this.Key) {
					const Chunk = this.Level.Chunks.get(Key);
					if (Chunk) AdjChunks.add(Chunk);
				}
			}),
		);

		AdjChunks.forEach((Chunk) => Chunk.MarkDirty(["Visual"]));

		this.MarkDirty();
	}

	/**
	 * sets block state damage for a blockpos
	 * @param Position world pos
	 * @param Damage damage as a float [0, 1]
	 */
	public SetBlockDamageAt(Position: Vector3, Damage: number) {
		const Index = Utility.Vector.ToIndexS(this.ToLocalPos(Position));
		const State = this.Blocks[Index - 1];
		if (State) {
			const PrevDamage = State.Damage;
			State.Damage = Damage;

			if (Damage > 0) this.DamagedBlocks.add(Index);
			else this.DamagedBlocks.delete(Index);

			if ($CLIENT && PrevDamage !== Damage) this.DamageRenderer.Rebuild();
		}
	}

	/**
	 * gets multiple blockstates from this specific chunk
	 * @param Positions array of world positions
	 * @param NoAir forces the get to return undefined instead of generating air
	 * @returns target blocks, , CAN be undefind is NoAir is true
	 */
	public GetBlocksAt(Positions: Vector3[], NoAir?: true) {
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

// ai assisted

import { Airship } from "@Easy/Core/Shared/Airship";
import { Asset } from "@Easy/Core/Shared/Asset";
import Core from "Code/Core/Core";
import ENV from "Code/Server/ENV";
import { SettingsService } from "Code/Server/SettingsService";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import GearRegistrySingleton, { type GearRegistryKey } from "Code/Shared/GearRegistry";
import { Network } from "Code/Shared/Network";
import GearObject from "Code/Shared/Object/GearObject";
import type StructureObject from "Code/Shared/Object/StructureObject";
import { RandomChance, StructureRotationType } from "Code/Shared/Object/StructureObject";
import { type Inventory, ItemTypes, type PlayerInfoGetter, World } from "Code/Shared/Types";
import { NoiseHandler } from "Code/Shared/Utility/Noise";
import { DualLink } from "@inkyaker/DualLink/Code";
import Config from "../Config";
import { Settings } from "./SettingsController";

const instance = () => Core().World;

type ChunkTask = {
	Key: Vector3;
	DistSq: number;
	Action: () => void;
};

const StructuresRegistry: { [Index: string]: StructureObject } = {};
(Asset.LoadAll("Assets/Resources/Structures") as StructureObject[]).forEach((Structure) => (StructuresRegistry[Structure.Name] = Structure));

class ChunkManager {
	public readonly ChunkSize = 16;
	public readonly LoadedChunks = new Set<Vector3>();
	public readonly SurfaceLoadedChunks = new Set<Vector3>();

	private readonly BlockCache = new Map<string, number>();
	private readonly TaskQueue: ChunkTask[] = [];
	private readonly ModifiedBlocks = new Map<Vector3, number>();

	public ToKey(Position: Vector3) {
		return new Vector3(
			Position.x >= 0 ? Position.x >> 4 : -(-(Position.x + 1) >> 4) - 1,
			Position.y >= 0 ? Position.y >> 4 : -(-(Position.y + 1) >> 4) - 1,
			Position.z >= 0 ? Position.z >> 4 : -(-(Position.z + 1) >> 4) - 1,
		);
	}

	public FromKey(ChunkKey: Vector3) {
		return ChunkKey.mul(16);
	}

	public ExpandCube(Origin: Vector3, Size: number) {
		const Positions: Vector3[] = [];
		for (const x of $range(0, Size)) for (const y of $range(0, Size)) for (const z of $range(0, Size)) Positions.push(Origin.add(new Vector3(x, y, z)));
		return Positions;
	}

	public ExpandCubePerAxis(Origin: Vector3, Size: Vector3) {
		const Positions: Vector3[] = [];
		for (const x of $range(0, Size.x - 1)) for (const y of $range(0, Size.y - 1)) for (const z of $range(0, Size.z - 1)) Positions.push(Origin.add(new Vector3(x, y, z)));
		return Positions;
	}

	public IsChunkInRange(ChunkKey: Vector3, PlayerPosition: Vector3, RangeChunks: number): boolean {
		return ChunkKey.sub(this.ToKey(PlayerPosition)).magnitude <= RangeChunks;
	}

	public GetBiomeBlock(BiomeID: World.BiomeTypes, Depth: number, WorldY: number): number {
		if ([World.BiomeTypes.Desert, World.BiomeTypes.Ocean].includes(BiomeID)) {
			if (Depth < 5) return this.GetBlock("Sand");
			if (Depth < 12) return this.GetBlock("Sandstone");
			return this.GetBlock("Stone");
		}

		if (BiomeID === World.BiomeTypes.Mountain) {
			if (WorldY > 115) return this.GetBlock("Snow");
			return this.GetBlock("Stone");
		}

		if (Depth === 0) return this.GetBlock(BiomeID === World.BiomeTypes.Snow ? "Snow" : "Grass");
		if (Depth < 4) return this.GetBlock("Dirt");

		return this.GetBlock("Stone");
	}

	public GetTerrainHeight(Continental: number, Detail: number): number {
		const OceanH = math.lerp(Config.WaterLevel - 45, Config.WaterLevel - 2, math.clamp((Continental + 1) / 0.8, 0, 1));
		const PlainsH = math.lerp(Config.WaterLevel + 2, Config.WaterLevel + 35, math.clamp((Continental + 0.2) / 0.7, 0, 1));
		const MountainH = math.lerp(Config.WaterLevel + 45, Config.MountainHeight, math.clamp((Continental - 0.5) / 0.5, 0, 1));
		const BlendOceanPlains = math.clamp((Continental + 0.25) / 0.1, 0, 1);
		const BlendPlainsMountain = math.clamp((Continental - 0.45) / 0.1, 0, 1);
		const BaseHeight = math.lerp(math.lerp(OceanH, PlainsH, BlendOceanPlains), MountainH, BlendPlainsMountain);
		const Amplitude = math.lerp(math.lerp(4, 18, BlendOceanPlains), 45, BlendPlainsMountain);
		return math.floor(BaseHeight + Detail * Amplitude);
	}

	public EnqueueTask(ChunkKey: Vector3, LinkedPlayer: PlayerInfoGetter | undefined, Action: () => void) {
		const PlayerPos = LinkedPlayer ? LinkedPlayer().Position : undefined;
		const ChunkCenter = this.FromKey(ChunkKey).add(new Vector3(8, 8, 8));
		const DistSq = PlayerPos ? ChunkCenter.sub(PlayerPos).sqrMagnitude : 0;
		this.TaskQueue.push({ Key: ChunkKey, DistSq, Action });
	}

	public ProcessQueue(Limit: number) {
		for (let i = 0; i < Limit; i++) {
			const Task = this.TaskQueue.pop();
			if (Task) Task.Action();
			else break;
		}
	}

	private CanModifyBlock(Position: Vector3, Priority: number): boolean {
		const ExistingPriority = this.ModifiedBlocks.get(Position);
		return !ExistingPriority || Priority > ExistingPriority;
	}

	private MarkBlockModified(Position: Vector3, Priority: number) {
		this.ModifiedBlocks.set(Position, Priority);
	}

	public GenerateChunk(
		ChunkKey: Vector3,
		SurfaceMap: number[] | undefined,
		ContinentalMap: number[] | undefined,
		Priority: boolean = false,
		LinkedPlayer?: PlayerInfoGetter,
		CanExpand: boolean = false,
	) {
		if (this.LoadedChunks.has(ChunkKey)) return Promise.resolve<boolean>(false);
		this.LoadedChunks.add(ChunkKey);

		let Generated = false;
		const Result = new Promise<boolean>((resolve) => {
			while (!Generated) task.wait();
			resolve(true);
		});

		const Action = () => {
			const Origin = this.FromKey(ChunkKey);
			const Noise = instance().Noise;

			ContinentalMap ??= Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
			SurfaceMap ??= Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);
			const CaveMap = Noise.GetCaveBatch(Origin.x, Origin.y, Origin.z, 16, 16, 16, new Array(4096), 0.018);

			const ExecutePass = (Step: World.GenerationStep) => {
				const Positions: Vector3[] = [];
				const Blocks: number[] = [];
				const StructurePass: { Position: Vector3; Structures: StructureObject[] }[] = [];

				for (let x = 0; x < 16; x++) {
					for (let z = 0; z < 16; z++) {
						const WorldX = Origin.x + x;
						const WorldZ = Origin.z + z;

						const ContinentalVal = ContinentalMap![z * 16 + x];
						const DetailVal = SurfaceMap![z * 16 + x];
						const SurfaceY = this.GetTerrainHeight(ContinentalVal, DetailVal);

						const Temp = Noise.Get2DValue(WorldX * 0.00015, WorldZ * 0.00015);
						const Dither = Noise.Get2DValue(WorldX * 0.15, WorldZ * 0.15) * 0.06;

						let BiomeID = World.BiomeTypes.Plains;
						if (SurfaceY < Config.WaterLevel - 1) BiomeID = World.BiomeTypes.Ocean;
						else if (ContinentalVal + Dither > 0.55) BiomeID = World.BiomeTypes.Mountain;
						else if (Temp + Dither > 0.35) BiomeID = World.BiomeTypes.Desert;
						else if (Temp + Dither < -0.35) BiomeID = World.BiomeTypes.Snow;

						for (let y = 0; y < 16; y++) {
							const WorldY = Origin.y + y;
							const Position = new Vector3(WorldX, WorldY, WorldZ);

							if (!this.CanModifyBlock(Position, -1)) continue;

							let Target = 0;
							const ViableStructures: StructureObject[] = [];

							if (Step === World.GenerationStep.Terrain && WorldY <= SurfaceY) {
								const Depth = SurfaceY - WorldY;
								const CaveAlpha = math.clamp((WorldY - -20000) / (60 - -20000), 0, 1);
								let CaveThreshold = math.lerp(0.35, 0.8, CaveAlpha);
								if (Depth < 15) CaveThreshold += 0.3;

								if (CaveMap[z * 256 + y * 16 + x] <= CaveThreshold) {
									Target = this.GetBiomeBlock(BiomeID, Depth, WorldY);

									if (Target === this.GetBlock("Grass")) {
										ViableStructures.push(StructuresRegistry.ShortGrass);
										ViableStructures.push(StructuresRegistry.Tree);
									}
								}
							} else if (Step === World.GenerationStep.Water && WorldY > SurfaceY && WorldY <= Config.WaterLevel) {
								Target = this.GetBlock("Water");
							} else if (Step === World.GenerationStep.Ore && WorldY <= SurfaceY) {
								const CurrentBlock = instance().World.GetVoxelAt(Position);
								if (CurrentBlock === this.GetBlock("Stone")) {
									const OreNoise = Noise.Get3DFBM(WorldX, WorldY, WorldZ, 1, 0.15, 2, 0.6, 2) / 2 + 0.5;
									if (OreNoise > 0.8) {
										if (WorldY > 40) Target = this.GetBlock("CoalOre");
										else if (WorldY > -10) Target = this.GetBlock("IronOre");
										else if (WorldY < -50) Target = this.GetBlock("GoldOre");
									}
								}
							}

							if (Target !== 0 && this.CanModifyBlock(Position, Step)) {
								Positions.push(Position);
								Blocks.push(Target);
								this.MarkBlockModified(Position, Step);
							}

							const StepStructures = ViableStructures.filter((S) => S.GenerationStep === Step);
							if (StepStructures.size() > 0) {
								StepStructures.sort((A, B) => B.GetPriority() < A.GetPriority());
								StructurePass.push({ Position: Position, Structures: StepStructures });
							}
						}
					}
				}

				if (Positions.size() > 0) {
					instance().World.WriteVoxelGroupAt(Positions, Blocks, Priority);
					if (!ENV.Shared) Network.VoxelWorld.WriteGroup.server.FireAllClients(Positions, Blocks);
				}

				for (const Pass of StructurePass) {
					this.ProcessStructures(Pass.Position, Pass.Structures);
				}
			};

			ExecutePass(World.GenerationStep.Terrain);
			ExecutePass(World.GenerationStep.Ore);
			ExecutePass(World.GenerationStep.Water);

			if (CanExpand) this.TryPropagate(ChunkKey, LinkedPlayer, false, false, false, false, false, false, SurfaceMap, ContinentalMap, false);

			Generated = true;
		};

		if (Priority) task.spawn(Action);
		else this.EnqueueTask(ChunkKey, LinkedPlayer, Action);

		return Result;
	}

	private ProcessStructures(Origin: Vector3, ViableStructures: StructureObject[]) {
		for (const Structure of ViableStructures) {
			const ShouldGenerate = (() => {
				switch (Structure.Name) {
					case "Tree":
						return RandomChance(500);
					case "ShortGrass":
						return RandomChance(10);

					default:
						return false;
				}
			})();
			if (!ShouldGenerate) continue;

			const Data = Structure.GetData();
			const Positions: Vector3[] = [];
			const Blocks: number[] = [];

			if (Structure.RotationType === StructureRotationType.YAxis) {
				// rotate 0-360 degrees in 90 degree increments (0, 90, 180, 270)
				const RotationAmount = math.random(0, 3);
				if (RotationAmount > 0)
					Data.blockPositions.forEach((Position, Index) => {
						Data.blockPositions[Index] =
							RotationAmount === 1
								? new Vector3(-Position.z, Position.y, Position.x)
								: RotationAmount === 1
									? new Vector3(-Position.x, Position.y, -Position.z)
									: new Vector3(Position.z, Position.y, -Position.x);
					});
			}

			for (const [Index, Position] of pairs(Data.blockPositions)) {
				const TargetPos = Origin.add(Position);
				if (this.CanModifyBlock(TargetPos, Structure.GetPriority())) {
					const BlockName = Data.blockIDs[Index - 1];
					if (BlockName === "Air") continue;

					Positions.push(TargetPos);
					Blocks.push(this.GetBlock(BlockName));
					this.MarkBlockModified(TargetPos, Structure.GetPriority());
				}
			}

			if (Positions.size() > 0) {
				instance().World.WriteVoxelGroupAt(Positions, Blocks, false);
				if (!ENV.Shared) Network.VoxelWorld.WriteGroup.server.FireAllClients(Positions, Blocks);
				break;
			}
		}
	}

	public UnloadChunk(ChunkKey: Vector3) {
		this.LoadedChunks.delete(ChunkKey);
		this.SurfaceLoadedChunks.delete(ChunkKey.WithY(0));

		const Origin = this.FromKey(ChunkKey);
		for (let x = 0; x < 16; x++) {
			for (let y = 0; y < 16; y++) {
				for (let z = 0; z < 16; z++) {
					this.ModifiedBlocks.delete(Origin.add(new Vector3(x, y, z)));
				}
			}
		}
	}

	private TryPropagate(
		CenterKey: Vector3,
		LinkedPlayer: PlayerInfoGetter | undefined,
		nX: boolean,
		pX: boolean,
		nY: boolean,
		pY: boolean,
		nZ: boolean,
		pZ: boolean,
		SurfaceMap: number[],
		ContinentalMap: number[],
		ForcePropagate: boolean = false,
	) {
		const [Pos, Render] = LinkedPlayer ? [LinkedPlayer().Position, SettingsService.Settings.GetSetting("RenderDistance", LinkedPlayer().Player)] : [Vector3.zero, 4];

		if (nX) this.CheckAndLoad(CenterKey.sub(new Vector3(1, 0, 0)), Pos, Render, undefined, undefined, false, LinkedPlayer);
		if (pX) this.CheckAndLoad(CenterKey.add(new Vector3(1, 0, 0)), Pos, Render, undefined, undefined, false, LinkedPlayer);
		if (nY) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 1, 0)), Pos, Render, SurfaceMap, ContinentalMap, false, LinkedPlayer);
		if (pY) this.CheckAndLoad(CenterKey.add(new Vector3(0, 1, 0)), Pos, Render, SurfaceMap, ContinentalMap, ForcePropagate, LinkedPlayer);
		if (nZ) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 0, 1)), Pos, Render, undefined, undefined, false, LinkedPlayer);
		if (pZ) this.CheckAndLoad(CenterKey.add(new Vector3(0, 0, 1)), Pos, Render, undefined, undefined, false, LinkedPlayer);
	}

	private CheckAndLoad(
		Key: Vector3,
		PlayerPos: Vector3,
		Dist: number,
		SurfaceMap: number[] | undefined,
		ContinentalMap: number[] | undefined,
		ForcePropagate: boolean = false,
		LinkedPlayer: PlayerInfoGetter | undefined,
		CanExpand: boolean = true,
	) {
		if (!this.LoadedChunks.has(Key) && (this.IsChunkInRange(Key, PlayerPos, Dist) || ForcePropagate)) {
			this.GenerateChunk(Key, SurfaceMap, ContinentalMap, false, LinkedPlayer, CanExpand);
		}
	}

	public GetBlock(Name: string) {
		let BlockID = this.BlockCache.get(Name);
		if (BlockID) return BlockID;
		BlockID = instance().World.voxelBlocks.GetBlockIdFromStringId(`@Inkyaker/parkour:${Name}`);
		this.BlockCache.set(Name, BlockID);
		return BlockID;
	}
}

export default class WorldSingleton extends AirshipSingleton {
	@Header("Shared Properties")
	public World: VoxelWorld;

	@Header("Client Properties")
	@NonSerialized()
	public LightingTexture: Texture3D;
	public BlockBreakAtlas: Texture2DArray;
	@NonSerialized() public ActorPosition = Vector3.zero;
	@NonSerialized() private ChunkSize = 16;
	@NonSerialized() public Resolution = this.ChunkSize * Settings.RenderDistance;

	private IsDirty = true;
	private LastChunkPos = Vector3.zero;

	@Header("Server Properties")
	@NonSerialized()
	public readonly ChunkManager = new ChunkManager();
	@NonSerialized() public Noise: NoiseHandler;
	@NonSerialized() public LastUpdate = 0;
	@NonSerialized() public WorldReady = false;

	// Lifecycle Events
	public Start() {
		if ($CLIENT) {
			Network.Sync.SetSeed.client.OnServerEvent((Seed) => {
				math.randomseed(Seed);
				Config.Seed = Seed;
			});

			if (Config.Seed === 0) Network.Sync.SetSeed.client.FireServer(0);

			let LoadedChunks = 0;
			Network.VoxelWorld.WriteGroup.client.OnServerEvent((PosArr, Blocks) => {
				this.World.WriteVoxelGroupAt(PosArr, Blocks, false);
				LoadedChunks++;
			});
			Network.VoxelWorld.WriteVoxel.client.OnServerEvent((Pos, Block) => this.World.WriteVoxelAt(Pos, Block, true));

			this.LightingTexture = new Texture3D(this.Resolution, this.Resolution, this.Resolution, TextureFormat.R8, false, true);
			const Pixels: Color[] = [];
			for (const _ of $range(0, this.Resolution ** 3)) {
				Pixels.push(new Color(1, 0, 0, 1));
			}
			this.LightingTexture.SetPixels(Pixels);
			this.LightingTexture.filterMode = FilterMode.Point;
			this.LightingTexture.wrapMode = TextureWrapMode.Repeat;
			this.LightingTexture.mipMapBias = 0;
			this.LightingTexture.Apply();

			this.World.VoxelChunkUpdated.Connect((_Chunk) => {
				this.IsDirty = true;
			});

			Network.VoxelWorld.GetInitialChunks.client.FireServer();
			Network.VoxelWorld.SetLoadedStatus.client.OnServerEvent((NumChunks) => {
				while (LoadedChunks < NumChunks) task.wait();
				this.WorldReady = true;
				warn("Client world ready!");
			});
		}

		if ($SERVER) {
			Network.VoxelWorld.GetInitialChunks.server.OnClientEvent((Player) => {
				if (ENV.Shared) return;
				while (!this.WorldReady) task.wait();

				let Iterations = 0;
				for (const [Chunk] of pairs(this.ChunkManager.LoadedChunks)) {
					if (!Player) return;
					task.spawn(() => {
						const PositionArray = this.ChunkManager.ExpandCube(this.ChunkManager.FromKey(Chunk), 15);
						Network.VoxelWorld.WriteGroup.server.FireClient(Player, PositionArray, this.World.BulkReadVoxels(PositionArray));
					});

					Iterations++;
					if (Iterations % 5 === 0) task.wait();
				}

				Network.VoxelWorld.SetLoadedStatus.server.FireClient(Player, Iterations);
			});

			Network.VoxelWorld.GetInitialContainerInventory.server.SetCallback((_, LinkID) => {
				assert(LinkID.includes("BlockContainer"));
				const Link = DualLink.FromID(LinkID) as DualLink<Inventory>;
				return Link?.Data;
			});

			Config.Seed = math.random(1, 2 ** 30);
			math.randomseed(Config.Seed);

			Network.Sync.SetSeed.server.FireAllClients(Config.Seed);
			Network.Sync.SetSeed.server.OnClientEvent((Player) => Network.Sync.SetSeed.server.FireClient(Player, Config.Seed));

			print(`WORLD SEED: ${Config.Seed}`);

			this.Noise = new NoiseHandler(Config.Seed);
			let [ChunksWritten, MaxChunks] = [0, 0];
			for (const ChunkX of $range(-4, 4)) {
				for (const ChunkZ of $range(-4, 4)) {
					MaxChunks += 2;
					const Origin = new Vector3(ChunkX, 0, ChunkZ).mul(16);

					const ContinentalBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
					const DetailBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);

					const AllChunks = new Set<Vector3>();

					for (const x of $range(0, this.ChunkManager.ChunkSize - 1)) {
						for (const z of $range(0, this.ChunkManager.ChunkSize - 1)) {
							const WorldX = Origin.x + x;
							const WorldZ = Origin.z + z;

							const Continental = ContinentalBuffer[z * 16 + x];
							const Detail = DetailBuffer[z * 16 + x];
							const SurfaceY = this.ChunkManager.GetTerrainHeight(Continental, Detail);

							const TopChunk = this.ChunkManager.ToKey(new Vector3(WorldX, SurfaceY, WorldZ));
							AllChunks.add(TopChunk);
						}
					}

					AllChunks.forEach((TopChunk) => {
						this.ChunkManager.GenerateChunk(TopChunk, DetailBuffer, ContinentalBuffer, true).andThen((Written) => {
							if (Written) ChunksWritten++;
						});
						this.ChunkManager.GenerateChunk(TopChunk.sub(Vector3.up), DetailBuffer, ContinentalBuffer, true).andThen((Written) => {
							if (Written) ChunksWritten++;
						});
					});
				}
			}

			while (ChunksWritten < MaxChunks) task.wait();

			const Cont = this.Noise.Get2DFBM(0, 0, 1, 0.0004, 3, 0.5, 2);
			const Det = this.Noise.Get2DFBM(0, 0, 2, 0.01, 4, 0.5, 2);
			const Surface = this.ChunkManager.GetTerrainHeight(Cont, Det);
			Config.SpawnPos = new Vector3(0, Surface + 4, 0);

			if (ENV.Runtime === "DEV") {
				task.wait(1);
				const Pos = new Vector3(0, Surface + 15, 0);
				this.World.WriteVoxelAt(Pos, this.ChunkManager.GetBlock("WoodenChest"), true);
				while (!this.World.GetPrefabAt(Pos)) task.wait();
				const Block = this.World.GetPrefabAt(Pos).GetAirshipComponent<InteractableBlockComponent>(true)!;
				task.wait(0.1);
				let Elements = 0;
				for (const [GearID, Gear] of pairs(GearRegistrySingleton.Get())) {
					if (Gear instanceof GearObject) {
						for (const Level of $range(1, Gear.MaxLevel)) {
							const ID = `Debug${GearID}${Level}`;
							Elements++;
							Block.Container!.GetInventory().Content[Elements] = {
								Type: ItemTypes.Gear,
								Key: GearID as GearRegistryKey,
								Level: Level,
								Amount: 1,
								ObtainedTime: 0,
								UID: ID,
								Temporary: true,
								Attributes: {},
							};
						}
					}
				}
				Block.Container!.GetInventory().Size = Elements;

				warn("Debug chest spawned!");
			}

			this.WorldReady = true;
		}
	}

	public Update() {
		if ($CLIENT) {
			const Actor = Core().Client.Actor;
			if (!Actor) return;

			this.ActorPosition = VoxelWorld.Floor(Actor.transform.position);

			const x = math.floor(this.ActorPosition.x / this.ChunkSize) * this.ChunkSize;
			const y = math.floor(this.ActorPosition.y / this.ChunkSize) * this.ChunkSize;
			const z = math.floor(this.ActorPosition.z / this.ChunkSize) * this.ChunkSize;

			if (x !== this.LastChunkPos.x || y !== this.LastChunkPos.y || z !== this.LastChunkPos.z) {
				this.LastChunkPos = new Vector3(x, y, z);
				this.IsDirty = true;
			}

			if (this.IsDirty) {
				this.RedrawLighting();
				this.IsDirty = false;
			}
		}
	}

	public FixedUpdate() {
		if ($SERVER) {
			if (!this.WorldReady) return;

			this.ChunkManager.ProcessQueue(1);

			if (os.clock() - this.LastUpdate <= 0.25) return;
			this.LastUpdate = os.clock();

			Airship.Players.GetPlayers().forEach((Player) => {
				task.spawn(() => {
					const Character = Core().Server.CharacterMap.get(Player);
					if (Character) {
						let Position = Character.transform.position;
						Position = new Vector3(math.floor(Position.x), math.floor(Position.y), math.floor(Position.z));
						const LinkedPlayer: PlayerInfoGetter = () => {
							return { Player: Player, Position: Player ? Position : Vector3.zero };
						};
						Profiler.BeginSample("WorldSingleton/GetNoise");
						const RenderDistance = SettingsService.Settings.GetSetting("RenderDistance", Player);
						const AboveGround =
							Position.y + 8 >=
							this.ChunkManager.GetTerrainHeight(
								this.Noise.Get2DFBM(Position.x, Position.z, 1, 0.0004, 3, 0.5, 2),
								this.Noise.Get2DFBM(Position.x, Position.z, 2, 0.01, 4, 0.5, 2),
							);
						Profiler.EndSample();

						const Keys = this.ChunkManager.ExpandCube(this.ChunkManager.ToKey(Position).sub(Vector3.one.mul(RenderDistance / 2)), RenderDistance);

						for (const [_, Key] of pairs(Keys)) {
							if (AboveGround) {
								if (!this.ChunkManager.SurfaceLoadedChunks.has(Key.WithY(0))) {
									this.ChunkManager.SurfaceLoadedChunks.add(Key.WithY(0));

									const Origin = Key.WithY(0).mul(16);
									Profiler.BeginSample("WorldSingleton/OtherNoise");
									const ContinentalBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
									const DetailBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);
									Profiler.EndSample();

									let IterationCount = 0;
									for (const x of $range(0, this.ChunkManager.ChunkSize - 1)) {
										for (const z of $range(0, this.ChunkManager.ChunkSize - 1)) {
											const WorldX = Origin.x + x;
											const WorldZ = Origin.z + z;

											Profiler.BeginSample("WorldSingleton/GetHeight");
											const Continental = ContinentalBuffer[z * 16 + x];
											const Detail = DetailBuffer[z * 16 + x];
											const SurfaceY = this.ChunkManager.GetTerrainHeight(Continental, Detail);

											const TopChunk = this.ChunkManager.ToKey(new Vector3(WorldX, SurfaceY, WorldZ));
											const BottomChunk = TopChunk.sub(Vector3.up);
											Profiler.EndSample();

											Profiler.BeginSample("WorldSingleton/GenChunks");
											this.ChunkManager.GenerateChunk(TopChunk, DetailBuffer, ContinentalBuffer, false, LinkedPlayer);
											this.ChunkManager.GenerateChunk(BottomChunk, DetailBuffer, ContinentalBuffer, false, LinkedPlayer);
											Profiler.EndSample();

											IterationCount++;
											if (IterationCount >= 16) {
												IterationCount = 0;
												task.wait();
											}
										}
									}
								}
							} else {
								const Origin = Key.mul(16);
								Profiler.BeginSample("WorldSingleton/OtherNoise");
								const ContinentalBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
								const DetailBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);
								Profiler.EndSample();

								this.ChunkManager.GenerateChunk(Key, DetailBuffer, ContinentalBuffer, false, LinkedPlayer, true);
							}
						}
					}
				});
			});
		}
	}

	// Utility Functions
	public GetDefinitionFromBlock(BlockID: number) {
		return this.World.voxelBlocks.GetBlockDefinitionFromBlockId(BlockID).definition;
	}
	public GetBlockFromDef(BlockDef: VoxelBlockDefinition) {
		return this.ChunkManager.GetBlock(BlockDef.name);
	}

	public WriteBlockAt(Position: Vector3, BlockID: number, Priority: boolean = false) {
		this.World.WriteVoxelAt(Position, BlockID, Priority);

		if ($SERVER && !ENV.Shared) Network.VoxelWorld.WriteVoxel.server.FireAllClients(Position, BlockID);
	}

	public WriteBlockGroupAt(Position: Vector3[], BlockID: number[], Priority: boolean = false) {
		this.World.WriteVoxelGroupAt(Position, BlockID, Priority);

		if ($SERVER && !ENV.Shared) Network.VoxelWorld.WriteGroup.server.FireAllClients(Position, BlockID);
	}

	public GetBlockAt(Pos: Vector3) {
		return this.World.GetVoxelAt(Pos);
	}

	public GetBlockID(Name: string) {
		return this.ChunkManager.GetBlock(Name);
	}

	public RedrawLighting() {
		const Origin = new Vector4(this.LastChunkPos.x, this.LastChunkPos.y, this.LastChunkPos.z, 1);
		Shader.SetGlobalTexture("_Lightmap", this.LightingTexture);
		Shader.SetGlobalVector("_GridCenter", Origin);
		Shader.SetGlobalVector("_GridSize", new Vector4(this.Resolution, this.Resolution, this.Resolution, 1));
		Shader.SetGlobalTexture("_DamageTexArray", this.BlockBreakAtlas);
	}
}

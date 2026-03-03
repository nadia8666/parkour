// ai edited
//--!native
//--!optimize 2

import { Airship } from "@Easy/Core/Shared/Airship";
import { Game } from "@Easy/Core/Shared/Game";
import Config from "Code/Client/Config";
import { Settings } from "Code/Client/Framework/SettingsController";
import Core from "Code/Core/Core";
import type BlockContainerComponent from "Code/Shared/Components/BlockContainerComponent";
import GearRegistrySingleton, { type GearRegistryKey } from "Code/Shared/GearRegistry";
import { Network } from "Code/Shared/Network";
import GearObject from "Code/Shared/Object/GearObject";
import { type Inventory, ItemTypes, type PlayerInfoGetter, World } from "Code/Shared/Types";
import { NoiseHandler } from "Code/Shared/Utility/Noise";
import { DualLink } from "@inkyaker/DualLink/Code";
import ENV from "./ENV";
import { SettingsService } from "./SettingsService";

function instance() {
	return Core().Server.World;
}

type ChunkTask = {
	Key: Vector3;
	DistSq: number;
	Action: () => void;
};

class ChunkManager {
	public readonly ChunkSize = 16;
	public readonly LoadedChunks = new Set<Vector3>();
	public readonly SurfaceLoadedChunks = new Set<Vector3>();

	private readonly BlockCache = new Map<string, number>();
	private readonly TaskQueue: ChunkTask[] = [];

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
			const Positions: Vector3[] = [];
			const Blocks: number[] = [];
			const Noise = instance().Noise;

			ContinentalMap ??= Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
			SurfaceMap ??= Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);
			const CaveMap = Noise.GetCaveBatch(Origin.x, Origin.y, Origin.z, 16, 16, 16, new Array(4096), 0.018);

			let LoadNegX = false,
				LoadPosX = false;
			let LoadNegY = false,
				LoadPosY = false;
			let LoadNegZ = false,
				LoadPosZ = false;

			let ForcePropagate = false;

			let IterationCount = 0;

			for (let x = 0; x < 16; x++) {
				for (let z = 0; z < 16; z++) {
					const WorldX = Origin.x + x;
					const WorldZ = Origin.z + z;

					const ContinentalVal = ContinentalMap[z * 16 + x];
					const DetailVal = SurfaceMap[z * 16 + x];
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
						let Target = 0;

						if (WorldY > SurfaceY) {
							if (WorldY <= Config.WaterLevel) Target = this.GetBlock("Water");
						} else {
							const Depth = SurfaceY - WorldY;
							const CaveAlpha = math.clamp((WorldY - -20000) / (60 - -20000), 0, 1);
							let CaveThreshold = math.lerp(0.35, 0.8, CaveAlpha);

							if (Depth < 15) CaveThreshold += 0.3;

							const CaveVal = CaveMap[z * 256 + y * 16 + x];

							if (CaveVal > CaveThreshold) {
								Target = 0;
							} else {
								Target = this.GetBiomeBlock(BiomeID, Depth, WorldY);

								if (Target === this.GetBlock("Stone")) {
									let OreType = 0;
									const OreNoise = Noise.Get3DFBM(WorldX, WorldY, WorldZ, 1, 0.15, 2, 0.6, 2) / 2 + 0.5;

									// TODO: random variation of heights between a range
									if (OreNoise > 0.8) {
										if (WorldY > 40) OreType = this.GetBlock("CoalOre");
										else if (WorldY > -10) OreType = this.GetBlock("IronOre");
										else if (WorldY < -50) OreType = this.GetBlock("GoldOre");
									}
									if (OreType !== 0) Target = OreType;
								}
							}
						}

						if (Target === 0) {
							if (x === 0) LoadNegX = true;
							if (x === 15) LoadPosX = true;
							if (y === 0) LoadNegY = true;
							if (y === 15) LoadPosY = true;
							if (z === 0) LoadNegZ = true;
							if (z === 15) LoadPosZ = true;
						} else {
							const Position = new Vector3(WorldX, WorldY, WorldZ);
							Positions.push(Position);
							Blocks.push(Target);

							const TargetPos = Position.add(Vector3.up);
							if (Target === this.GetBlock("Grass") && math.random() <= 0.25 && instance().World.GetVoxelAt(TargetPos) === 0) {
								if (!Positions.includes(TargetPos)) {
									Positions.push(TargetPos);
									Blocks.push(this.GetBlock("ShortGrass"));
								}
							}
						}

						// for large bodies of water
						if (y === 15 && Target === this.GetBlock("Water")) {
							LoadPosY = true;
							ForcePropagate = true;
						}

						IterationCount++;
						if (IterationCount >= 64) {
							IterationCount = 0;
							task.wait();
						}
					}
				}
			}

			if (Positions.size() > 0) {
				instance().World.WriteVoxelGroupAt(Positions, Blocks, Priority);
				if (!Game.IsHosting()) {
					Network.VoxelWorld.WriteGroup.server.FireAllClients(Positions, Blocks);
				}
			}

			if (CanExpand) this.TryPropagate(ChunkKey, LinkedPlayer, LoadNegX, LoadPosX, LoadNegY, LoadPosY, LoadNegZ, LoadPosZ, SurfaceMap, ContinentalMap, ForcePropagate);

			Generated = true;
		};

		if (Priority) {
			task.spawn(Action);
		} else {
			this.EnqueueTask(ChunkKey, LinkedPlayer, Action);
		}

		return Result;
	}

	public UnloadChunk(_ChunkKey: Vector3) {}

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
		const [Pos, Render] = LinkedPlayer
			? [LinkedPlayer().Position, SettingsService.Settings.GetSetting("RenderDistance", LinkedPlayer().Player)]
			: [Vector3.zero, Settings.RenderDistance];

		if (nX) this.CheckAndLoad(CenterKey.sub(new Vector3(1, 0, 0)), Pos, Render, undefined, undefined);
		if (pX) this.CheckAndLoad(CenterKey.add(new Vector3(1, 0, 0)), Pos, Render, undefined, undefined);
		if (nY) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 1, 0)), Pos, Render, SurfaceMap, ContinentalMap);
		if (pY) this.CheckAndLoad(CenterKey.add(new Vector3(0, 1, 0)), Pos, Render, SurfaceMap, ContinentalMap, ForcePropagate);
		if (nZ) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 0, 1)), Pos, Render, undefined, undefined);
		if (pZ) this.CheckAndLoad(CenterKey.add(new Vector3(0, 0, 1)), Pos, Render, undefined, undefined);
	}

	private CheckAndLoad(Key: Vector3, PlayerPos: Vector3, Dist: number, SurfaceMap: number[] | undefined, ContinentalMap: number[] | undefined, ForcePropagate: boolean = false) {
		if (!this.LoadedChunks.has(Key) && (this.IsChunkInRange(Key, PlayerPos, Dist) || ForcePropagate)) {
			this.GenerateChunk(Key, SurfaceMap, ContinentalMap, false);
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

export default class WorldService extends AirshipSingleton {
	public World: VoxelWorld;
	public readonly ChunkManager = new ChunkManager();
	public Noise: NoiseHandler;
	public LastUpdate = 0;
	public WorldReady = false;

	@Server()
	public FixedUpdate() {
		if (!this.WorldReady) return;

		this.ChunkManager.ProcessQueue(1);

		if (os.clock() - this.LastUpdate <= 0.5) return;
		this.LastUpdate = os.clock();

		Airship.Players.GetPlayers().forEach((Player) => {
			task.spawn(() => {
				const Character = Core().Server.CharacterMap.get(Player);
				if (Character) {
					const Position = Character.transform.position;
					const LinkedPlayer: PlayerInfoGetter = () => {
						return {
							Player: Player,
							Position: Position,
						};
					};
					const RenderDistance = SettingsService.Settings.GetSetting("RenderDistance", Player);
					const AboveGround =
						Position.y + 8 >=
						this.ChunkManager.GetTerrainHeight(this.Noise.Get2DFBM(Position.x, Position.z, 1, 0.0004, 3, 0.5, 2), this.Noise.Get2DFBM(Position.x, Position.z, 2, 0.01, 4, 0.5, 2));

					const Keys = this.ChunkManager.ExpandCube(this.ChunkManager.ToKey(Position).sub(Vector3.one.mul(RenderDistance / 2)), RenderDistance);

					for (const [_, Key] of pairs(Keys)) {
						const Origin = Key.mul(16);

						const ContinentalBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
						const DetailBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);
						if (AboveGround) {
							if (!this.ChunkManager.SurfaceLoadedChunks.has(Key.WithY(0))) {
								// Load surface chunk
								this.ChunkManager.SurfaceLoadedChunks.add(Key.WithY(0));

								let IterationCount = 0;
								for (const x of $range(0, this.ChunkManager.ChunkSize - 1)) {
									for (const z of $range(0, this.ChunkManager.ChunkSize - 1)) {
										const WorldX = Origin.x + x;
										const WorldZ = Origin.z + z;

										const Continental = ContinentalBuffer[z * 16 + x];
										const Detail = DetailBuffer[z * 16 + x];
										const SurfaceY = this.ChunkManager.GetTerrainHeight(Continental, Detail);

										const TopChunk = this.ChunkManager.ToKey(new Vector3(WorldX, SurfaceY, WorldZ));
										const BottomChunk = TopChunk.sub(Vector3.up);

										this.ChunkManager.GenerateChunk(TopChunk, DetailBuffer, ContinentalBuffer, false, LinkedPlayer);
										this.ChunkManager.GenerateChunk(BottomChunk, DetailBuffer, ContinentalBuffer, false, LinkedPlayer);

										IterationCount++;
										if (IterationCount >= 16) {
											IterationCount = 0;
											task.wait();
										}
									}
								}
							}
						} else {
							this.ChunkManager.GenerateChunk(Key, DetailBuffer, ContinentalBuffer, false, LinkedPlayer, true);
						}
					}
				}
			});
		});
	}

	public OnChunkLoadEnd() {}

	@Server()
	override Start() {
		Network.VoxelWorld.GetInitialChunks.server.OnClientEvent((Player) => {
			if (Game.IsHosting()) return; // shared
			while (!this.WorldReady) task.wait();

			for (const [Chunk] of pairs(this.ChunkManager.LoadedChunks)) {
				task.spawn(() => {
					const PositionArray = this.ChunkManager.ExpandCube(this.ChunkManager.FromKey(Chunk), 15);
					Network.VoxelWorld.WriteGroup.server.FireClient(Player, PositionArray, this.World.BulkReadVoxels(PositionArray));
				});
			}
		});

		Network.VoxelWorld.GetInitialContainerInventory.server.SetCallback((_, LinkID) => {
			assert(LinkID.includes("BlockContainer"));
			const Link = DualLink.FromID(LinkID) as DualLink<Inventory>;
			return Link?.Data;
		});

		Config.Seed = math.random(1, 2 ** 30);
		print(`world seed: ${Config.Seed}`);
		math.randomseed(Config.Seed);
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
			const Pos = new Vector3(0, Surface + 15, 0);
			this.World.WriteVoxelAt(Pos, this.ChunkManager.GetBlock("WoodenChest"), true);
			while (!this.World.GetPrefabAt(Pos)) task.wait();
			const Container = this.World.GetPrefabAt(Pos).GetAirshipComponent<BlockContainerComponent>(true)!;
			Container.ID = Guid.NewGuid().ToString();
			let Elements = 0;
			for (const [GearID, Gear] of pairs(GearRegistrySingleton.Get())) {
				if (Gear instanceof GearObject) {
					for (const Level of $range(1, Gear.MaxLevel)) {
						const ID = `Debug${GearID}${Level}`;
						Elements++;
						Container.GetInventory().Content[Elements] = {
							Type: ItemTypes.Gear,
							Key: GearID as GearRegistryKey,
							Level: Level,
							Amount: 1,
							ObtainedTime: 0,
							UID: ID,
							Temporary: true,
						};
					}
				}
			}
			Container.GetInventory().Size = Elements;
		}

		this.WorldReady = true;
	}
}

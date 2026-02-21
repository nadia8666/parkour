// ai edited
//--!native
//--!optimize 2

import { Airship } from "@Easy/Core/Shared/Airship";
import { MathUtil } from "@Easy/Core/Shared/Util/MathUtil";
import Config from "Code/Client/Config";
import { Settings } from "Code/Client/Framework/SettingsController";
import Core from "Code/Core/Core";
import { World } from "Code/Shared/Types";
import { NoiseHandler } from "Code/Shared/Utility/Noise";
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
		for (const x of $range(0, Size - 1)) for (const y of $range(0, Size - 1)) for (const z of $range(0, Size - 1)) Positions.push(Origin.add(new Vector3(x, y, z)));
		return Positions;
	}

	public ExpandCubePerAxis(Origin: Vector3, Size: Vector3) {
		const Positions: Vector3[] = [];
		for (const x of $range(0, Size.x - 1)) for (const y of $range(0, Size.y - 1)) for (const z of $range(0, Size.z - 1)) Positions.push(Origin.add(new Vector3(x, y, z)));
		return Positions;
	}

	public IsChunkInRange(ChunkKey: Vector3, PlayerPosition: Vector3 | undefined, RangeChunks: number): boolean {
		if (!PlayerPosition) return false;
		const ChunkCenter = this.FromKey(ChunkKey).add(new Vector3(8, 8, 8));
		const DistSq = ChunkCenter.sub(PlayerPosition).magnitude;
		return DistSq <= RangeChunks * 16;
	}

	public GetBiomeBlock(BiomeID: World.BiomeTypes, Depth: number, WorldY: number): number {
		if ([World.BiomeTypes.DESERT, World.BiomeTypes.OCEAN].includes(BiomeID)) {
			if (Depth < 5) return this.GetBlock("Sand");
			if (Depth < 12) return this.GetBlock("Sandstone");
			return this.GetBlock("Stone");
		}
		if (BiomeID === World.BiomeTypes.MOUNTAIN) {
			if (WorldY > 115) return this.GetBlock("Snow");
			return this.GetBlock("Stone");
		}
		if (Depth === 0) return this.GetBlock(BiomeID === World.BiomeTypes.SNOW ? "Snow" : "Grass");
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

	public EnqueueTask(ChunkKey: Vector3, PlayerPos: Vector3 | undefined, Action: () => void) {
		const ChunkCenter = this.FromKey(ChunkKey).add(new Vector3(8, 8, 8));
		const DistSq = PlayerPos ? ChunkCenter.sub(PlayerPos).sqrMagnitude : 0;
		
		this.TaskQueue.push({ Key: ChunkKey, DistSq, Action });
		this.TaskQueue.sort((a, b) => a.DistSq > b.DistSq);
	}
	
	// TODO: at some point in time change this to cancel chunks that no players are near (better supports fast movements)
	public ProcessQueue(Limit: number) {
		for (let i = 0; i < Limit; i++) {
			const Task = this.TaskQueue.pop();
			if (Task) Task.Action();
			else break;
		}
	}

	public GenerateChunk(ChunkKey: Vector3, SurfaceMap: number[] | undefined, ContinentalMap: number[] | undefined, Priority: boolean = false, PlayerPos?: Vector3) {
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

					let BiomeID = World.BiomeTypes.PLAINS;
					if (SurfaceY < Config.WaterLevel - 1) BiomeID = World.BiomeTypes.OCEAN;
					else if (ContinentalVal + Dither > 0.55) BiomeID = World.BiomeTypes.MOUNTAIN;
					else if (Temp + Dither > 0.35) BiomeID = World.BiomeTypes.DESERT;
					else if (Temp + Dither < -0.35) BiomeID = World.BiomeTypes.SNOW;

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
							Positions.push(new Vector3(WorldX, WorldY, WorldZ));
							Blocks.push(Target);
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
			}

			this.TryPropagate(ChunkKey, PlayerPos, LoadNegX, LoadPosX, LoadNegY, LoadPosY, LoadNegZ, LoadPosZ, SurfaceMap, ContinentalMap);

			Generated = true;
		};

		if (Priority) {
			task.spawn(Action);
		} else {
			this.EnqueueTask(ChunkKey, PlayerPos, Action);
		}

		return Result;
	}

	public UnloadChunk(_ChunkKey: Vector3) {}

	private TryPropagate(
		CenterKey: Vector3,
		PlayerPos: Vector3 | undefined,
		nX: boolean,
		pX: boolean,
		nY: boolean,
		pY: boolean,
		nZ: boolean,
		pZ: boolean,
		SurfaceMap: number[],
		ContinentalMap: number[],
	) {
		const RenderDist = Settings.RenderDistance;

		if (nX) this.CheckAndLoad(CenterKey.sub(new Vector3(1, 0, 0)), PlayerPos, RenderDist, undefined, undefined);
		if (pX) this.CheckAndLoad(CenterKey.add(new Vector3(1, 0, 0)), PlayerPos, RenderDist, undefined, undefined);
		if (nY) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 1, 0)), PlayerPos, RenderDist, SurfaceMap, ContinentalMap);
		if (pY) this.CheckAndLoad(CenterKey.add(new Vector3(0, 1, 0)), PlayerPos, RenderDist, SurfaceMap, ContinentalMap);
		if (nZ) this.CheckAndLoad(CenterKey.sub(new Vector3(0, 0, 1)), PlayerPos, RenderDist, undefined, undefined);
		if (pZ) this.CheckAndLoad(CenterKey.add(new Vector3(0, 0, 1)), PlayerPos, RenderDist, undefined, undefined);
	}

	private CheckAndLoad(Key: Vector3, PlayerPos: Vector3 | undefined, Dist: number, SurfaceMap: number[] | undefined, ContinentalMap: number[] | undefined) {
		if (!this.LoadedChunks.has(Key) && this.IsChunkInRange(Key, PlayerPos, Dist)) {
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
	public Noise = new NoiseHandler(Config.Seed);
	public LastUpdate = 0;
	public SpawningReady = false;

	public FixedUpdate() {
		this.ChunkManager.ProcessQueue(2);

		if (os.clock() - this.LastUpdate <= 0.25) return;
		this.LastUpdate = os.clock();

		Airship.Players.GetPlayers().forEach((Player) => {
			const Character = Core().Server.CharacterMap.get(Player);
			if (Character) {
				const Position = Character.transform.position;
				const CurrentChunk = this.ChunkManager.ToKey(MathUtil.FloorVec(Position));
				const RenderDistance = SettingsService.Settings.GetSetting("RenderDistance", Player);

				const Chunks = new Set<Vector3>();
				const Keys = this.ChunkManager.ExpandCubePerAxis(
					this.ChunkManager.ToKey(MathUtil.FloorVec(Position)).sub(new Vector3(RenderDistance / 2, 0, RenderDistance / 2)),
					new Vector3(RenderDistance, 1, RenderDistance),
				);

				for (const [_, Key] of pairs(Keys)) {
					if (this.ChunkManager.SurfaceLoadedChunks.has(Key.WithY(0))) continue;
					this.ChunkManager.SurfaceLoadedChunks.add(Key.WithY(0));

					const Origin = Key.mul(16);

					this.ChunkManager.EnqueueTask(Key, Position, () => {
						const ContinentalBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 1, 0.0004, 3, 0.5, 2);
						const DetailBuffer = this.Noise.Get2DFBMBatch(Origin.x, Origin.z, 16, 16, new Array(256), 2, 0.01, 4, 0.5, 2);

						let IterationCount = 0;
						for (const x of $range(0, this.ChunkManager.ChunkSize - 1)) {
							for (const z of $range(0, this.ChunkManager.ChunkSize - 1)) {
								const WorldX = Origin.x + x;
								const WorldZ = Origin.z + z;

								const Continental = ContinentalBuffer[z * 16 + x];
								const Detail = DetailBuffer[z * 16 + x];
								const SurfaceY = this.ChunkManager.GetTerrainHeight(Continental, Detail);

								const TopChunk = this.ChunkManager.ToKey(new Vector3(WorldX, SurfaceY, WorldZ));

								if (!Chunks.has(TopChunk)) {
									this.ChunkManager.GenerateChunk(TopChunk, DetailBuffer, ContinentalBuffer);
								}
								Chunks.add(TopChunk);

								const BottomChunk = TopChunk.sub(Vector3.up);
								if (!Chunks.has(BottomChunk)) {
									this.ChunkManager.GenerateChunk(BottomChunk, DetailBuffer, ContinentalBuffer);
								}
								Chunks.add(BottomChunk);

								IterationCount++;
								if (IterationCount >= 16) {
									IterationCount = 0;
									task.wait();
								}
							}
						}
					});
				}

				for (let x = -1; x <= 1; x++) {
					for (let y = -1; y <= 1; y++) {
						for (let z = -1; z <= 1; z++) {
							const SeedKey = CurrentChunk.add(new Vector3(x, y, z));
							this.ChunkManager.GenerateChunk(SeedKey, undefined, undefined, false);
						}
					}
				}
			}
		});
	}

	public OnChunkLoadEnd() {}

	override Start() {
		math.randomseed(Config.Seed);

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

		this.SpawningReady = true;
	}
}

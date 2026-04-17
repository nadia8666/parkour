import { Airship } from "@Easy/Core/Shared/Airship";
import { Game } from "@Easy/Core/Shared/Game";
import Core from "Code/Core/Core";
import Blocks from "Code/Core/Registry/Blocks";
import { Identifier } from "Code/Core/Registry/Identifier";
import type BlockDef from "Code/Core/World/Block/BlockDef";
import type { BlockState } from "Code/Core/World/Block/BlockState";
import type { Chunk } from "Code/Core/World/Level/Chunk/Chunk";
import { Level } from "Code/Core/World/Level/Level";
import ENV from "Code/Server/ENV";
import { SettingsService } from "Code/Server/SettingsService";
import { TicketManager } from "Code/Server/World/TicketManager";
import { WorldGenerator } from "Code/Server/World/WorldGenerator";
import { Network } from "Code/Shared/Network";
import type { PlayerInfoGetter } from "Code/Shared/Types";
import { Utility } from "Code/Shared/Utility/Utility";
import Config from "../../Client/Config";
import { Settings } from "../../Client/Framework/SettingsController";

export default class WorldSingleton extends AirshipSingleton {
	@Header("Shared Properties")
	public Level = new Level();

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
	public Generator: WorldGenerator;
	@NonSerialized() public TicketManager: TicketManager;
	@NonSerialized() public LastUpdate = 0;
	@NonSerialized() public WorldReady = false;

	public Start() {
		if ($CLIENT) {
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
		}

		if ($SERVER) {
			Config.Seed = math.random(1, 2 ** 30);
			math.randomseed(Config.Seed);

			print(`WORLD SEED: ${Config.Seed}`);
			
			this.Generator = new WorldGenerator();
			this.TicketManager = new TicketManager();

			this.WorldReady = true;
		}
	}

	public Update() {
		if ($CLIENT) {
			const Actor = Core().Client.Actor;
			if (!Actor) return;

			this.ActorPosition = Utility.Floor(Actor.transform.position);

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

		const Key = Utility.Vector.ToKey(this.ActorPosition ?? Vector3.zero);
		const Chunks = Utility.SetToArray(this.ChunkQueue);
		Chunks.sort((a, b) => b.Key.sub(Key).magnitude < a.Key.sub(Key).magnitude);

		const Chunk = Chunks.pop();
		if (Chunk) {
			this.ChunkQueue.delete(Chunk);

			if (!Chunk.IsDestroying) Chunk.Rebuild();
		}
	}

	public RedrawLighting() {
		const Origin = new Vector4(this.LastChunkPos.x, this.LastChunkPos.y, this.LastChunkPos.z, 1);
		Shader.SetGlobalTexture("_Lightmap", this.LightingTexture);
		Shader.SetGlobalVector("_GridCenter", Origin);
		Shader.SetGlobalVector("_GridSize", new Vector4(this.Resolution, this.Resolution, this.Resolution, 1));
		Shader.SetGlobalTexture("_DamageTexArray", this.BlockBreakAtlas);
	}

	private ChunkQueue = new Set<Chunk>();
	public QueueChunkRebuild(Target: Chunk) {
		this.ChunkQueue.add(Target);
	}
}

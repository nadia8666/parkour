//--!native
//--!optimize 2

import Core from "Code/Core/Core";
import { Settings } from "./SettingsController";

export default class WorldController extends AirshipSingleton {
	public World: VoxelWorld;
	public LightingTexture: Texture3D;
	@NonSerialized() public ActorPosition = Vector3.zero;
	private ChunkSize = 16;
	public Resolution = this.ChunkSize * Settings.RenderDistance;

	private IsDirty = true;
	private LastChunkPos = Vector3.zero;

	@Client()
	public Start() {
		this.LightingTexture = new Texture3D(this.Resolution, this.Resolution, this.Resolution, TextureFormat.R8, false, true);
		const Pixels: Color[] = [];
		for (const _ of $range(0, this.Resolution ** 3)) {
			Pixels.push(new Color(math.random(0, 255) / 255, 0, 0, 1));
		}
		this.LightingTexture.SetPixels(Pixels);
		this.LightingTexture.filterMode = FilterMode.Point;
		this.LightingTexture.wrapMode = TextureWrapMode.Repeat;
		this.LightingTexture.mipMapBias = 0;
		this.LightingTexture.Apply();

		this.World.VoxelChunkUpdated.Connect((_Chunk) => {
			this.IsDirty = true;
		});
	}

	@Client()
	public Update() {
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

	public RedrawLighting() {
		const Origin = new Vector4(this.LastChunkPos.x, this.LastChunkPos.y, this.LastChunkPos.z, 1);
		Shader.SetGlobalTexture("_Lightmap", this.LightingTexture);
		Shader.SetGlobalVector("_GridCenter", Origin);
		Shader.SetGlobalVector("_GridSize", new Vector4(this.Resolution, this.Resolution, this.Resolution, 1));
	}
}

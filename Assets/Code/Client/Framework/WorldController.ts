//--!native
//--!optimize 2

import Core from "Code/Core/Core";
import { Settings } from "./SettingsController";

export default class WorldController extends AirshipSingleton {
	public World: VoxelWorld;
	public LightingTexture: Texture2DArray;
	@NonSerialized() public ActorPosition = Vector3.zero;
	public Material: Material;
	public Resolution = 16 * 16;

	private IsDirty = true;
	private LastChunkPos = Vector3.zero;
	private ChunkSize = 16;

	@Client()
	public Start() {
		this.LightingTexture = new Texture2DArray(this.Resolution, this.Resolution, this.Resolution, TextureFormat.R8, false, true, true);
		for (const z of $range(0, this.Resolution - 1)) {
			const Pixels: Color[] = [];
			for (const _ of $range(0, this.Resolution ** 2)) {
				Pixels.push(new Color(math.random(0, 255) / 255, 0, 0, 1));
			}
			this.LightingTexture.SetPixels(Pixels, z);
		}
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
			this.LastChunkPos = this.ActorPosition;
			this.IsDirty = true;
		}

		if (this.IsDirty) {
			this.RedrawLighting();
			this.IsDirty = false;
		}
	}

	public RedrawLighting() {
		const Origin = new Vector4(this.LastChunkPos.x, this.LastChunkPos.y, this.LastChunkPos.z, 1);

		this.Material.SetTexture("_Lightmap", this.LightingTexture);
		this.Material.SetVector("_GridCenter", Origin);
		this.Material.SetVector("_GridSize", new Vector4(this.Resolution, this.Resolution, this.Resolution, 1));
	}
}

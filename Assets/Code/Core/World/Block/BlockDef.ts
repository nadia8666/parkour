export enum BlockModel {
	Box,
	Prefab,
	None,
}

export enum BlockTextureType {
	Single,
	All,
	UDH,
}

@CreateAssetMenu("Parkour/Block/New Definition", "Block.asset")
export default class BlockDef extends AirshipScriptableObject {
	public RegistryID: string;
	public DisplayName: string;

	public ModelType: BlockModel;

	@ShowIf("ModelType", BlockModel.Box) public TextureType: BlockTextureType;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.Single) public SingleTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All, BlockTextureType.UDH) public TopTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All, BlockTextureType.UDH) public BottomTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All, BlockTextureType.UDH) public HorizontalTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All) public NorthTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All) public EastTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All) public SouthTexture: Material;
	@ShowIf("ModelType", BlockModel.Box) @ShowIf("TextureType", BlockTextureType.All) public WestTexture: Material;

	@ShowIf("ModelType", BlockModel.Prefab) public Prefab: GameObject;

	public NoCollide: boolean;
	public NoOcclusion: boolean;

	public GetTextureFor(Axis: Vector3) {
		switch (Axis) {
			case Vector3.up:
				return this.TopTexture ?? this.SingleTexture;
			case Vector3.down:
				return this.BottomTexture ?? this.SingleTexture;
			case Vector3.forward:
				return this.NorthTexture ?? this.SingleTexture;
			case Vector3.right:
				return this.EastTexture ?? this.SingleTexture;
			case Vector3.back:
				return this.SouthTexture ?? this.SingleTexture;
			case Vector3.left:
				return this.WestTexture ?? this.SingleTexture;
			default:
				return this.SingleTexture;
		}
	}
}

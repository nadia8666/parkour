export enum BlockModel {
    BOX,
    PREFAB
}

@CreateAssetMenu("Parkour/Block/New Definition", "Block.asset")
export default class BlockDef extends AirshipScriptableObject {
    public RegistryID: string;
    public DisplayName: string;

    public ModelType: BlockModel;

    @ShowIf("ModelType", BlockModel.BOX) public TopTexture: Texture
    @ShowIf("ModelType", BlockModel.BOX) public BottomTexture: Texture
    @ShowIf("ModelType", BlockModel.BOX) public NorthTexture: Texture
    @ShowIf("ModelType", BlockModel.BOX) public EastTexture: Texture
    @ShowIf("ModelType", BlockModel.BOX) public SouthTexture: Texture
    @ShowIf("ModelType", BlockModel.BOX) public WestTexture: Texture

    @ShowIf("ModelType", BlockModel.PREFAB) public Prefab: GameObject
}
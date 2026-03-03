import { ItemEnums } from "../Types";

@CreateAssetMenu("Parkour/Item/New", "New Item.asset")
export default class ItemObject extends AirshipScriptableObject {
	@Header("Item Info")
	public Name: string;
	public DisplayName: string;
	public Rarity: ItemEnums.ItemRarity;
	public ModelType: ItemEnums.ItemModelType;

	@Header("Renderer")
	@ShowIf("ModelType", ItemEnums.ItemModelType.ImageGenerated)
	public ItemTexture: Texture;
	@ShowIf("ModelType", ItemEnums.ItemModelType.ImageGenerated) public ItemThickness: number;
	@ShowIf("ModelType", ItemEnums.ItemModelType.BlockModel) public BlockDef: VoxelBlockDefinition;
}

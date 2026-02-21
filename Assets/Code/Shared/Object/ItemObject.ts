import { ItemEnums } from "../Types";

@CreateAssetMenu("Parkour/Item/New", "New Item.asset")
export default class ItemObject extends AirshipScriptableObject {
	@Header("Item Info")
	public Name: string;
	public DisplayName: string;
	public Rarity: ItemEnums.ItemRarity;
	public ModelType: ItemEnums.ItemModelType;

	@Header("Renderer")
	@ShowIf("ModelType", ItemEnums.ItemModelType.IMAGE_GENERATED)
	public ItemTexture: Texture;
	@ShowIf("ModelType", ItemEnums.ItemModelType.IMAGE_GENERATED) public ItemThickness: number;
}

import Core from "Code/Core/Core";
import type { GearRegistryKey } from "../GearRegistry";
import { type AnyItem, ItemTypes } from "../Types";

@CreateAssetMenu("Parkour/New Recipe", "Recipe.asset")
export default class RecipeObject extends AirshipScriptableObject {
	@Header("Output")
	public OutputItem: string;

	@Header("Input")
	public InputItems: string[];
	public Shaped: boolean;
	@Multiline()
	@ShowIf("Shaped", true)
	public InputLayout: string;

	public ItemFromString(ItemName: string): AnyItem {
		const [Type, Name, Amount, MiscData] = ItemName.split(",");
		const BaseItem = {
			Key: Name,
			Amount: tonumber(Amount)!,
			ObtainedTime: os.clock(),
			UID: Guid.NewGuid().ToString(),
			Attributes: {},
		};

		if (Type === "gear") {
			return {
				...BaseItem,
				Type: ItemTypes.Gear,
				Key: Name as GearRegistryKey,
				Level: (json.decode(MiscData ?? '{"level": 0}') as { level: number }).level,
			};
		} else if (Type === "block") {
			return {
				...BaseItem,
				Type: ItemTypes.Block,
				BlockID: Core().World.GetBlockID(Name),
			};
		} else {
			return {
				...BaseItem,
				Type: ItemTypes.Item,
			};
		}
	}
}

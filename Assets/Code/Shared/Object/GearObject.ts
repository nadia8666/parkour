import type { GearSlots } from "../Types";

@CreateAssetMenu("Parkour/New Gear", "New Gear.asset")
export default class GearObject extends AirshipScriptableObject {
	@Header("Registry Info")
	public Slot: GearSlots;
	public Name: string;
	public MaxLevel: 0 | 1 | 2 | 3 = 0;

	@Header("Inventory Info")
	@Multiline()
	public Perks: string[];
	@Multiline() public Description: string;

	@Header("Visual")
	public WorldModel: GameObject; // TEMP
	public EquipModel: GameObject; // TEMP
}

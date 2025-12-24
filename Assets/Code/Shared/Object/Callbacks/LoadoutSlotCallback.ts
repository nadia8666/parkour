import type { GearSlots } from "Code/Shared/Types";
import { CallbackBaseObject } from "./CallbackBase";

@CreateAssetMenu("Parkour/Slot Callbacks/Loadout Slot", "Loadout Callback.asset")
export default class LoadoutSlotCallbackObject extends CallbackBaseObject {
	@Header("Callback Info")
	public SlotTarget: GearSlots;
}

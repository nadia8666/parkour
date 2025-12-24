import { CallbackBaseObject } from "./CallbackBase";

@CreateAssetMenu("Parkour/Slot Callbacks/Inventory Slot", "ISlot Callback.asset")
export default class ISlotCallbackObject extends CallbackBaseObject {
	@Header("Callback Info")
	public SlotTarget: string;
}

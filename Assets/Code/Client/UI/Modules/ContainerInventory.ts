import type { Inventory } from "Code/Shared/Types";
import type SlotComponent from "../Drag/SlotComponent";
import { CallbackType } from "../Drag/SlotComponent";

export class ContainerInventory {
	public Contents: GameObject[] = [];
	protected LinkedInventory?: Inventory;
	constructor(
		public Container: RectTransform,
		public SlotTemplate: GameObject,
	) {}

	public SetInventory(Inventory: Inventory) {
		this.LinkedInventory = Inventory;
		this.UpdateContents();
	}

	public UpdateContents() {
		this.Contents.forEach((Target) => Destroy(Target));
		this.Contents.clear();

		if (!this.LinkedInventory) return;

		for (const Index of $range(1, this.LinkedInventory.Size)) {
			const Slot = Instantiate(this.SlotTemplate);
			Slot.transform.SetParent(this.Container, false);
			this.Contents.push(Slot);

			const Drag = Slot.GetAirshipComponent<SlotComponent>()!;
			Drag.CallbackType = CallbackType.ContainerInventory;
			Drag.CIS_Inventory = this.LinkedInventory;
			Drag.SlotID = Index;
			Drag.UpdateContents();
		}
	}

	public SetActive(Active: boolean) {
		this.Container.gameObject.SetActive(Active);
	}
}

import { DualLink } from "@inkyaker/DualLink/Code";
import type { Inventory } from "../Types";

export default class BlockContainerComponent extends AirshipBehaviour {
	public SlotCount: number;
	@NonSerialized() public ID: string;
	private Link: DualLink<Inventory>;
	private Inventory: Inventory;

	override Start() {
		this.Link = new DualLink<Inventory>(`BlockContainer${this.ID}`, { Size: 0, Content: {} });
		this.Inventory = this.Link.Data;
		this.Inventory.Size = this.SlotCount;
	}

	override OnDestroy() {
		this.Link.Destroy();
	}

	public GetInventory() {
		return this.Inventory;
	}
}

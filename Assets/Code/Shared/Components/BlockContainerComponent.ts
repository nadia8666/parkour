import { Game } from "@Easy/Core/Shared/Game";
import ENV from "Code/Server/ENV";
import { DualLink } from "@inkyaker/DualLink/Code";
import { Network } from "../Network";
import type { Inventory } from "../Types";
import { ItemUtil } from "../Utility/ItemUtil";

export default class BlockContainerComponent extends AirshipBehaviour {
	public SlotCount: number;
	@NonSerialized() public ID: string;
	private Link: DualLink<Inventory>;
	private Inventory: Inventory;
	public Setup = false;

	override Start() {
		this.Link = new DualLink<Inventory>(
			`BlockContainer${this.ID}`,
			Game.IsClient() && !ENV.Shared ? Network.Level.GetInitialContainerInventory.client.FireServer(`BlockContainer${this.ID}`) : { Size: this.SlotCount, Content: {} },
			{ AutoReplicate: true },
		);
		this.Inventory = this.Link.Data;
		this.Setup = true;
	}

	override OnDestroy() {
		if (!this.Setup) return;

		if ($SERVER) {
			for (const [_, Item] of pairs(this.GetInventory().Content)) {
				ItemUtil.SpawnDroppedItem(this.transform.position, ItemUtil.GetDroppedItemVelocity(), Item);
			}
		}

		this.Link.Destroy();
	}

	public GetInventory() {
		return this.Inventory;
	}
}

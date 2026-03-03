import { Game } from "@Easy/Core/Shared/Game";
import { DualLink } from "@inkyaker/DualLink/Code";
import { Network } from "../Network";
import type { Inventory } from "../Types";

export default class BlockContainerComponent extends AirshipBehaviour {
	public SlotCount: number;
	@NonSerialized() public ID: string;
	private Link: DualLink<Inventory>;
	private Inventory: Inventory;

	override Start() {
		this.Link = new DualLink<Inventory>(
			`BlockContainer${this.ID}`,
			Game.IsClient() && !Game.IsHosting() ? Network.VoxelWorld.GetInitialContainerInventory.client.FireServer(`BlockContainer${this.ID}`) : { Size: this.SlotCount, Content: {} },
			{ AutoReplicate: true },
		);
		this.Inventory = this.Link.Data;
	}

	override OnDestroy() {
		this.Link.Destroy();
	}

	public GetInventory() {
		return this.Inventory;
	}
}

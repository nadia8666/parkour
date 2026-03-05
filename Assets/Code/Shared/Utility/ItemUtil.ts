import Config from "Code/Client/Config";
import Core from "Code/Core/Core";
import type DroppedItemEntityComponent from "../Components/DroppedItemEntityComponent";
import { type AnyItem, type BlockItem, type Inventory, ItemTypes } from "../Types";
import { Utility } from "./Utility";

export namespace ItemUtil {
	export function GetDroppedItemVelocity() {
		return Quaternion.Euler(math.random(45, 90), math.random(0, 360), 0).mul(Vector3.forward.mul(3));
	}

	export function SpawnDroppedItem(
		Position: Vector3,
		Velocity: Vector3,
		Item: AnyItem,
		Overrides?: Partial<{ [U in WritablePropertyNames<DroppedItemEntityComponent>]: WritableProperties<DroppedItemEntityComponent>[U] }>,
	) {
		const Dropped = Instantiate(Core().Server.DroppedItem, Position, Quaternion.identity);
		Dropped.GetComponent<Rigidbody>()!.linearVelocity = Velocity;
		NetworkServer.Spawn(Dropped);

		const ItemEntity = Dropped.GetAirshipComponent<DroppedItemEntityComponent>()!;
		ItemEntity.Item = Item;

		if (Overrides) {
			for (const [Index, Value] of pairs(Overrides)) {
				ItemEntity[Index] = Value as never;
			}
		}

		ItemEntity.DrawModel();
	}

	class InventoryOutputData {
		public InternalInventory: Inventory;
		public Inventory: string = "";
		public Slot: number = 0;
		public WasFound: boolean = false;

		constructor(public Item: AnyItem) {}

		public SetItem() {
			this.InternalInventory.Content[this.Slot] = this.Item;
		}
	}

	export function GetNextSlotForItem<T extends AnyItem>(Item: T, Inventories: { [Index: string]: Inventory }) {
		const OutputData = new InventoryOutputData(Item);
		function DoesMatch(ComparedItem: AnyItem) {
			if (ComparedItem.Type !== Item.Type) return false;
			if (ComparedItem.Temporary !== Item.Temporary) return false;
			if (ComparedItem.Key !== Item.Key) return false;

			switch (Item.Type) {
				case ItemTypes.Gear:
					return false;
				case ItemTypes.Item:
					return ComparedItem.Key === Item.Key;
				case ItemTypes.Block:
					return Item.BlockID === (ComparedItem as BlockItem).BlockID;
				default:
					return false;
			}
		}

		function CheckInventory(Name: string) {
			for (const Index of $range(1, Inventories[Name].Size)) {
				const Content = Inventories[Name].Content[Index];

				if (Content && DoesMatch(Content)) {
					const TotalAmount = Content.Amount + Item.Amount;

					if (TotalAmount <= Config.MaxStackSize) {
						OutputData.WasFound = true;
						OutputData.Inventory = Name;
						OutputData.Slot = Index;
						OutputData.InternalInventory = Inventories[Name];
						OutputData.Item = Utility.DeepCopyWithOverrides(Content, { Amount: TotalAmount, ObtainedTime: os.clock() });
						return true;
					}
				} else if (!Content) {
					OutputData.WasFound = true;
					OutputData.Inventory = Name;
					OutputData.Slot = Index;
					OutputData.InternalInventory = Inventories[Name];
					return true;
				}
			}

			return false;
		}

		const ToSearch = ["Hotbar", "Player"];

		for (const [_, Inventory] of pairs(ToSearch)) {
			if (CheckInventory(Inventory)) break;
		}

		return OutputData;
	}
}

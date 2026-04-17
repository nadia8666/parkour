import { Asset } from "@Easy/Core/Shared/Asset";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { NetworkUtil } from "@Easy/Core/Shared/Util/NetworkUtil";
import Core from "Code/Core/Core";
import type DroppedItemEntityComponent from "Code/Shared/Components/DroppedItemEntityComponent";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
import type RecipeObject from "Code/Shared/Object/RecipeObject";
import type { RecipeMidState } from "Code/Shared/Object/RecipeObject";
import { type BlockItem, ItemTypes } from "Code/Shared/Types";
import { ItemUtil } from "Code/Shared/Utility/ItemUtil";
import type ServerService from "./ServerService";

export class ServerInteractions {
	constructor(private Server: ServerService) {}

	public OnBindEvents() {
		Network.Effect.Respawn.server.OnClientEvent((Player) => {
			while (!Core().World.WorldReady) task.wait();
			this.Server.SafeSpawnCharacter(Player);
		});

		Network.Generic.DropItem.server.OnClientEvent((Player, Slot, Index, Amount) => {
			const Data = this.Server.DataService.GetPlayerData(this.Server.DataService.Key(Player));
			const Item = Data.Inventories[Slot]?.Content[Index];
			if (!Item) return;

			const Character = this.Server.CharacterMap.get(Player);
			if (!Character) return;

			ItemUtil.DropItem(Item, Amount, Character, () => delete Data.Inventories[Slot].Content[Index]);
		});

		Network.Generic.DropItemFromBlockContainer.server.OnClientEvent((Player, BlockPos, Index, Amount) => {
			const Prefab = Core().World.Level.GetPrefabAt(BlockPos);
			if (!Prefab) return;

			const Inventory = Prefab.GetAirshipComponent<InteractableBlockComponent>()?.Container?.GetInventory();
			if (!Inventory) return;

			const Item = Inventory.Content[Index];
			if (!Item) return;

			const Character = this.Server.CharacterMap.get(Player);
			if (!Character) return;

			ItemUtil.DropItem(Item, Amount, Character, () => delete Inventory.Content[Index]);
		});

		Network.Generic.GetDroppedItemData.server.SetCallback((_Player, NetworkID) => {
			const NetworkIdentity = NetworkUtil.GetNetworkIdentity(NetworkID);
			if (NetworkIdentity) return NetworkIdentity.gameObject.GetAirshipComponent<DroppedItemEntityComponent>()?.Item;
		});

		Network.Level.Try.BreakBlock.server.SetCallback((Player, Pos, Index) => this.TryBreakBlock(Player, Pos, Index));
		Network.Level.Try.PlaceBlock.server.SetCallback((Player, Pos, Index) => this.TryPlaceBlock(Player, Pos, Index));

		Network.Generic.CraftRecipe.server.SetCallback((Player, RecipeName) => {
			const Recipe = Asset.LoadAssetIfExists(`Assets/Resources/Recipes/${RecipeName}.asset`) as RecipeObject;
			if (!Recipe) return false;

			const Character = this.Server.CharacterMap.get(Player);
			if (!Character) return false;

			const Inventories = this.Server.DataService.GetPlayerData(Player).Inventories;
			const OutItem = Recipe.ItemFromString(Recipe.OutputItem);
			const InItems: RecipeMidState[] = [];

			for (const ItemName of Recipe.InputItems) {
				const Item = Recipe.ItemFromString(ItemName);
				InItems.push({ Item: Item, AmountOwned: 0, ToDecrement: [] });
			}

			let HasResources = true;
			InItems.forEach((Item) => {
				for (const [_, Inventory] of pairs(Inventories)) {
					if (Item.AmountOwned >= Item.Item.Amount) continue;
					for (const [_, InventoryItem] of pairs(Inventory.Content)) {
						if (InventoryItem.Type === Item.Item.Type && InventoryItem.Key === Item.Item.Key && Item.AmountOwned < Item.Item.Amount) {
							Item.AmountOwned += InventoryItem.Amount;
							Item.ToDecrement.push(InventoryItem);
							if (Item.AmountOwned >= Item.Item.Amount) {
								Item.AmountOwned = Item.Item.Amount;
								break;
							}
						}
					}
				}

				if (Item.AmountOwned < Item.Item.Amount) {
					HasResources = false;
				}
			});

			if (HasResources) {
				InItems.forEach((Item) => {
					for (const [_, Inventory] of pairs(Inventories)) {
						for (const [Index, InventoryItem] of pairs(Inventory.Content)) {
							if (Item.ToDecrement.includes(InventoryItem)) {
								const Amount = InventoryItem.Amount;
								InventoryItem.Amount = math.max(Amount - Item.AmountOwned, 0);
								if (InventoryItem.Amount <= 0) delete Inventory.Content[Index];

								const Diff = Amount - InventoryItem.Amount;
								Item.AmountOwned -= Diff;
							}
						}
					}
				});

				const TargetInventory = ItemUtil.GetNextSlotForItem(OutItem, Inventories);
				if (TargetInventory) {
					TargetInventory.SetItem();
				} else ItemUtil.SpawnDroppedItem(Character.transform.position.add(Vector3.up), Character.transform.forward.add(Vector3.up).mul(3), OutItem);

				return true;
			}

			return false;
		});
	}

	public TryBreakBlock(_Player: Player, Pos: Vector3, _Index: number) {
		const State = Core().World.Level.GetBlockAt(Pos);
		if (!State || State.Block.IsAir()) return false;

		const NewItem: BlockItem = {
			Type: ItemTypes.Block,
			ObtainedTime: os.clock(),
			Key: State.Block.Identifier.Path,
			UID: Guid.NewGuid().ToString(),
			Amount: 1,
			BlockID: State.Block.Identifier.AsResource(),
			Attributes: {},
		};

		//Core().World.WriteBlockAt(Pos, Blocks.Air.Identifier.AsString());
		ItemUtil.SpawnDroppedItem(Pos.add(Vector3.one.mul(0.5)), ItemUtil.GetDroppedItemVelocity(), NewItem, {
			PickupDelay: 0.5,
		});

		//if (Core().World.Level.GetBlockAt(Pos.add(Vector3.up)).IsBlock(Blocks.ShortGrass)) Core().World.WriteBlockAt(Pos.add(Vector3.up), Blocks.Air.Identifier.AsString());

		return true;
	}

	public TryPlaceBlock(Player: Player, Pos: Vector3, Index: number) {
		//const BlockID = Core().World.GetBlockAt(Pos);
		//if (!["parkour:Air", "parkour:ShortGrass"].includes(BlockID)) return false;

		const Data = this.Server.DataService.GetPlayerData(this.Server.DataService.Key(Player));
		const Item = Data.Inventories.Hotbar.Content[Index];
		if (!Item || Item.Type !== ItemTypes.Block) return false;

		Item.Amount--;
		if (Item.Amount <= 0) delete Data.Inventories.Hotbar.Content[Index];

		//Core().World.WriteBlockAt(Pos, Item.BlockID);

		return true;
	}
}

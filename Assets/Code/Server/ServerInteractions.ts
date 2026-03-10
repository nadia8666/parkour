import type { Player } from "@Easy/Core/Shared/Player/Player";
import { NetworkUtil } from "@Easy/Core/Shared/Util/NetworkUtil";
import Core from "Code/Core/Core";
import type DroppedItemEntityComponent from "Code/Shared/Components/DroppedItemEntityComponent";
import type InteractableBlockComponent from "Code/Shared/Components/InteractableBlockComponent";
import { Network } from "Code/Shared/Network";
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
			const Prefab = Core().World.World.GetPrefabAt(BlockPos);
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

		Network.VoxelWorld.Try.BreakBlock.server.SetCallback((Player, Pos, Index) => this.TryBreakBlock(Player, Pos, Index));
		Network.VoxelWorld.Try.PlaceBlock.server.SetCallback((Player, Pos, Index) => this.TryPlaceBlock(Player, Pos, Index));
	}

	public TryBreakBlock(_Player: Player, Pos: Vector3, _Index: number) {
		const BlockDef = Core().World.World.GetVoxelAt(Pos);
		if (!BlockDef) return false;

		const NewItem: BlockItem = {
			Type: ItemTypes.Block,
			ObtainedTime: os.clock(),
			Key: `VoxelBlock`,
			UID: Guid.NewGuid().ToString(),
			Amount: 1,
			BlockID: BlockDef,
			Attributes: {},
		};

		Core().World.WriteBlockAt(Pos, 0, true);
		ItemUtil.SpawnDroppedItem(Pos.add(Vector3.one.mul(0.5)), ItemUtil.GetDroppedItemVelocity(), NewItem, {
			PickupDelay: 0.5,
		});

		if (Core().World.GetBlockAt(Pos.add(Vector3.up)) === Core().World.GetBlockID("ShortGrass")) Core().World.WriteBlockAt(Pos.add(Vector3.up), 0, true);

		return true;
	}

	public TryPlaceBlock(Player: Player, Pos: Vector3, Index: number) {
		const BlockID = Core().World.GetBlockAt(Pos);
		if (![0, Core().World.GetBlockID("ShortGrass")].includes(BlockID)) return false;

		const Data = this.Server.DataService.GetPlayerData(this.Server.DataService.Key(Player));
		const Item = Data.Inventories.Hotbar.Content[Index];
		if (!Item || Item.Type !== ItemTypes.Block) return false;

		Item.Amount--;
		if (Item.Amount <= 0) delete Data.Inventories.Hotbar.Content[Index];

		Core().World.WriteBlockAt(Pos, Item.BlockID, true);

		return true;
	}
}

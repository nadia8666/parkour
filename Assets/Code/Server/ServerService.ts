import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { NetworkUtil } from "@Easy/Core/Shared/Util/NetworkUtil";
import Config from "Code/Client/Config";
import Core from "Code/Core/Core";
import type DroppedItemEntityComponent from "Code/Shared/Components/DroppedItemEntityComponent";
import { Network } from "Code/Shared/Network";
import { type BlockItem, ItemTypes } from "Code/Shared/Types";
import { ItemUtil } from "Code/Shared/Utility/ItemUtil";
import { Utility } from "Code/Shared/Utility/Utility";
import CFrame from "@inkyaker/CFrame/Code";
import type DataService from "./Data/DataService";
import CharacterSpawner from "./Modules/Spawner";

export default class ServerService extends AirshipSingleton {
	public Spawner = new CharacterSpawner();
	public CharacterMap = new Map<Player, Character>();
	public DataService: DataService;
	public DroppedItem: GameObject;

	@Server()
	public SafeSpawnCharacter(Player: Player) {
		const ExistingCharacter = this.CharacterMap.get(Player);
		if (ExistingCharacter) ExistingCharacter.Despawn();

		this.CharacterMap.set(Player, this.Spawner.SpawnCharacter(Player, new CFrame(Config.SpawnPos)));
	}

	@Server()
	override Start() {
		Airship.Players.ObservePlayers((Player) => {
			while (!Core().World.WorldReady) task.wait();
			this.SafeSpawnCharacter(Player);

			return () => this.CharacterMap.delete(Player);
		});

		Network.Effect.Respawn.server.OnClientEvent((Player) => {
			while (!Core().World.WorldReady) task.wait();
			this.SafeSpawnCharacter(Player);
		});

		Network.Generic.DropItem.server.OnClientEvent((Player, Slot, Index, Amount) => {
			const Data = this.DataService.GetPlayerData(this.DataService.Key(Player));
			const Item = Data.Inventories[Slot]?.Content[Index];
			if (!Item) return;

			const Character = this.CharacterMap.get(Player);
			if (!Character) return;

			let TargetAmount = 1;
			if (Amount >= Item.Amount) {
				// drop all items
				delete Data.Inventories[Slot].Content[Index];
				TargetAmount = Item.Amount;
			} else {
				// drop only one
				if (Item.Amount - Amount <= 0) delete Data.Inventories[Slot].Content[Index];
				TargetAmount = Amount;
				Item.Amount -= TargetAmount;
			}

			ItemUtil.SpawnDroppedItem(
				Character.transform.position.add(Vector3.up),
				Character.transform.forward.add(Vector3.up).mul(3),
				Utility.DeepCopyWithOverrides(Item, { Amount: TargetAmount }),
			);
		});

		Network.Generic.GetDroppedItemData.server.SetCallback((_Player, NetworkID) => {
			const NetworkIdentity = NetworkUtil.GetNetworkIdentity(NetworkID);
			if (NetworkIdentity) return NetworkIdentity.gameObject.GetAirshipComponent<DroppedItemEntityComponent>()?.Item;
		});

		// TODO: remove
		Network.TEMP.DESTROY_VOXEL.server.OnClientEvent((_Player, Pos) => {
			const BlockDef = Core().World.World.GetVoxelAt(Pos);
			if (!BlockDef) return;

			const NewItem: BlockItem = {
				Type: ItemTypes.Block,
				ObtainedTime: os.clock(),
				Key: `VoxelBlock`,
				UID: Guid.NewGuid().ToString(),
				Amount: 1,
				BlockID: BlockDef,
			};

			ItemUtil.SpawnDroppedItem(Pos.add(Vector3.one.mul(0.5)), ItemUtil.GetDroppedItemVelocity(), NewItem, {
				PickupDelay: 0.5,
			});

			Core().World.World.WriteVoxelAt(Pos, 0, true);
			Network.VoxelWorld.WriteVoxel.server.FireAllClients(Pos, 0);

			if (Core().World.World.GetVoxelAt(Pos.add(Vector3.up)) === Core().World.ChunkManager.GetBlock("ShortGrass")) {
				Core().World.World.WriteVoxelAt(Pos.add(Vector3.up), 0, true);
				Network.VoxelWorld.WriteVoxel.server.FireAllClients(Pos.add(Vector3.up), 0);
			}
		});
		Network.TEMP.PLACE_VOXEL.server.OnClientEvent((Player, Pos, Slot, Index) => {
			const BlockID = Core().World.World.GetVoxelAt(Pos);
			if (BlockID !== 0) return;

			const Data = this.DataService.GetPlayerData(this.DataService.Key(Player));
			const Item = Data.Inventories[Slot]?.Content[Index];
			if (!Item || Item.Type !== ItemTypes.Block) return;

			Item.Amount--;
			if (Item.Amount <= 0) delete Data.Inventories[Slot].Content[Index];

			Core().World.World.WriteVoxelAt(Pos, Item.BlockID);
			Network.VoxelWorld.WriteVoxel.server.FireAllClients(Pos, Item.BlockID);
		});
	}
}

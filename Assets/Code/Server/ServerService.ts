import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { NetworkUtil } from "@Easy/Core/Shared/Util/NetworkUtil";
import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import Config from "Code/Client/Config";
import type DroppedItemEntityComponent from "Code/Shared/Components/DroppedItemEntityComponent";
import { Network } from "Code/Shared/Network";
import CFrame from "@inkyaker/CFrame/Code";
import type DataService from "./Data/DataService";
import CharacterSpawner from "./Modules/Spawner";
import type WorldService from "./WorldService";

export default class ServerService extends AirshipSingleton {
	public Spawner = new CharacterSpawner();
	public CharacterMap = new Map<Player, Character>();
	public DataService: DataService;
	public World: WorldService;
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
			while (!this.World.WorldReady) task.wait();
			this.SafeSpawnCharacter(Player);

			return () => this.CharacterMap.delete(Player);
		});

		Network.Effect.Respawn.server.OnClientEvent((Player) => {
			while (!this.World.WorldReady) task.wait();
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
				TargetAmount = math.min(Item.Amount, Amount);
			}

			const Dropped = Instantiate(this.DroppedItem, Character.transform.position.add(Vector3.up), Quaternion.identity);
			Dropped.GetComponent<Rigidbody>()!.linearVelocity = Character.transform.forward.add(Vector3.up).mul(3);
			NetworkServer.Spawn(Dropped);

			const ItemEntity = Dropped.GetAirshipComponent<DroppedItemEntityComponent>()!;
			ItemEntity.Item = DeepCopy(Item);
			ItemEntity.Item.Amount = TargetAmount;
			ItemEntity.DrawModel();
		});

		Network.Generic.GetDroppedItemData.server.SetCallback((_Player, NetworkID) => {
			const NetworkIdentity = NetworkUtil.GetNetworkIdentity(NetworkID);
			if (NetworkIdentity) return NetworkIdentity.gameObject.GetAirshipComponent<DroppedItemEntityComponent>()?.Item;
		});
	}
}

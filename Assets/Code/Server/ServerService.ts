import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import Config from "Code/Client/Config";
import Core from "Code/Core/Core";
import CFrame from "@inkyaker/CFrame/Code";
import type DataService from "./Data/DataService";
import CharacterSpawner from "./Modules/Spawner";
import { ServerInteractions } from "./ServerInteractions";

export default class ServerService extends AirshipSingleton {
	public Spawner = new CharacterSpawner();
	public CharacterMap = new Map<Player, Character>();
	public DataService: DataService;
	public DroppedItem: GameObject;
	public Interactions = new ServerInteractions(this);

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

		this.Interactions.OnBindEvents();
	}
}

import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { Network } from "Code/Shared/Network";
import CFrame from "@inkyaker/CFrame/Code";
import type DataService from "./Data/DataService";
import CharacterSpawner from "./Modules/Spawner";

export default class ServerService extends AirshipSingleton {
	public Spawner = new CharacterSpawner();
	public CharacterMap = new Map<Player, Character>();
	public DataService: DataService;

	@Server()
	public SafeSpawnCharacter(Player: Player) {
		const ExistingCharacter = this.CharacterMap.get(Player);
		if (ExistingCharacter) ExistingCharacter.Despawn();

		this.CharacterMap.set(Player, this.Spawner.SpawnCharacter(Player, new CFrame(new Vector3(0, 50, 0))));
	}

	@Server()
	override Start() {
		Airship.Players.ObservePlayers((Player) => {
			this.SafeSpawnCharacter(Player);

			return () => this.CharacterMap.delete(Player);
		});
		
		Network.Effect.Respawn.server.OnClientEvent((Player) => {
			this.SafeSpawnCharacter(Player)
		});
	}
}

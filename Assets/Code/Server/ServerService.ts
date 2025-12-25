import { Airship } from "@Easy/Core/Shared/Airship";
import type Character from "@Easy/Core/Shared/Character/Character";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import CFrame from "@inkyaker/CFrame/Code";
import CharacterSpawner from "./Modules/Spawner";

export default class ServerService extends AirshipSingleton {
	public Spawner = new CharacterSpawner();
	public CharacterMap = new Map<Player, Character>();

	@Server()
	override Start() {
		Airship.Players.ObservePlayers((Player) => {
			this.Spawner.SpawnCharacter(Player, new CFrame(new Vector3(0, 50, 0)));

			return () => {
				const CurrentCharacter = this.CharacterMap.get(Player);
				if (CurrentCharacter) CurrentCharacter.Despawn();

				this.CharacterMap.delete(Player);
			};
		});
	}
}

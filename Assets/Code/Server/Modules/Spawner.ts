import type { Player } from "@Easy/Core/Shared/Player/Player";
import type CFrame from "@inkyaker/CFrame/Code";

export default class CharacterSpawner {
	public SpawnCharacter(Player: Player, CFrame: CFrame) {
		Player.SpawnCharacter(CFrame.Position, {
			lookDirection: CFrame.mul(Vector3.forward),
		});
	}
}

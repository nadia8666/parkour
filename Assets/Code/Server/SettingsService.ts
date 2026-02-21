import { Airship } from "@Easy/Core/Shared/Airship";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import { Settings } from "Code/Client/Framework/SettingsController";
import { Network } from "Code/Shared/Network";

class _SettingsService {
	private PlayerMap = new Map<Player, typeof Settings>();
	constructor() {
		Airship.Players.ObservePlayers((Player) => {
			this.PlayerMap.set(Player, DeepCopy(Settings));
		});

		Network.Data.UpdateSetting.server.OnClientEvent((Player, Key, Value) => {
			const Settings = this.PlayerMap.get(Player);

			if (!Settings) return;

			if (Settings[Key] !== undefined && typeOf(Value) === typeOf(Settings[Key])) {
				Settings[Key] = Value as never;
			}
		});
	}

	public GetSetting<T extends keyof typeof Settings>(Name: T, Player: Player): (typeof Settings)[T] {
		return (this.PlayerMap.get(Player) ?? Settings)[Name];
	}
}

export namespace SettingsService {
	export const Settings = new _SettingsService();
}

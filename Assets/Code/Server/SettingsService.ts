import { Airship } from "@Easy/Core/Shared/Airship";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { deepCopy as DeepCopy, deepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import { Settings } from "Code/Client/Framework/SettingsController";
import { Network } from "Code/Shared/Network";
import { DualLink } from "@inkyaker/DualLink/Code";

class _SettingsService {
	private PlayerMap = new Map<Player, typeof Settings>();
	constructor() {
		Airship.Players.ObservePlayers((Player) => {
			try {
				const SettingsData = DeepCopy(Settings);
				const Data = Network.Sync.GetPlayerSettings.server.FireClient(Player);
				for (const [Index, Value] of pairs(Data)) {
					if (SettingsData[Index] !== undefined && typeIs(Value, typeOf(SettingsData[Index]))) {
						SettingsData[Index] = Value as never;
					}
				}

				const Link = new DualLink(`PlayerSettings${Player.userId}`, SettingsData, { AutoReplicate: true });
				this.PlayerMap.set(Player, Link.Data);
			} catch (Error) {
				print(`Failed to load settings for ${Player}, using fallback instead!\n<${Error}>`);
				this.PlayerMap.set(Player, deepCopy(Settings));
			}
		});
	}

	public GetSetting<T extends keyof typeof Settings>(Name: T, Player: Player): (typeof Settings)[T] {
		if (!Player && Name === "RenderDistance") return 0 as (typeof Settings)[T];
		return (this.PlayerMap.get(Player) ?? Settings)[Name];
	}
}

export namespace SettingsService {
	export const Settings = new _SettingsService();
}

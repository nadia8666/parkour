import { Airship, Platform } from "@Easy/Core/Shared/Airship";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { deepCopy as DeepCopy, deepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import Config from "Code/Client/Config";
import { Network } from "Code/Shared/Network";
import { type DataFormat, DataTemplate } from "Code/Shared/Types";
import { DualLink } from "@inkyaker/DualLink/Code";
import ENV from "../ENV";

const Store = Platform.Server.DataStore;
const TargetID = () => {
	while (Config.Seed === 0) task.wait();

	return `${ENV.Runtime}-World:${Config.Seed}-PlayerData:`;
};

export default class DataService extends AirshipSingleton {
	private DataMap: { [Index: string]: DualLink<DataFormat> } = {};

	public GetPlayer(Key: string) {
		const UserID = string.sub(Key, TargetID().size() + 1);
		for (const [_, Player] of pairs(Airship.Players.GetPlayers())) {
			if (Player.userId === UserID) return Player;
		}
	}

	public Key(Player: Player) {
		while (Player.userId === "loading") task.wait();
		return `${TargetID()}${Player.userId}`;
	}

	@Server()
	public async LoadPlayerData(Key: string) {
		if (!(await Store.LockKeyOrStealSafely(Key))) {
			const Player = this.GetPlayer(Key);
			if (Player) Player.Kick(`Failed to load data!`);

			return;
		}

		let ExistingData = await Store.GetKey<DataFormat>(Key);
		if (ExistingData && !ExistingData.Inventories) {
			ExistingData = undefined;
		}

		if (!ExistingData) {
			ExistingData = DeepCopy(DataTemplate);

			Store.SetKey(Key, ExistingData);
		}

		for (const [Index, Value] of pairs(DataTemplate)) {
			if (ExistingData[Index] === undefined) {
				ExistingData[Index] = Value as UnionToIntersection<typeof Value> & number;
			}
		}

		if (ExistingData.DataVersion !== DataTemplate.DataVersion) {
			for (const Version of $range(0, DataTemplate.DataVersion)) {
				switch (Version) {
					case 0:
						ExistingData.Inventories = deepCopy(DataTemplate.Inventories);
						break;
				}
			}
		}

		if (ENV.Runtime === "DEV") {
			ExistingData.Inventories = deepCopy(DataTemplate.Inventories);
		}

		this.DataMap[Key] = new DualLink(Key, ExistingData, {
			AllowUpdateFrom: [this.GetPlayer(Key) as Player],
		});
	}

	@Server()
	public async UnloadPlayerData(Key: string) {
		if (!this.IsPlayerLoaded(Key)) return;

		const Data = this.WaitForPlayerData(Key);
		for (const [_, Inventory] of pairs(Data.Inventories)) {
			for (const [Key, Value] of pairs(Inventory.Content)) {
				if (Value.Temporary) delete Inventory.Content[Key];
			}
		}
		await Store.SetKey(Key, Data);

		delete this.DataMap[Key];

		await Store.UnlockKey(Key);
	}

	public GetPlayerData(Key: string) {
		return this.DataMap[Key]?.Data;
	}

	@Server()
	public IsPlayerLoaded(Key: string) {
		return !!this.DataMap[Key];
	}

	@Server()
	public WaitForPlayerData(Key: string) {
		while (!this.DataMap[Key]) {
			task.wait();
		}

		return this.GetPlayerData(Key)!;
	}

	@Server()
	override Start() {
		Network.Data.GetInitialData.server.SetCallback((Player) => {
			return this.WaitForPlayerData(this.Key(Player)) as DataFormat;
		});

		Airship.Players.ObservePlayers((Player) => {
			const Key = this.Key(Player);
			this.LoadPlayerData(Key);

			return () => {
				this.UnloadPlayerData(Key);
			};
		});

		Platform.Server.ServerManager.onShutdown.Connect(() => {
			for (const [Key] of pairs(this.DataMap)) {
				task.spawn(() => this.UnloadPlayerData(Key as string));
			}
		});
	}

	@Server()
	override LateUpdate() {
		for (const [_, Link] of pairs(this.DataMap)) {
			Link.PrepareReplicate();
		}
	}
}

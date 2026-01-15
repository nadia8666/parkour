import { Airship, Platform } from "@Easy/Core/Shared/Airship";
import type { Player } from "@Easy/Core/Shared/Player/Player";
import { deepCopy as DeepCopy, deepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import { Network } from "Code/Shared/Network";
import { type DataFormat, DataTemplate } from "Code/Shared/Types";
import { DualLink } from "@inkyaker/DualLink/Code";
import ENV from "../ENV";

const Store = Platform.Server.DataStore;
const TargetID = `${ENV.Runtime}-PlayerData:`;

export default class DataService extends AirshipSingleton {
	private DataMap: { [Index: string]: DualLink<DataFormat> } = {};

	public GetPlayer(Key: string) {
		const UserID = string.sub(Key, TargetID.size() + 1);
		for (const [_, Player] of pairs(Airship.Players.GetPlayers())) {
			if (Player.userId === UserID) return Player;
		}
	}

	public Key(Player: Player) {
		while (Player.userId === "loading") task.wait();
		return `${TargetID}${Player.userId}`;
	}

	@Server()
	public async LoadPlayerData(Key: string) {
		if (!Store.LockKeyOrStealSafely(Key)) {
			const Player = this.GetPlayer(Key);

			if (Player) Player.Kick(`Failed to load data!`);

			return;
		}

		let ExistingData = await Store.GetKey<DataFormat>(Key);
		if (ExistingData && !ExistingData.EquippedGear) {
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
						ExistingData.Inventory = deepCopy(DataTemplate.Inventory);
						ExistingData.EquippedGear = deepCopy(DataTemplate.EquippedGear);
						break;
				}
			}
		}

		if (ENV.Runtime === "DEV") {
			ExistingData.Inventory = deepCopy(DataTemplate.Inventory);
		}

		this.DataMap[Key] = new DualLink(Key, ExistingData, {
			AllowUpdateFrom: [this.GetPlayer(Key) as Player],
		});
	}

	@Server()
	public async UnloadPlayerData(Key: string) {
		if (!this.IsPlayerLoaded(Key)) return;

		const Data = this.WaitForPlayerData(Key);
		await Store.SetKey(Key, Data);

		delete this.DataMap[Key];

		await Store.UnlockKey(Key);
	}

	@Server()
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

		// biome-ignore lint/style/noNonNullAssertion: it exists
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

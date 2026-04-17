import { NetworkFunction } from "@Easy/Core/Shared/Network/NetworkFunction";
import { NetworkSignal } from "@Easy/Core/Shared/Network/NetworkSignal";
import type { Settings } from "Code/Client/Framework/SettingsController";
import ENV from "Code/Server/ENV";
import type { AnyItem, DataFormat, Inventory } from "./Types";

export namespace Network {
	export const Sync = {
		GetInitialData: new NetworkFunction<void, DataFormat>("Network/Sync/GetInitialData"),
		GetWorldConstants: new NetworkFunction<void, DataFormat>("Network/Sync/GetWorldConstants"),
		GetPlayerSettings: new NetworkFunction<void, Settings>("Network/Sync/GetPlayerSettings"),
	};

	export const Level = {
		GetInitialChunks: new NetworkSignal<void>("Network/Level/GetInitialChunks"),
		SetLoadedStatus: new NetworkSignal<number>("Network/Level/SetLoadedStatus"),
		WriteGroup: new NetworkSignal<[Vector3[], readonly string[]]>("Network/Level/WriteGroup"),
		WriteChunk: new NetworkSignal<[Vector3, string[], boolean]>("Network/Level/WriteChunk"),
		WriteBlock: new NetworkSignal<[Vector3, string]>("Network/Level/WriteBlock"),
		UnloadChunk: new NetworkSignal<[Vector3]>("Network/Level/UnloadChunk"),
		GetInitialContainerInventory: new NetworkFunction<string, Inventory>("Network/Level/GetInitialContainerInventory"),

		Try: {
			/**
			 * @param BlockPos Target position
			 * @param Slot Hotbar Slot
			 * @returns Successful
			 */
			BreakBlock: new NetworkFunction<[Vector3, number], boolean>("Network/Level/Try/BreakBlock"),
			PlaceBlock: new NetworkFunction<[Vector3, number], boolean>("Network/Level/Try/PlaceBlock"),
		},
	};

	export const Effect = {
		Respawn: new NetworkSignal<void>("Network/Effect/Respawn"),
	};

	export const Generic = {
		DropItem: new NetworkSignal<[string, number, number]>("Network/Generic/DropItem"),
		DropItemFromBlockContainer: new NetworkSignal<[Vector3, number, number]>("Network/Generic/DropItemFromBlockContainer"),
		GetDroppedItemData: new NetworkFunction<number, AnyItem | undefined>("Network/Generic/GetDroppedItemData"),
		CraftRecipe: new NetworkFunction<[string], boolean>("Network/Generic/CraftRecipe"),
	};

	const SyncerSignal = new NetworkSignal<[string, unknown]>("Network/Internal/SyncerSignal");
	export class SyncedContainer<T> {
		constructor(
			private Value: T,
			protected UniqueID: string,
		) {
			if ($SERVER && !ENV.Shared) SyncerSignal.server.FireAllClients(this.UniqueID, this.Value);
			if ($CLIENT)
				SyncerSignal.client.OnServerEvent((ID, Value) => {
					if (ID === UniqueID) this.Value = Value as T;
				});
		}

		public Get() {
			return this.Value;
		}

		public Set(Next: T) {
			this.Value = Next;
			if ($SERVER && !ENV.Shared) SyncerSignal.server.FireAllClients(this.UniqueID, this.Value);
		}
	}
}

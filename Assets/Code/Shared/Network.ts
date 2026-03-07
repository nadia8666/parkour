import { NetworkFunction } from "@Easy/Core/Shared/Network/NetworkFunction";
import { NetworkSignal } from "@Easy/Core/Shared/Network/NetworkSignal";
import type { Settings } from "Code/Client/Framework/SettingsController";
import ENV from "Code/Server/ENV";
import type { AnyItem, DataFormat, Inventory, ValueOf } from "./Types";

export namespace Network {
	export const Data = {
		GetInitialData: new NetworkFunction<void, DataFormat>("Network/Data/GetInitialData"),
		UpdateSetting: new NetworkSignal<[keyof Settings, ValueOf<Settings>]>("Network/Data/UpdateSetting"),
	};

	export const VoxelWorld = {
		GetInitialChunks: new NetworkSignal<void>("Network/VoxelWorld/GetInitialChunks"),
		SetLoadedStatus: new NetworkSignal<number>("Network/VoxelWorld/SetLoadedStatus"),
		WriteGroup: new NetworkSignal<[Vector3[], readonly number[]]>("Network/VoxelWorld/WriteGroup"),
		WriteVoxel: new NetworkSignal<[Vector3, number]>("Network/VoxelWorld/WriteVoxel"),
		GetInitialContainerInventory: new NetworkFunction<string, Inventory>("Network/VoxelWorld/GetInitialContainerInventory"),
	};

	export const Sync = {
		SetSeed: new NetworkSignal<number>("Network/Sync/SetSeed"),
	};

	export const Effect = {
		Respawn: new NetworkSignal<void>("Network/Effect/Respawn"),
	};

	export const Generic = {
		DropItem: new NetworkSignal<[string, number, number]>("Network/Generic/DropItem"),
		DropItemFromBlockContainer: new NetworkSignal<[Vector3, number, number]>("Network/Generic/DropItemFromBlockContainer"),
		GetDroppedItemData: new NetworkFunction<number, AnyItem | undefined>("Network/Generic/GetDroppedItemData"),
	};

	export const TEMP = {
		DESTROY_VOXEL: new NetworkSignal<Vector3>("Network/TEMP/DESTROY_VOXEL"),
		PLACE_VOXEL: new NetworkSignal<[Vector3, string, number]>("Network/TEMP/PLACE_VOXEL"),
	};

	const SyncerSignal = new NetworkSignal<[string, unknown]>("Network/Internal/SyncerSignal");
	export class SyncedContainer<T> {
		constructor(
			private Value: T,
			protected UniqueID: string,
		) {
			if ($SERVER && !ENV.Shared) SyncerSignal.server.FireAllClients(this.UniqueID, this.Value);
		}

		public Get() {
			return this.Value;
		}

		public Set(Next: T) {
			this.Value = Next;
		}
	}
}

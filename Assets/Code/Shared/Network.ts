import { NetworkFunction } from "@Easy/Core/Shared/Network/NetworkFunction";
import { NetworkSignal } from "@Easy/Core/Shared/Network/NetworkSignal";
import type { Settings } from "Code/Client/Framework/SettingsController";
import type { DataFormat, ValueOf } from "./Types";

export const Network = {
	Data: {
		GetInitialData: new NetworkFunction<void, DataFormat>("Network/Data/GetInitialData"),
		UpdateSetting: new NetworkSignal<[keyof Settings, ValueOf<Settings>]>("Network/Data/UpdateSetting"),
	},

	VoxelWorld: {
		GetInitialChunks: new NetworkSignal<void>("Network/VoxelWorld/GetInitialChunks"),
		WriteGroup: new NetworkSignal<[Vector3[], readonly number[]]>("Network/VoxelWorld/WriteGroup"),
		WriteVoxel: new NetworkSignal<[Vector3, number]>("Network/VoxelWorld/WriteVoxel"),
	},

	Effect: {
		Respawn: new NetworkSignal<void>("Network/Effect/Respawn"),
	},
};

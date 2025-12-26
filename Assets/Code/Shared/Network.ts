import { NetworkFunction } from "@Easy/Core/Shared/Network/NetworkFunction";
import { NetworkSignal } from "@Easy/Core/Shared/Network/NetworkSignal";
import type { DataFormat } from "./Types";

export const Network = {
	Data: {
		GetInitialData: new NetworkFunction<void, DataFormat>("Network/Data/GetInitialData"),
	},

	Effect: {
		DamageSelf: new NetworkSignal<number>("Network/Effect/DamageSelf"),
	},
};

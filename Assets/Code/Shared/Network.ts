import { NetworkFunction } from "@Easy/Core/Shared/Network/NetworkFunction";
import type { DataFormat } from "./Types";

export const Network = {
	Data: {
		GetInitialData: new NetworkFunction<void, DataFormat>("Network/Data/GetInitialData"),
	},
};

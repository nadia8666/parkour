import type { Player } from "@Easy/Core/Shared/Player/Player";
import ENV from "Code/Server/ENV";
import type { GearRegistryKey } from "./GearRegistry";
import GearRegistrySingleton from "./GearRegistry";
import GearObject from "./Object/GearObject";

export type ValueOf<T> = T[keyof T];
//export type IntersectionToUnion<T> = T extends unknown ? keyof T : never;

export type ItemTypes = "Gear" | "Consumable" | "Resource" | "Key";
export type GearSlots = "Grip" | "Core" | "Mod" | "Augment";
export interface ItemInfo<Type extends ItemTypes> {
	Type: Type;
	Key: Type extends "Gear" ? GearRegistryKey : string;
	Level: Type extends "Gear" ? number : undefined;
	ObtainedTime: number;
	UID: string;
}

export type AnyItem = ItemInfo<ItemTypes>;

export interface DataFormat {
	EquippedGear: {
		Grip: [InventoryKey];
		Core: [InventoryKey];
		Mod: [InventoryKey, InventoryKey];
		Augment: [InventoryKey, InventoryKey, InventoryKey];
	};
	Inventory: { [Index: string]: ItemInfo<ItemTypes> };
	TrialRecords: { [Index: string]: number | undefined };
	DataVersion: number;
}

export type InventoryKey = keyof DataFormat["Inventory"];

export const DataTemplate: DataFormat = {
	EquippedGear: {
		Grip: ["None"],
		Core: ["None"],
		Mod: ["None", "None"],
		Augment: ["None", "None", "None"],
	},
	Inventory: {},
	TrialRecords: {},
	DataVersion: 1,
};

if (ENV.Runtime === "DEV") {
	// intentionally NOT using core as this module is preloaded core
	(() => {
		for (const [GearID, Gear] of pairs(GearRegistrySingleton.Get())) {
			if (Gear instanceof GearObject) {
				for (const Level of $range(1, Gear.MaxLevel)) {
					const ID = `Debug${GearID}${Level}`;
					DataTemplate.Inventory[ID] = {
						Type: "Gear",
						Key: GearID,
						Level: Level,
						ObtainedTime: 0,
						UID: ID,
					};
				}
			}
		}
	})();
}

export namespace World {
	export enum BiomeTypes {
		OCEAN,
		PLAINS,
		DESERT,
		MOUNTAIN,
		SNOW,
	}
}

export namespace ItemEnums {
	export enum ItemRarity {
		COMMON,
		UNCOMMON,
		RARE,
		EPIC,
		LEGENDARY,
		ADMINISTRATOR,
	}

	export enum ItemModelType {
		IMAGE_GENERATED,
	}
}

export namespace Client {
	export type ValidStates = "Airborne" | "Grounded" | "Wallclutch" | "Wallclimb" | "Wallrun" | "LedgeGrab" | "Slide" | "Dropdown" | "Fly" | "LadderClimb" | "Zipline";
}

export type PlayerInfoGetter = () => {
	Player: Player;
	Position: Vector3;
};

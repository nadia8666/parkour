import type { Player } from "@Easy/Core/Shared/Player/Player";
import type { GearRegistryKey } from "./GearRegistry";

export type ValueOf<T> = T[keyof T];
//export type IntersectionToUnion<T> = T extends unknown ? keyof T : never;

export enum ItemTypes {
	Gear,
	Item,
}
export const GearSlots = ["Grip", "Core", "Mod", "Augment"] as const;
export type GearSlots = (typeof GearSlots)[number];

export interface ItemInfo<Type extends ItemTypes> {
	Type: Type;
	Key: Type extends ItemTypes.Gear ? GearRegistryKey : string;
	Level: Type extends ItemTypes.Gear ? number : undefined;
	ObtainedTime: number;
	UID: string;
	Amount: number;
	Temporary?: boolean;
}

export type AnyItem = ItemInfo<ItemTypes>;

export interface Inventory {
	Size: number;
	Content: { [Index: number]: ItemInfo<ItemTypes> };
}

export interface DataFormat {
	Inventories: { [Index: string]: Inventory };
	TrialRecords: { [Index: string]: number | undefined };
	DataVersion: number;
}

export type InventoryKey = string;

export const DataTemplate: DataFormat = {
	Inventories: {
		Grip: { Size: 1, Content: {} },
		Core: { Size: 1, Content: {} },
		Mod: { Size: 2, Content: {} },
		Augment: { Size: 3, Content: {} },
		Player: {
			Size: 10,
			Content: {},
		},
		Hotbar: {
			Size: 10,
			Content: {
				1: {
					Type: ItemTypes.Item,
					Key: "CrudeRope",
					Amount: 1,
					Temporary: true,
					UID: "cr",
					ObtainedTime: 0,
					Level: undefined,
				},
			},
		},
	},
	TrialRecords: {},
	DataVersion: 1,
};

export namespace World {
	export enum BiomeTypes {
		Ocean,
		Plains,
		Desert,
		Mountain,
		Snow,
	}
}

export namespace ItemEnums {
	export enum ItemRarity {
		Common,
		Uncommon,
		Rare,
		Epic,
		Legendary,
		Administrator,
	}

	export enum ItemModelType {
		ImageGenerated,
	}
}

export namespace Client {
	export type ValidStates = "Airborne" | "Grounded" | "Wallclutch" | "Wallclimb" | "Wallrun" | "LedgeGrab" | "Slide" | "Dropdown" | "Fly" | "LadderClimb" | "Zipline";
}

export type PlayerInfoGetter = () => {
	Player: Player;
	Position: Vector3;
};

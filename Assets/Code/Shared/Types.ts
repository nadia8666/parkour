import type { Player } from "@Easy/Core/Shared/Player/Player";
import type { GearRegistryKey } from "./GearRegistry";

export type ValueOf<T> = T[keyof T];
//export type IntersectionToUnion<T> = T extends unknown ? keyof T : never;

export enum ItemTypes {
	Gear,
	Item,
	Block,
}
export const GearSlots = ["Grip", "Core", "Mod", "Augment"] as const;
export type GearSlots = (typeof GearSlots)[number];

interface ItemAttributes {
	ToolType?: "Sword" | "Axe" | "Pickaxe" | "Shovel";
}

interface BaseItemInfo<T extends ItemTypes> {
	Type: T;
	Key: T extends ItemTypes.Gear ? GearRegistryKey : string;
	ObtainedTime: number;
	UID: string;
	Amount: number;
	Temporary?: boolean;
	Attributes: ItemAttributes;
}

export interface GearItem extends BaseItemInfo<ItemTypes.Gear> {
	Level: number;
}

export interface BlockItem extends BaseItemInfo<ItemTypes.Block> {
	BlockID: number;
}

export interface OtherItem extends BaseItemInfo<Exclude<ItemTypes, ItemTypes.Gear | ItemTypes.Block>> {}

export type ItemInfo = GearItem | BlockItem | OtherItem;

export type AnyItem = ItemInfo;

export interface Inventory {
	Size: number;
	Content: { [Index: number]: AnyItem };
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
			Content: {},
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

	export enum GenerationStep {
		Terrain = 20,
		Ore = 10,
		Water = 0,
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
		BlockModel,
	}
}

export namespace Client {
	export type ValidStates = "Airborne" | "Grounded" | "Wallclutch" | "Wallclimb" | "Wallrun" | "LedgeGrab" | "Slide" | "Dropdown" | "Fly" | "LadderClimb" | "Zipline";
}

export type PlayerInfoGetter = () => {
	Player: Player;
	Position: Vector3;
};

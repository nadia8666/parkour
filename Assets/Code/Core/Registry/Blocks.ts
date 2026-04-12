import { Asset } from "@Easy/Core/Shared/Asset";
import { Block } from "../World/Block/Block";
import type BlockDef from "../World/Block/BlockDef";
import { Registry } from "./Registries";

function Get(BlockName: string): BlockDef {
	return Asset.LoadAsset<BlockDef>(`Assets/Resources/Blocks/${BlockName}.asset`);
}

export default class Blocks {
	public static Registry = new Registry<Block>("parkour");

	private static Register<B extends Block>(ID: string, Generator?: (Namespace: string, Definition: BlockDef) => B) {
		return Blocks.Registry.Register(Generator ? Generator("parkour", Get(ID)) : Block.FromDefinition("parkour", Get(ID)), ID);
	}

	public static Air = Blocks.Register("Air");
	public static Grass = Blocks.Register("Grass");
	public static Dirt = Blocks.Register("Dirt");
	public static Stone = Blocks.Register("Stone");
	public static Sand = Blocks.Register("Sand");
	public static Sandstone = Blocks.Register("Sandstone");
	public static CoalOre = Blocks.Register("CoalOre");
	public static IronOre = Blocks.Register("IronOre");
	public static GoldOre = Blocks.Register("GoldOre");
	public static Water = Blocks.Register("Water");
	public static OakLog = Blocks.Register("OakLog");
	public static OakPlanks = Blocks.Register("OakPlanks");
	public static OakLeaves = Blocks.Register("OakLeaves");
	public static Snow = Blocks.Register("Snow");
	public static ShortGrass = Blocks.Register("ShortGrass");
	public static WoodenChest = Blocks.Register("WoodenChest");
}

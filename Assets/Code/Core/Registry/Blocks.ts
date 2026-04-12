import { Asset } from "@Easy/Core/Shared/Asset";
import BlockDef from "../World/Block/BlockDef";
import { Registry } from "./Registries";

function Get(BlockName: string): BlockDef {
    return Asset.LoadAsset<BlockDef>(`Assets/Resources/VoxelWorld/Blocks/${BlockName}.asset`)
}

export default class Blocks {
    public static Registry = new Registry<BlockDef>("parkour")

    private static Register(ID: string) {
        return this.Registry.Register(Get(ID), ID)
    }

    public static Grass = this.Register("Grass")
    public static Dirt = this.Register("Dirt")
    public static Stone = this.Register("Stone")
    public static Sand = this.Register("Sand")
    public static Sandstone = this.Register("Sandstone")
    public static CoalOre = this.Register("CoalOre")
    public static IronOre = this.Register("IronOre")
    public static GoldOre = this.Register("GoldOre")
    public static Water = this.Register("Water")
    public static OakLog = this.Register("OakLog")
    public static OakPlanks = this.Register("OakPlanks")
    public static OakLeaves = this.Register("OakLeaves")
    public static Snow = this.Register("Snow")
    public static ShortGrass = this.Register("ShortGrass")
    public static WoodenChest = this.Register("WoodenChest")   
}
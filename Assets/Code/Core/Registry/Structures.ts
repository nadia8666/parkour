import { Asset } from "@Easy/Core/Shared/Asset";
import type StructureObject from "Code/Shared/Object/StructureObject";
import { Registry } from "./Registries";

export default class Structures {
	public static Registry = new Registry<StructureObject>("parkour");

	private static Register(ID: string) {
		return Structures.Registry.Register(Asset.LoadAsset(`Assets/Resources/Structures/${ID}.asset`), ID);
	}

	public static ShortGrass = Structures.Register("ShortGrass");
	public static Tree = Structures.Register("Tree");
}

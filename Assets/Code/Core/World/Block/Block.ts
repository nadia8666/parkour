import { Identifier } from "Code/Core/Registry/Identifier";
import type BlockDef from "./BlockDef";
import { BlockState } from "./BlockState";

export class Block {
	constructor(
		public Identifier: Identifier,
		public Definition: BlockDef,
	) {}

	public NewBlockState() {
		return new BlockState(this);
	}

	public IsAir() {
		return this.Identifier.IsEquals("parkour:Air");
	}

	public static FromDefinition(Namespace: string, Definition: BlockDef) {
		return new Block(Identifier.Of(Namespace, Definition.RegistryID), Definition);
	}
}

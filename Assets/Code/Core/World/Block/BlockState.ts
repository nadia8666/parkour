import type { Block } from "./Block";

export class BlockState {
	public Damage = 0;
	constructor(public Block: Block) {}

	public Is(OtherState: BlockState) {
		return OtherState.Block.Identifier.AsString() === this.Block.Identifier.AsString();
	}

	public IsBlock(OtherState: Block) {
		return OtherState.Identifier.AsString() === this.Block.Identifier.AsString();
	}
}

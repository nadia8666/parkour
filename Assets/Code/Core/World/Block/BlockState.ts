import type { Block } from "./Block";

export class BlockState {
	public Damage = 0;
	constructor(public Block: Block) {}

	public Is(OtherState: BlockState) {
		return OtherState.Block.Identifier.AsResource() === this.Block.Identifier.AsResource();
	}

	public IsBlock(OtherState: Block) {
		return OtherState.Identifier.AsResource() === this.Block.Identifier.AsResource();
	}
}

import type { BlockState } from "../Block/BlockState";

export class Chunk {
	public Blocks: BlockState[] = [];

	public GetState(Position: Vector3) {
		return this.Blocks[Position.z * 256 + Position.y * 16 + Position.x];
	}
}

import type { BlockPos, Resource, World } from "../Types";

export interface StructureData {
	blockIDs: Resource[];
	blockPositions: Vector3[];
}

export enum StructureRotationType {
	None,
	YAxis,
}

@CreateAssetMenu("Parkour/New Structure", "Structure.asset")
export default class StructureObject extends AirshipScriptableObject {
	public Name: string;
	public RotationType: StructureRotationType;
	public GenerationStep: World.GenerationStep;
	public StructurePriority: number;
	public BlockData: string;

	public GetData(): StructureData {
		const Data = json.decode<StructureData>(this.BlockData);
		if (!Data || !Data.blockIDs || !Data.blockPositions) {
			warn(`Invalid JSON data! for ${this}`);
			return { blockIDs: [], blockPositions: [] };
		}
		Data.blockPositions.forEach((Value, Index) => {
			Data.blockPositions[Index] = new Vector3(Value.x, Value.y, Value.z) as BlockPos;
		});
		return Data;
	}

	public GetPriority() {
		return this.GenerationStep + this.StructurePriority;
	}
}

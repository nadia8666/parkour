import type { World } from "../Types";

export interface StructureData {
	blockIDs: string[];
	blockPositions: Vector3[];
}

export enum StructureRotationType {
	None,
	YAxis,
}

export function RandomChance(Max: number) {
	return math.random(1, Max) === 1;
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
			Data.blockPositions[Index] = new Vector3(Value.x, Value.y, Value.z);
		});
		return Data;
	}

	public GetPriority() {
		return this.GenerationStep + this.StructurePriority;
	}
}

import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";
import type { BlockPos, ChunkPos } from "../Types";

export namespace Utility {
	export function DeepCopyWithOverrides<T extends object>(InitialValue: T, Overrides?: Partial<{ [U in keyof T]: T[U] }>) {
		const Copy = DeepCopy(InitialValue);

		if (Overrides) {
			for (const [Index, Value] of pairs(Overrides)) {
				(Copy as { [Index: string]: unknown })[Index as string] = Value;
			}
		}

		return Copy;
	}

	export function CSDictionaryToMap<A, B, T extends CSDictionary<A, B>>(Input: T) {
		const Keys: A[] = [];
		const Values: B[] = [];

		for (const i of $range(0, Input.Keys.Count)) {
			Keys[i] = Input.Keys.ElementAt(i);
		}

		for (const i of $range(0, Input.Values.Count)) {
			Values[i] = Input.Values.ElementAt(i);
		}

		const KVPairs = new Map<A, B>();
		for (const [Index, Key] of pairs(Keys)) {
			KVPairs.set(Key, Values[Index]);
		}

		return KVPairs;
	}

	/**
	 * ex: 'PascalCase123' to 'Pascal Case 123' string converter
	 * @param InputString Target String
	 * @returns String with number groups and capitalization differences spaced out
	 */
	export function FormatStringForName(InputString: string) {
		return InputString.gsub("([%l%d])(%u)", "%1 %2")[0].gsub("(%u)(%u%l)", "%1 %2")[0].gsub("([%a])(%d)", "%1 %2")[0].gsub("(%d)([%a])", "%1 %2")[0];
	}

	export function Floor(Vector: Vector3) {
		return new Vector3(math.floor(Vector.x), math.floor(Vector.y), math.floor(Vector.z));
	}

	export function RandomChance(Max: number) {
		return math.random(1, Max) === 1;
	}

	export namespace Vector {
		export function FromIndex(Index: number) {
			return new Vector3(Index % 16, math.floor((Index % 256) / 16), math.floor(Index / 256)) as BlockPos;
		}

		export function FromIndexS(Index: number) {
			return new Vector3(Index & 15, (Index >> 4) & 15, (Index >> 8) & 15) as BlockPos;
		}

		export function ToIndex(Vector: Vector3) {
			return Vector.z * 256 + Vector.y * 16 + Vector.x;
		}

		export function ToIndexS(Vector: BlockPos) {
			return (Vector.z << 8) | (Vector.y << 4) | Vector.x;
		}

		export function ToKey(Position: Vector3) {
			return new Vector3(
				Position.x >= 0 ? Position.x >> 4 : -(-(Position.x + 1) >> 4) - 1,
				Position.y >= 0 ? Position.y >> 4 : -(-(Position.y + 1) >> 4) - 1,
				Position.z >= 0 ? Position.z >> 4 : -(-(Position.z + 1) >> 4) - 1,
			) as ChunkPos;
		}

		export function FromKey(ChunkKey: ChunkPos) {
			return ChunkKey.mul(16);
		}

		export function GetAdjacent<T extends Vector3>(Position: T) {
			return [
				Position.add(Vector3.up),
				Position.add(Vector3.down),
				Position.add(Vector3.forward),
				Position.add(Vector3.right),
				Position.add(Vector3.back),
				Position.add(Vector3.left),
			] as T[];
		}
	}

	export function SetToArray<T extends defined>(Input: Set<T>) {
		const Output = new Array<T>();
		for (const Value of Input) Output.push(Value);

		return Output;
	}
}

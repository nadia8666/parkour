import { deepCopy as DeepCopy } from "@Easy/Core/Shared/Util/ObjectUtils";

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
		const Keys: A[] = []
		const Values: B[] = []

		for (const i of $range(0, Input.Keys.Count)) {
			Keys[i] = Input.Keys.ElementAt(i)
		}

		for (const i of $range(0, Input.Values.Count)) {
			Values[i] = Input.Values.ElementAt(i)
		}

		const KVPairs = new Map<A,B>()
		for (const [Index, Key] of pairs(Keys)) {
			KVPairs.set(Key, Values[Index])
		}

		return KVPairs
	}
}

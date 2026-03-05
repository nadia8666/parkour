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
}

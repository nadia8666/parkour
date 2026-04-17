import type { Resource } from "Code/Shared/Types";

export class Identifier {
	constructor(
		public Namespace: string,
		public Path: string,
	) {}

	public static Of(Namespace: string, Path: string) {
		return new Identifier(Namespace, Path);
	}

	public static Parse(Target: string) {
		const [Namespace, Path] = Target.split(":");
		return new Identifier(Namespace, Path);
	}

	public IsEquals(Other: Identifier | string) {
		return this.AsResource() === (Other instanceof Identifier ? Other.AsResource() : Other);
	}

	public AsResource() {
		return `${this.Namespace}:${this.Path}` as Resource;
	}
}

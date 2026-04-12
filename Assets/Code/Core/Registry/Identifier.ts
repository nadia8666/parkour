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
		return this.AsString() === (Other instanceof Identifier ? Other.AsString() : Other);
	}

	public AsString() {
		return `${this.Namespace}:${this.Path}`;
	}
}

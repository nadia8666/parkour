export class Identifier {
	constructor(
		public Namespace: string,
		public Path: string,
	) {}

	public static Of(Namespace: string, Path: string) {
		return new Identifier(Namespace, Path);
	}
}

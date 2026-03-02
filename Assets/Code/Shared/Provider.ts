export class Provider<T, U extends unknown | undefined> {
	constructor(private Executor: (Arg1: U) => T) {}
	private CachedValue = new Map<unknown, T>();

	public Get(Arg1?: U) {
		return this.CachedValue.getOrInsert(
			Arg1 === undefined ? -1 : Arg1,
			new Promise<T>((Resolve) => {
				Resolve(this.Executor(Arg1 as U));
			}).expect(),
		);
	}
}

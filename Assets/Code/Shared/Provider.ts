export class Provider<ReturnValue, Args extends unknown | undefined> {
	constructor(private Executor: (Arg1: Args) => ReturnValue) {}
	private CachedValue = new Map<unknown, ReturnValue>();

	public Get(Arg1?: Args) {
		return this.CachedValue.getOrInsertComputed(Arg1 === undefined ? -1 : Arg1, () =>
			new Promise<ReturnValue>((Resolve) => {
				Resolve(this.Executor(Arg1 as Args));
			}).expect(),
		);
	}
}

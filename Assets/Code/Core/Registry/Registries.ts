import { Identifier } from "./Identifier";

export class Registry<T> {
	// biome-ignore lint/suspicious/noConfusingVoidType: <not confusing>
	private Connections = new Map<Identifier, Set<(Object: T) => void | boolean>>();
	public Instances = new Map<Identifier, T>();

	constructor(public Namespace: string) {}

	public Register(Target: T, ID: string) {
		const Container = this.Connections.get(new Identifier(this.Namespace, ID));
		if (Container) for (const [Callback] of pairs(Container)) if (Callback(Target)) return Target;

		this.Instances.set(new Identifier(this.Namespace, ID), Target);

		return Target;
	}

	public OnRegister(ID: string, Callback: (Object: T) => undefined | boolean) {
		this.Connections.getOrInsertComputed(new Identifier(this.Namespace, ID), () => new Set()).add(Callback);
	}
}

import Blocks from "./Blocks";
import { Identifier } from "./Identifier";

export class Registry<T> {
	private Connections = new Map<Identifier, Set<(Object: T) => void | boolean>>();
	public Instances = new Map<Identifier, T>();

	constructor(public Namespace: string) {}

	public Register(Target: T, ID: string) {
		const Container = this.Connections.get(new Identifier(this.Namespace, ID));
		if (Container) for (const [Callback] of pairs(Container)) if (Callback(Target)) return Target;

		this.Instances.set(new Identifier(this.Namespace, ID), Target);

		return Target;
	}

	public OnRegister(ID: string, Callback: (Object: T) => void | boolean) {
		this.Connections.getOrInsert(new Identifier(this.Namespace, ID), new Set()).add(Callback);
	}
}

import Config from "Code/Client/Config";
import CFrame from "@inkyaker/CFrame/Code";
import type ClientComponent from "../../ClientComponent";
import type LadderComponent from "./LadderComponent";

export interface VirtualizedLadder {
	Object: GameObject;
	Component: LadderComponent;
}

export class Ladders {
	public Ladders: VirtualizedLadder[] = [];
	private ColliderMap = new Map<BoxCollider, VirtualizedLadder>();

	constructor() {
		for (const [_, Instance] of pairs(GameObject.FindGameObjectsWithTag("Ladder"))) {
			const Component = Instance.GetAirshipComponent<LadderComponent>();

			if (Component) {
				const Ladder: VirtualizedLadder = {
					Object: Instance,
					Component: Component,
				};

				this.ColliderMap.set(Ladder.Component.Collider, Ladder);
				this.Ladders.push(Ladder);
			}
		}
	}

	public FromCollider(Collider: BoxCollider) {
		return this.ColliderMap.get(Collider);
	}

	public GetTouchingLadder(Controller: ClientComponent) {
		const Origin = Controller.GetCFrame().Position;
		const Overlap = Physics.OverlapSphere(Origin, 0.65, Config.LadderLayer);

		if (Overlap.size() > 0) {
			Overlap.sort((a, b) => {
				return a.ClosestPointOnBounds(Origin).sub(Origin).magnitude < b.ClosestPointOnBounds(Origin).sub(Origin).magnitude;
			});

			return this.FromCollider(Overlap[0] as BoxCollider);
		}
	}

	public GetLadderInfo(Ladder: VirtualizedLadder) {
		const Scale = Ladder.Component.Collider.transform.lossyScale;
		const Size = Ladder.Component.Collider.size.mul(Scale);
		const Center = CFrame.FromTransform(Ladder.Component.Collider.transform);

		return $tuple(Center, Size);
	}
}

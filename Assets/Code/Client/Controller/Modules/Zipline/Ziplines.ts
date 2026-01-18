import { Asset } from "@Easy/Core/Shared/Asset";
import type ZiplineComponent from "./ZiplineComponent";

interface VirtualizedZipline {
	Object: GameObject;
	Component: ZiplineComponent;
}

const ZiplineTemplate = Asset.LoadAsset("Assets/Resources/Prefabs/World/Zipline/ZiplineRope.prefab");

export class Ziplines {
	public Ziplines: VirtualizedZipline[] = [];

	constructor() {
		for (const [_, Instance] of pairs(GameObject.FindGameObjectsWithTag("Zipline"))) {
			const Component = Instance.GetAirshipComponent<ZiplineComponent>();

			if (Component) {
				const Zipline: VirtualizedZipline = {
					Object: Instance,
					Component: Component,
				};

				this.Ziplines.push(Zipline);

				task.spawn(() => {
					const Center = Component.Point1.position.Lerp(Component.Point2.position, 0.5);
					const Rotation = Quaternion.LookRotation(Component.Point2.position.sub(Component.Point1.position).normalized).mul(Quaternion.Euler(90, 0, 0));
					const Length = Component.Point2.position.sub(Component.Point1.position).magnitude;
					const Rope = Instantiate(ZiplineTemplate, Center, Rotation, Instance.transform);
					Rope.transform.localScale = Rope.transform.localScale.WithY(Length / 2);
				});
			}
		}
	}

	public GetNearestZipline() {}
}

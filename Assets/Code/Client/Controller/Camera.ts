import { Airship } from "@Easy/Core/Shared/Airship";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import CFrame from "@inkyaker/CFrame/Code";
import UIController from "../UI/UIController";

const MouseSensitivity = new Vector2(1, 0.77).mul(math.rad(0.5));
const PitchMax = 85;

export class Camera {
	public Transform: Transform = GameObject.FindGameObjectWithTag("MainCamera").transform.parent;
	public TargetRotation: Quaternion = Quaternion.identity;

	constructor(public Rotation: { X: number; Y: number; Z: number }) {}

	public Update(DeltaTime: number, Source: Transform) {
		const RenderPos = Source.position;

		if (!UIController.Get().MenuOpen) {
			let CamDelta = Mouse.GetDelta();

			const Delta = CamDelta.mul(MouseSensitivity).mul(Airship.Input.GetMouseSensitivity() * 50);

			const PitchMod = -Delta.y;
			const YawMod = Delta.x;

			this.Rotation.X = math.clamp(this.Rotation.X + PitchMod, -PitchMax, PitchMax);
			this.Rotation.Y += YawMod;
		}

		const Rotation = Quaternion.Euler(0, this.Rotation.Y, 0).mul(Quaternion.Euler(this.Rotation.X, 0, 0));

		let FinalCFrame = new CFrame(RenderPos, Rotation);

		this.TargetRotation = Rotation;

		const Euler = Source.rotation.eulerAngles;
		const Current = Rotation.eulerAngles;

		this.Transform.rotation = Quaternion.Euler(Euler.x + Current.x, Current.y, Euler.z + Current.z);
		this.Transform.position = FinalCFrame.Position;
	}
}

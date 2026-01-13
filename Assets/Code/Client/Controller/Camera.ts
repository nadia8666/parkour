import { Airship } from "@Easy/Core/Shared/Airship";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import CFrame from "@inkyaker/CFrame/Code";
import { Settings } from "../Framework/SettingsController";

const MouseSensitivity = new Vector2(1, 0.77).mul(math.rad(0.5));
const PitchMax = 85;

export class Camera {
	public Transform: Transform = GameObject.FindGameObjectWithTag("MainCamera").transform.parent;
	public TargetRotation: Quaternion = Quaternion.identity;

	constructor(public Rotation: { X: number; Y: number; Z: number }) {}

	public Update(_DeltaTime: number, Source: CFrame) {
		const RenderPos = Source.Position;

		if (!Core().Client.UI.InputDisabled()) {
			let CamDelta = Mouse.GetDelta();

			const Delta = CamDelta.mul(MouseSensitivity)
				.mul(Settings.CameraSensitivityMouse)
				.mul(Airship.Input.GetMouseSensitivity() * 50);

			const PitchMod = -Delta.y;
			const YawMod = Delta.x;

			this.Rotation.X = math.clamp(this.Rotation.X + PitchMod, -PitchMax, PitchMax);
			this.Rotation.Y += YawMod;
		}

		const Rotation = Quaternion.Euler(0, this.Rotation.Y, 0).mul(Quaternion.Euler(this.Rotation.X, 0, 0));

		let FinalCFrame = new CFrame(RenderPos, Rotation);

		this.TargetRotation = Rotation;

		const Euler = Settings.CameraRotation ? Source.Rotation.eulerAngles : Vector3.zero;
		const Current = Rotation.eulerAngles;

		this.Transform.rotation = Quaternion.Euler(Euler.x + Current.x, Current.y, Euler.z + Current.z);
		this.Transform.position = FinalCFrame.Position;
	}
}

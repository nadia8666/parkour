import { Airship } from "@Easy/Core/Shared/Airship";
import { Mouse } from "@Easy/Core/Shared/UserInput";
import Core from "Code/Core/Core";
import CFrame from "@inkyaker/CFrame/Code";
import { Settings } from "../Framework/SettingsController";
import type ClientComponent from "./ClientComponent";

const MouseSensitivity = new Vector2(1, 0.77).mul(math.rad(0.5));
const PitchMax = 85;

export function WrapAngle(Angle: number) {
	return ((Angle + 540) % 360) - 180;
}

export class ClientCamera {
	public Transform: Transform = GameObject.FindGameObjectWithTag("MainCamera").transform.parent;
	public TargetRotation: Quaternion = Quaternion.identity;

	constructor(public Rotation: { X: number; Y: number; Z: number }) {}

	public Update(_DeltaTime: number, Controller: ClientComponent, Source: CFrame, RawSource: CFrame, FOV: number) {
		const RenderPos = Source.Position;

		if (!Core().Client.UI.InputDisabledFromMenu() && !Core().Client.UI.MenuOpen) {
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

		const Euler = Source.Rotation.eulerAngles;
		const Current = Rotation.eulerAngles;

		const RealYOffset = WrapAngle(Controller.Animator.gameObject.transform.eulerAngles.y) - WrapAngle(RawSource.Rotation.eulerAngles.y);

		this.Transform.rotation = Settings.CameraRotation ? Quaternion.Euler(Euler.x + Current.x, RealYOffset + Current.y, Euler.z + Current.z) : Rotation;
		this.Transform.position = FinalCFrame.Position;

		Camera.main.fieldOfView = FOV;
	}
}

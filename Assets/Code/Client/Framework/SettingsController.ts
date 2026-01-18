import { Airship } from "@Easy/Core/Shared/Airship";

export const Settings = {
	CameraRotation: true,

	HoldWallclimb: true,
	HoldWallrun: false,

	CameraSensitivityMouse: 1,
	FOV: 100,
	CameraRotationLerp: 15,
};

export default class SettingsController extends AirshipSingleton {
	@Client()
	override Start() {
		this.AddBool("CameraRotation", "Camera Rotation");

		this.AddBool("HoldWallclimb", "Hold to Wallclimb");
		this.AddBool("HoldWallrun", "Hold to Wallrun");

		this.AddSlider("CameraSensitivityMouse", "Mouse Camera Sens.", [0, 3], 0.01);
		this.AddSlider("CameraRotationLerp", "Camera Rotation Force", [1, 30], 0.5);
		this.AddSlider("FOV", "Field of View", [60, 120], 0.5);
	}

	public AddBool(Key: ExtractKeys<typeof Settings, boolean>, DisplayName: string) {
		Airship.Settings.AddToggle(DisplayName, Settings[Key]);
		Airship.Settings.ObserveToggle(DisplayName, (Value) => (Settings[Key] = Value));
	}

	public AddSlider(Key: ExtractKeys<typeof Settings, number>, DisplayName: string, MinMax: [number, number], Increment: number) {
		Airship.Settings.AddSlider(DisplayName, Settings[Key], MinMax[0], MinMax[1], Increment);
		Airship.Settings.ObserveSlider(DisplayName, (Value) => (Settings[Key] = Value));
	}
}
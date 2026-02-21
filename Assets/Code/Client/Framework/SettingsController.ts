import { Airship } from "@Easy/Core/Shared/Airship";
import { Game } from "@Easy/Core/Shared/Game";
import { Network } from "Code/Shared/Network";

export const Settings = {
	CameraRotation: true,

	StepUpEnabled: false,

	HoldWallclimb: true,
	HoldWallrun: false,

	CameraSensitivityMouse: 1,
	FOV: 100,
	CameraRotationLerp: 15,

	RenderDistance: Game.IsEditor() ? 4 : 16,
};
export type Settings = typeof Settings;

export default class SettingsController extends AirshipSingleton {
	@Client()
	override Start() {
		this.AddBool("CameraRotation", "Camera Rotation");

		this.AddBool("StepUpEnabled", "Step Up Enabled");

		this.AddBool("HoldWallclimb", "Hold to Wallclimb");
		this.AddBool("HoldWallrun", "Hold to Wallrun");

		this.AddSlider("CameraSensitivityMouse", "Mouse Camera Sens.", [0, 3], 0.01);
		this.AddSlider("CameraRotationLerp", "Camera Rotation Force", [1, 30], 0.5);
		this.AddSlider("FOV", "Field of View", [60, 120], 0.5);

		this.AddSlider("RenderDistance", "Render Distance", [2, 256], 1);
	}

	public AddBool(Key: ExtractKeys<typeof Settings, boolean>, DisplayName: string) {
		Airship.Settings.AddToggle(DisplayName, Settings[Key]);
		if (!Game.IsEditor()) {
			let LastUpdated = 0;
			Airship.Settings.ObserveToggle(DisplayName, (Value) => {
				Settings[Key] = Value;

				const Tick = os.clock();
				LastUpdated = Tick;

				task.delay(1, () => {
					if (LastUpdated === Tick) Network.Data.UpdateSetting.client.FireServer(Key, Value);
				});
			});

			Network.Data.UpdateSetting.client.FireServer(Key, Settings[Key]);
		}
	}

	public AddSlider(Key: ExtractKeys<typeof Settings, number>, DisplayName: string, MinMax: [number, number], Increment: number) {
		Airship.Settings.AddSlider(DisplayName, Settings[Key], MinMax[0], MinMax[1], Increment);
		if (!Game.IsEditor()) {
			let LastUpdated = 0;
			Airship.Settings.ObserveSlider(DisplayName, (Value) => {
				Settings[Key] = Value;

				const Tick = os.clock();
				LastUpdated = Tick;

				task.delay(1, () => {
					if (LastUpdated === Tick) Network.Data.UpdateSetting.client.FireServer(Key, Value);
				});
			});

			Network.Data.UpdateSetting.client.FireServer(Key, Settings[Key]);
		}
	}
}

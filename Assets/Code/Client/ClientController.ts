import { Airship } from "@Easy/Core/Shared/Airship";
import AnimationController from "./Controller/Animation/AnimationController";
import type GearController from "./Controller/Gear/GearController";
import type DataController from "./Framework/DataController";
import type SettingsController from "./Framework/SettingsController";
import type DragController from "./UI/Drag/DragController";
import type UIController from "./UI/UIController";

export default class ClientController extends AirshipSingleton {
	public Data: DataController;
	public Gear: GearController;
	public UI: UIController;
	public Animation: AnimationController = AnimationController.Get();
	public Drag: DragController;
	public Settings: SettingsController;

	@Client()
	public Start() {
		Airship.Camera.SetEnabled(false);
	}
}

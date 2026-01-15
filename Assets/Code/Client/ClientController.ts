import { Airship } from "@Easy/Core/Shared/Airship";
import type AnimationController from "./Controller/Animation/AnimationController";
import type ClientComponent from "./Controller/ClientComponent";
import type GearController from "./Controller/Gear/GearController";
import { TimeTrials } from "./Controller/Modules/TimeTrials/TimeTrials";
import type SoundController from "./Controller/SoundController";
import type DataController from "./Framework/DataController";
import type SettingsController from "./Framework/SettingsController";
import type DragController from "./UI/Drag/DragController";
import type UIController from "./UI/UIController";

export default class ClientController extends AirshipSingleton {
	public Data: DataController;
	public Gear: GearController;
	public UI: UIController;
	public Animation: AnimationController;
	public Drag: DragController;
	public Settings: SettingsController;
	public Sound: SoundController;

	@NonSerialized() public Actor: ClientComponent | undefined;
	@NonSerialized() public Objective = {
		TimeTrials: new TimeTrials(),
	};

	@Client()
	public Start() {
		Airship.Camera.SetEnabled(false);
	}
}

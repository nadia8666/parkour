import { Airship } from "@Easy/Core/Shared/Airship";

export default class FrameworkController extends AirshipSingleton {
	@Client()
	public Start() {
		Airship.Camera.SetEnabled(false);
	}
}

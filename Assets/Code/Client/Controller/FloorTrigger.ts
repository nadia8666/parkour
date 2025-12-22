import { Signal } from "@Easy/Core/Shared/Util/Signal";

export default class FloorTrigger extends AirshipBehaviour {
	public Signal = new Signal<"Enter" | "Exit">();

	override OnTriggerEnter() {
		this.Signal.Fire("Enter");
	}

	override OnTriggerExit() {
		this.Signal.Fire("Exit");
	}
}

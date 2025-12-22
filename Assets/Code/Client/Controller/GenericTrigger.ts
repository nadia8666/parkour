export default class GenericTrigger extends AirshipBehaviour {
	public Touching: boolean = false;

	override OnTriggerEnter() {
		this.Touching = true;
	}

	override OnTriggerStay() {
		if (!this.Touching) this.Touching = true;
	}

	override OnTriggerExit() {
		this.Touching = false;
	}
}

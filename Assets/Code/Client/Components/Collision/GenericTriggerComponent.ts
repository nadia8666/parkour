export default class GenericTriggerComponent extends AirshipBehaviour {
	public Touching: boolean = false;

	@Client()
	override OnTriggerEnter() {
		this.Touching = true;
	}

	@Client()
	override OnTriggerStay() {
		if (!this.Touching) this.Touching = true;
	}

	@Client()
	override OnTriggerExit() {
		this.Touching = false;
	}
}

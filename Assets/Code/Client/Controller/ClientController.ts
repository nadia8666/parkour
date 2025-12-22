import { Keyboard } from "@Easy/Core/Shared/UserInput";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import { Gravity } from "../Framework/FrameworkController";
import type FloorTrigger from "./FloorTrigger";
import { MovesetBase } from "./Moveset/MovesetBase";

type ValidStates = "Airborne" | "Grounded";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientController extends AirshipBehaviour {
	public Rigidbody: Rigidbody;
	public Bin = new Bin();
	public State: ValidStates = "Airborne";

	@Header("Colliders")
	public FloorTrigger: FloorTrigger;

	@Header("Curves")
	public AccelerationCurve: AnimationCurve;

	public Moveset = {
		Base: new MovesetBase(),
	};

	override FixedUpdate() {
		this.UpdateState();
	}

	override OnEnable() {
		this.Bin.Add(
			this.FloorTrigger.Signal.Connect((Mode) => {
				if (Mode === "Enter" && this.State === "Airborne") {
					this.State = "Grounded";
				} else if (Mode === "Exit" && this.State === "Grounded") {
					this.State = "Airborne";
				}
			}),
		);
	}

	override OnDisable() {
		this.Bin.Clean();
	}

	public UpdateState() {
		const YRotation = Camera.main.transform.rotation.eulerAngles.y;
		this.Rigidbody.rotation = Quaternion.FromToRotation(
			Quaternion.Euler(0, this.Rigidbody.rotation.eulerAngles.y, 0).mul(Vector3.forward),
			Quaternion.Euler(0, YRotation, 0).mul(Vector3.forward),
		).mul(this.Rigidbody.rotation);

		this.Moveset.Base.Walk(this);

		switch (this.State) {
			case "Grounded":
				this.Moveset.Base.Jump(this);

				break;
			case "Airborne":
				this.Rigidbody.linearVelocity = this.Rigidbody.linearVelocity.add(Gravity);

				this.Moveset.Base.JumpHold(this);

				break;
		}
	}
}

import { Bin } from "@Easy/Core/Shared/Util/Bin";
import CFrame from "@inkyaker/CFrame/Code";
import { Gravity } from "../Framework/FrameworkController";
import UIController from "../Framework/UIController";
import type GenericTrigger from "./GenericTrigger";
import { MovesetBase } from "./Moveset/MovesetBase";

export type ValidStates = "Airborne" | "Grounded" | "Wallclimb" | "Wallrun" | "LedgeGrab";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientController extends AirshipBehaviour {
	public Rigidbody: Rigidbody;
	public Bin = new Bin();
	public State: ValidStates = "Airborne";

	@Header("Colliders")
	public BodyCollider: Collider;
	public Floor: GenericTrigger;
	public Wallclimb: GenericTrigger;
	public WallrunL: GenericTrigger;
	public WallrunR: GenericTrigger;
	public LedgeGrab: GenericTrigger;

	@Header("Curves")
	public AccelerationCurve: AnimationCurve;

	public Moveset = {
		Base: new MovesetBase(),
	};

	override FixedUpdate(FixedDT: number) {
		this.Step(FixedDT);
	}

	override OnEnable() {
		this.Moveset.Base.BindInputs();
	}

	override OnDisable() {
		this.Bin.Clean();
		this.Moveset.Base.Bin.Clean();
	}

	public CameraRotationToCharacter() {
		const YRotation = Camera.main.transform.rotation.eulerAngles.y;
		this.Rigidbody.rotation = Quaternion.FromToRotation(
			Quaternion.Euler(0, this.Rigidbody.rotation.eulerAngles.y, 0).mul(Vector3.forward),
			Quaternion.Euler(0, YRotation, 0).mul(Vector3.forward),
		).mul(this.Rigidbody.rotation);
	}

	public GetCFrame() {
		return new CFrame(this.Rigidbody.worldCenterOfMass, this.Rigidbody.rotation);
	}

	public Step(FixedDT: number) {
		UIController.Get().State.text = this.State;
		UIController.Get().Speed.text = `${this.Rigidbody.linearVelocity}`;

		this.Moveset.Base.UpdateInputs(this);

		switch (this.State) {
			case "Grounded":
				this.CameraRotationToCharacter();

				if (!this.Floor.Touching) {
					this.State = "Airborne";
				}

				this.Moveset.Base.Walk(this);

				break;
			case "Airborne":
				this.CameraRotationToCharacter();

				this.Rigidbody.linearVelocity = this.Rigidbody.linearVelocity.add(Gravity);
				this.Moveset.Base.JumpHold(this, FixedDT);

				this.Moveset.Base.Walk(this);

				if (this.Floor.Touching && this.Rigidbody.linearVelocity.y <= 0.1) {
					this.State = "Grounded";
				}

				this.Moveset.Base.TryLedgeGrab(this);

				break;
			case "Wallclimb":
				this.Moveset.Base.WallclimbUpdate(this, FixedDT);

				if (this.Floor.Touching) {
					this.State = "Grounded";
				}

				break;
			case "Wallrun":
				this.Moveset.Base.WallrunUpdate(this, FixedDT);

				if (this.Floor.Touching) {
					this.State = "Grounded";
				}

				break;
		}
	}
}

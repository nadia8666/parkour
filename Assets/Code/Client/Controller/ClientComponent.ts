import { Airship } from "@Easy/Core/Shared/Airship";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import CFrame from "@inkyaker/CFrame/Code";
import type GenericTrigger from "../Components/Collision/GenericTriggerComponent";
import Config from "../Config";
import AnimationController from "./Animation/AnimationController";
import type ViewmodelComponent from "./Animation/ViewmodelComponent";
import GearController from "./Gear/GearController";
import { LedgeGrabType, MovesetBase } from "./Moveset/MovesetBase";

export type ValidStates = "Airborne" | "Grounded" | "Wallclimb" | "Wallrun" | "LedgeGrab";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientComponent extends AirshipBehaviour {
	public Rigidbody: Rigidbody;
	public Bin = new Bin();
	public State: ValidStates = "Airborne";

	@Header("Colliders")
	public BodyCollider: CapsuleCollider;
	public Floor: GenericTrigger;
	public Wallclimb: GenericTrigger;
	public WallrunL: GenericTrigger;
	public WallrunR: GenericTrigger;
	public LedgeGrabG: GenericTrigger;
	public LedgeGrabA: GenericTrigger;

	@Header("Curves")
	public AccelerationCurve: AnimationCurve;

	public Gear = new GearController();

	public Moveset = {
		Base: new MovesetBase(),
	};

	private AnimationController = AnimationController.Get();
	private ViewmodelController: ViewmodelComponent;

	public AirborneTime = 0;

	@Client()
	override FixedUpdate(FixedDT: number) {
		this.Step(FixedDT);
	}

	@Client()
	override OnEnable() {
		this.Moveset.Base.BindInputs();

		while (!Airship.Characters.viewmodel) task.wait();

		this.ViewmodelController = Airship.Characters.viewmodel.viewmodelGo.GetAirshipComponent<ViewmodelComponent>() as ViewmodelComponent;
		this.ViewmodelController.AnimationController = this.AnimationController;
	}

	@Client()
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

	public GetCFrame(Raw?: boolean) {
		return new CFrame(Raw ? this.transform.position : this.Rigidbody.worldCenterOfMass, this.Rigidbody.rotation);
	}

	public UpdateUI() {}

	public Step(FixedDT: number) {
		this.Moveset.Base.UpdateInputs(this);

		switch (this.State) {
			case "Grounded":
				this.CameraRotationToCharacter();

				if (!this.Floor.Touching) {
					this.State = "Airborne";
				}

				this.Moveset.Base.Walk(this);

				this.AnimationController.Current = (this.Rigidbody.linearVelocity.magnitude > 2 && "VM_Run") || "VM_Idle";
				this.AnimationController.Speed = this.Rigidbody.linearVelocity.WithY(0).magnitude / 8;

				break;
			case "Airborne":
				this.AirborneTime += FixedDT;
				this.CameraRotationToCharacter();

				this.Rigidbody.linearVelocity = this.Rigidbody.linearVelocity.add(Config.Gravity);
				this.Moveset.Base.JumpHold(this, FixedDT);

				this.Moveset.Base.Walk(this);
				this.Moveset.Base.TryLedgeGrab(this);

				if (this.Floor.Touching && this.Rigidbody.linearVelocity.y <= 0) {
					this.Land();
				}

				if (!this.AnimationController.Current.find("Jump")[0] && this.AirborneTime >= Config.JumpCoyoteTime && this.AnimationController.Current !== "VM_Idle") {
					this.AnimationController.Current = "VM_Idle";
				}

				break;
			case "Wallclimb":
				this.Moveset.Base.WallclimbUpdate(this, FixedDT);

				this.AnimationController.Current = "VM_Wallclimb";

				if (this.Floor.Touching) {
					this.Land();
				}

				break;
			case "Wallrun":
				this.Moveset.Base.WallrunUpdate(this, FixedDT);

				this.AnimationController.Current = `VM_Wallrun${this.Moveset.Base.WallrunTarget === this.WallrunL ? "L" : "R"}`;

				if (this.Floor.Touching) {
					this.Land();
				}

				break;
			case "LedgeGrab":
				this.AnimationController.Current = this.Moveset.Base.LedgeGrabType === LedgeGrabType.Jump ? "VM_LedgeGrab" : "VM_Vault";

				break;
		}

		this.UpdateUI();
	}

	public LateUpdate(DeltaTime: number) {
		this.ViewmodelController.Animate(DeltaTime);

		const Rotation = this.GetCFrame().Rotation;
		this.ViewmodelController.gameObject.transform.rotation = Rotation;
		this.ViewmodelController.gameObject.transform.position = this.transform.position.add(Rotation.mul(Vector3.forward.mul(0.1)));
	}

	public Land() {
		this.State = "Grounded";
		this.AirborneTime = 0;
		this.Gear.ResetAmmo();
	}
}

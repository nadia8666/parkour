import { Game } from "@Easy/Core/Shared/Game";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import CFrame from "@inkyaker/CFrame/Code";
import type GenericTrigger from "../Components/Collision/GenericTriggerComponent";
import Config from "../Config";
import AnimationController, { type ValidAnimation } from "./Animation/AnimationController";
import type ViewmodelComponent from "./Animation/ViewmodelComponent";
import { Camera as CameraController } from "./Camera";
import GearController from "./Gear/GearController";
import { LedgeGrabType, MovesetBase } from "./Moveset/MovesetBase";

export type ValidStates = "Airborne" | "Grounded" | "Wallclimb" | "Wallrun" | "LedgeGrab" | "Slide";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientComponent extends AirshipBehaviour {
	public Rigidbody: Rigidbody;
	public Bin = new Bin();
	public State: ValidStates = "Airborne";
	public Camera = new CameraController({
		X: this.transform.rotation.eulerAngles.x,
		Y: this.transform.rotation.eulerAngles.y,
		Z: this.transform.rotation.eulerAngles.z,
	});

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
	public RunAnimationCurve: AnimationCurve;

	public Gear = GearController.Get();

	public Moveset = {
		Base: new MovesetBase(),
	};

	private AnimationController = AnimationController.Get();
	private ViewmodelController: ViewmodelComponent;

	public MatchCameraStates: ValidStates[] = ["Airborne", "Grounded"];
	public FallIgnoreAnimations: ValidAnimation[] = ["VM_JumpL", "VM_JumpR", "VM_JumpLWallrun", "VM_JumpRWallrun", "VM_LongJump", "VM_Coil"];
	public AirborneTime = 0;

	public Identity: NetworkIdentity;

	@Client()
	override OnEnable() {
		if ($CLIENT && !$SERVER) {
			const Character = Game.localPlayer.WaitForCharacter();

			if (Character.gameObject !== this.gameObject) {
				this.enabled = false;
				return;
			}
		}

		this.Moveset.Base.BindInputs();

		this.ViewmodelController = this.AnimationController.gameObject.GetAirshipComponent<ViewmodelComponent>() as ViewmodelComponent;
		this.ViewmodelController.AnimationController = this.AnimationController;
	}

	@Client()
	override OnDisable() {
		this.Bin.Clean();
		this.Moveset.Base.Bin.Clean();
	}

	@Client()
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

	@Client()
	public UpdateUI() {}

	@Client()
	public Step(FixedDT: number) {
		this.Moveset.Base.UpdateInputs(this);
		this.Moveset.Base.Step(this, FixedDT);

		if (this.MatchCameraStates.includes(this.State)) this.CameraRotationToCharacter();

		switch (this.State) {
			case "Grounded":
				if (!this.Floor.Touching) {
					this.State = "Airborne";
					this.Moveset.Base.EndDash();
				}

				this.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
				this.Moveset.Base.AccelerateToInput(this, FixedDT);

				this.AnimationController.Current = (this.Rigidbody.linearVelocity.magnitude > 0.03 && "VM_Run") || "VM_Idle";
				this.AnimationController.Speed = this.AnimationController.Current === "VM_Idle" ? 1 : this.RunAnimationCurve.Evaluate(this.Rigidbody.linearVelocity.magnitude);

				break;
			case "Slide":
				this.Moveset.Base.SlideStep(this, FixedDT);

				break;
			case "Airborne":
				this.AirborneTime += FixedDT;

				this.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
				this.Moveset.Base.JumpHold(this, FixedDT);

				this.Moveset.Base.AccelerateToInput(this, FixedDT);
				this.Moveset.Base.TryLedgeGrab(this);

				if (this.Floor.Touching && this.Rigidbody.linearVelocity.y <= 0) {
					this.Land();
				}

				if (!this.FallIgnoreAnimations.includes(this.AnimationController.Current) && this.AirborneTime >= Config.JumpCoyoteTime && this.AnimationController.Current !== "VM_Fall") {
					this.AnimationController.Current = "VM_Fall";
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

	@Client()
	public LateUpdate(DeltaTime: number) {
		this.UpdateViewmodel();
		this.Camera.Update(DeltaTime, this.ViewmodelController.HeadTransform);

		if (this.MatchCameraStates.includes(this.State)) this.CameraRotationToCharacter();

		this.ViewmodelController.Animate(DeltaTime);
	}

	@Client()
	public Update() {}

	@Client()
	override FixedUpdate(FixedDT: number) {
		this.Step(FixedDT);
	}

	@Client()
	public UpdateViewmodel() {
		const Rotation = this.GetCFrame().Rotation;
		this.ViewmodelController.gameObject.transform.rotation = Rotation;
		this.ViewmodelController.gameObject.transform.position = this.transform.position.add(Rotation.mul(Vector3.forward.mul(0.1)));
	}

	public Land() {
		this.State = "Grounded";
		this.AirborneTime = 0;
		this.Gear.ResetAmmo();

		print(this.Rigidbody.linearVelocity.y);

		let DamagingFall = false;

		if (this.Moveset.Base.DashActive()) {
			if (DamagingFall) {
				// try roll!
				DamagingFall = false;
			} else {
				this.State = "Slide";
			}
		}

		if (DamagingFall) {
			// calc dmg and hurt Self
		}

		this.Moveset.Base.EndDash();
	}
}

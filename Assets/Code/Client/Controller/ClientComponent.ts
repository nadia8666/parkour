import { Game } from "@Easy/Core/Shared/Game";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import { Network } from "Code/Shared/Network";
import CFrame from "@inkyaker/CFrame/Code";
import type GenericTrigger from "../Components/Collision/GenericTriggerComponent";
import Config from "../Config";
import type { ValidAnimation } from "./Animation/AnimationController";
import type ViewmodelComponent from "./Animation/ViewmodelComponent";
import { Camera as CameraController } from "./Camera";
import { CollisionLayer, MovesetBase } from "./Moveset/MovesetBase";

export type ValidStates = "Airborne" | "Grounded" | "Wallclimb" | "Wallrun" | "LedgeGrab" | "Slide";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientComponent extends AirshipBehaviour {
	@Header("Main")
	public Rigidbody: Rigidbody;
	public Identity: NetworkIdentity;

	@Header("Colliders")
	public BodyCollider: CapsuleCollider;
	public Floor: GenericTrigger;
	public Wallclimb: GenericTrigger;
	public WallrunL: GenericTrigger;
	public WallrunR: GenericTrigger;
	public LedgeGrabFail: GenericTrigger;

	@Header("Curves")
	public AccelerationCurve: AnimationCurve;
	public RunAnimationCurve: AnimationCurve;
	public WallclimbProgressionCurve: AnimationCurve;

	@Header("Rendering")
	public AccessoryBuilder: AccessoryBuilder;

	// Misc
	public Bin = new Bin();

	// Control
	@NonSerialized() public Gear = Core().Client.Gear;
	public Moveset = {
		Base: new MovesetBase(),
	};
	public Camera = new CameraController({
		X: this.transform.rotation.eulerAngles.x,
		Y: this.transform.rotation.eulerAngles.y,
		Z: this.transform.rotation.eulerAngles.z,
	});

	// Animation
	private AnimationController = Core().Client.Animation;
	@NonSerialized() public Animator: ViewmodelComponent;

	// Physics
	@NonSerialized() public AirborneTime = 0;
	@NonSerialized() public Momentum = 0;
	@NonSerialized() public LastFallSpeed = 0;

	// States
	@NonSerialized() public State: ValidStates = "Airborne";
	public MatchCameraStates: ValidStates[] = ["Airborne", "Grounded"];
	public FallIgnoreAnimations: ValidAnimation[] = [
		"VM_JumpL",
		"VM_JumpR",
		"VM_JumpLWallrun",
		"VM_JumpRWallrun",
		"VM_LongJump",
		"VM_Coil",
		"VM_Fall",
		"VM_LedgeGrab",
		"VM_VaultStart",
		"VM_VaultLaunch",
		"VM_VaultEnd",
	];

	// Main
	@Client()
	override OnEnable() {
		if ($CLIENT && !$SERVER) {
			const Character = Game.localPlayer.WaitForCharacter();

			if (Character.gameObject !== this.gameObject) {
				this.enabled = false;
				return;
			}
		}

		this.Animator = this.AnimationController.gameObject.GetAirshipComponent<ViewmodelComponent>() as ViewmodelComponent;
		this.Animator.AnimationController = this.AnimationController;

		this.Moveset.Base.BindInputs(this);

		this.AccessoryBuilder.OnMeshCombined.Connect(() => this.ReloadShadows());
		this.AccessoryBuilder.OnAccessoryAdded.Connect(() => this.ReloadShadows());
		this.AccessoryBuilder.OnAccessoryRemoved.Connect(() => this.ReloadShadows());
		this.ReloadShadows();
	}

	public ReloadShadows() {
		const MainRenderer = this.AccessoryBuilder.GetCombinedSkinnedMesh();
		const AccessoryRenderers = this.AccessoryBuilder.GetAllAccessoryRenderers();

		MainRenderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
		for (const [_, Renderer] of pairs(AccessoryRenderers)) {
			Renderer.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
		}
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

	public UpdateUI() {
		Core().Client.UI.UpdateMomentumBar(math.clamp01(this.Momentum / 30));
		this.Gear.UpdateUI();
	}

	public Step(FixedDT: number) {
		this.Moveset.Base.UpdateInputs(this);
		this.Moveset.Base.StepMoveset(this, FixedDT);

		if (this.MatchCameraStates.includes(this.State)) this.CameraRotationToCharacter();

		if (this.GetCFrame().Position.y <= 0) this.DamageSelf(999);

		switch (this.State) {
			case "Grounded":
				if (!this.Floor.Touching) {
					this.State = "Airborne";
					this.Moveset.Base.EndDash();
					this.LastFallSpeed = 0;
				}

				this.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
				this.Moveset.Base.AccelerateToInput(this, FixedDT);

				if (!["VM_VaultStart", "VM_VaultLaunch", "VM_VaultEnd", "VM_LedgeGrab"].includes(this.AnimationController.Current)) {
					this.AnimationController.Current = (this.Rigidbody.linearVelocity.magnitude > 0.03 && "VM_Run") || "VM_Idle";
				}
				this.AnimationController.Speed = this.AnimationController.Current === "VM_Run" ? this.RunAnimationCurve.Evaluate(this.Rigidbody.linearVelocity.magnitude) : 1;

				break;
			case "Slide":
				this.Moveset.Base.StepSlide(this, FixedDT);

				break;
			case "Airborne":
				this.AirborneTime += FixedDT;

				this.Rigidbody.AddForce(this.Moveset.Base.GetJumpGravity(), ForceMode.Acceleration);
				this.Moveset.Base.StepJump(this, FixedDT);

				if (this.Rigidbody.linearVelocity.y < 0) this.LastFallSpeed = math.max(this.LastFallSpeed, -this.Rigidbody.linearVelocity.y);

				this.Moveset.Base.AccelerateToInput(this, FixedDT);

				if (this.Floor.Touching && this.Rigidbody.linearVelocity.y <= 0) {
					this.Land();
				}

				if (!this.FallIgnoreAnimations.includes(this.AnimationController.Current) && this.AirborneTime >= Config.JumpCoyoteTime) {
					this.AnimationController.Current = "VM_Fall";
				}

				break;
			case "Wallclimb":
				if (this.Moveset.Base.StepWallclimb(this, FixedDT)) {
					this.AnimationController.Current = "VM_Wallclimb";
				}

				break;
			case "Wallrun":
				if (this.Moveset.Base.StepWallrun(this, FixedDT)) this.AnimationController.Current = `VM_Wallrun${this.Moveset.Base.WallrunTarget === this.WallrunL ? "L" : "R"}`;

				break;
			case "LedgeGrab":
				break;
		}

		this.UpdateUI();
	}

	@Client()
	public LateUpdate(DeltaTime: number) {
		this.UpdateViewmodel();
		let Target = CFrame.FromTransform(this.Animator.HeadTransform);

		if (this.State === "Slide") {
			Target = new CFrame(Target.Position, Target.Rotation.mul(Quaternion.Euler(-Target.Rotation.eulerAngles.x, 0, 0)));
		}

		this.Camera.Update(DeltaTime, Target);

		if (this.MatchCameraStates.includes(this.State)) this.CameraRotationToCharacter();

		this.Animator.Animate(DeltaTime);
	}

	@Client()
	public Update() {}

	@Client()
	override FixedUpdate(FixedDT: number) {
		this.Step(FixedDT);
	}

	public UpdateViewmodel() {
		const Rotation = this.GetCFrame().Rotation;

		let TargetRotation = Quaternion.LookRotation(Rotation.mul(Vector3.forward), Vector3.up);
		if (this.State === "Slide") {
			const [Hit, _, Normal] = Physics.Raycast(this.GetCFrame().Position, new Vector3(0, -1, 0), 2, CollisionLayer);
			if (Hit) {
				TargetRotation = Quaternion.FromToRotation(Vector3.up, Normal).mul(TargetRotation);
			}
		}

		this.Animator.gameObject.transform.rotation = TargetRotation;
		this.Animator.gameObject.transform.position = this.transform.position.add(Rotation.mul(Vector3.forward.mul(0.1)));
	}

	public Land() {
		this.State = "Grounded";
		this.AirborneTime = 0;
		this.Gear.ResetAmmo();

		let Damage = this.LastFallSpeed - Config.FallDamageThreshold;

		if (Damage > 0) {
			Damage *= Config.FallDamageMultiplier;
		}

		if (this.Moveset.Base.DashActive()) {
			if (Damage > 0) {
				const CurrentDashTime = this.Moveset.Base.DashCharge;
				const TargetTime = math.max(0, Config.FallDamgeRollTime * (1 - math.clamp(Damage / Config.FallDamageMaxSurvivable, 0, 1)));

				if (CurrentDashTime <= TargetTime) {
					Damage = 0;
				}
			} else {
				this.Moveset.Base.StartSlide(this);
			}
		}

		if (Damage > 0) {
			this.DamageSelf(Damage);
		}

		this.Moveset.Base.EndDash();

		this.Momentum = this.Rigidbody.linearVelocity.WithY(0).magnitude;
	}

	public DamageSelf(Damage: number) {
		Network.Effect.DamageSelf.client.FireServer(Damage);
	}

	public ResetLastFallSpeed() {
		this.LastFallSpeed = 0;
	}

	public GetVelocity() {
		return this.Rigidbody.linearVelocity;
	}

	public SetVelocity(Velocity: Vector3) {
		this.Rigidbody.linearVelocity = Velocity;
		return Velocity;
	}
}

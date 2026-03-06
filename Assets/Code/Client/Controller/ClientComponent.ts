import { Game } from "@Easy/Core/Shared/Game";
import { Bin } from "@Easy/Core/Shared/Util/Bin";
import Core from "Code/Core/Core";
import ENV from "Code/Server/ENV";
import { Network } from "Code/Shared/Network";
import { Client } from "Code/Shared/Types";
import CFrame from "@inkyaker/CFrame/Code";
import type GenericTrigger from "../Components/Collision/GenericTriggerComponent";
import Config from "../Config";
import { Settings } from "../Framework/SettingsController";
import type WorldSingleton from "../Framework/WorldSingleton";
import type AnimationController from "./Animation/AnimationController";
import type { ValidAnimation } from "./Animation/AnimationController";
import type ViewmodelComponent from "./Animation/ViewmodelComponent";
import { ClientCamera as CameraController } from "./Camera";
import { Actions, ClientInput } from "./ClientInput";
import { ClientInteractions } from "./ClientInteractions";
import { ClientPhysics } from "./ClientPhysics";
import { ClientRenderer } from "./ClientRenderer";
import { ClientUI } from "./ClientUI";
import type GearController from "./Gear/GearController";
import { MovesetBase } from "./Moveset/Base";
import { MovesetGeneric } from "./Moveset/Generic";
import { MovesetGrappler } from "./Moveset/Grappler";
import { MovesetWorld } from "./Moveset/World";

@AirshipComponentMenu("Client/Controller/Physics Controller")
export default class ClientComponent extends AirshipBehaviour {
	// References
	@Header("Main")
	public Rigidbody: Rigidbody;
	public Identity: NetworkIdentity;
	public BlockCursorRef: GameObject;

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
	public FOVCurve: AnimationCurve;

	@Header("Rendering")
	public AccessoryBuilder: AccessoryBuilder;
	public Face: GameObject;
	public SkinnedMeshes: SkinnedMeshRenderer[];

	// Values
	private _LOADED = false;
	private CameraTarget = CFrame.identity;
	@NonSerialized() public Bin = new Bin();
	@NonSerialized() public FOV = 85;
	@NonSerialized() public LastPromptInteract = os.clock();

	// Values - Health
	@NonSerialized() public Health = 100;
	@NonSerialized() private _LastHealth = 100;
	@NonSerialized() public _LastHealthLowered = 0;
	@NonSerialized() public _LastHealthChanged = 0;

	// Animation
	@NonSerialized() public AnimationController: AnimationController;
	@NonSerialized() public Animator: ViewmodelComponent;

	// Physics
	@NonSerialized() public LastLanded = os.clock();
	@NonSerialized() public AirborneTime = 0;
	@NonSerialized() public Momentum = 0;
	@NonSerialized() public LastFallSpeed = 0;
	@NonSerialized() public VelocityLocked = false;

	// States
	@NonSerialized() public State: Client.ValidStates = "Airborne";
	@NonSerialized() public MatchCameraStates: Client.ValidStates[] = ["Airborne", "Grounded", "Fly"];
	@NonSerialized() public FallIgnoreAnimations: ValidAnimation[] = [
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

	// Control
	@NonSerialized() public Gear: GearController;
	@NonSerialized() public World: WorldSingleton;
	@NonSerialized() public Moveset = {
		Base: new MovesetBase(),
		Generic: new MovesetGeneric(),
		World: new MovesetWorld(),

		Grappler: new MovesetGrappler(),
	};
	@NonSerialized() public Camera = new CameraController({
		X: this.transform.rotation.eulerAngles.x,
		Y: this.transform.rotation.eulerAngles.y,
		Z: this.transform.rotation.eulerAngles.z,
	});
	@NonSerialized() public Input = new ClientInput(this);

	// Submodules
	@NonSerialized() public Physics = new ClientPhysics();
	@NonSerialized() public UI = new ClientUI(this);
	@NonSerialized() public Renderer = new ClientRenderer(this);
	@NonSerialized() public Interactions = new ClientInteractions(this);

	// Init
	override OnEnable() {
		if ($SERVER && !ENV.Shared) {
			this.gameObject.GetComponent<Rigidbody>()!.isKinematic = true;
			return;
		}

		if (!ENV.Shared) {
			const Character = Game.localPlayer.WaitForCharacter();

			if (Character.gameObject !== this.gameObject) {
				this.enabled = false;
				return;
			}
		}

		this.Gear = Core().Client.Gear;
		this.World = Core().World;

		this.AnimationController = Core().Client.Animation;
		while (!this.AnimationController.Component) {
			task.wait();
		}
		this.Animator = this.AnimationController.Component;

		this.Input.BindInputs();

		this.AccessoryBuilder.OnMeshCombined.Connect(() => this.Renderer.ReloadShadows());
		this.AccessoryBuilder.OnAccessoryAdded.Connect(() => this.Renderer.ReloadShadows());
		this.AccessoryBuilder.OnAccessoryRemoved.Connect(() => this.Renderer.ReloadShadows());
		this.Renderer.ReloadShadows();

		Core().Client.Actor = this;

		this._LOADED = true;
		Core().Client.UI.Loading.SetActive(false);
		this.FOV = this.FOVCurve.Evaluate(0) * Settings.FOV;
		this.Interactions.OnEnable();
	}

	@Client()
	override OnDisable() {
		Core().Client.Actor = undefined;

		this.Bin.Clean();
		this.Input.Bin.Clean();

		if (Core().Client.Objective.TimeTrials.IsActive()) {
		}
	}

	// Utility Functions
	public RotateCharacterToCamera() {
		const YRotation = this.Camera.TargetRotation.eulerAngles.y;
		this.Rigidbody.rotation = Quaternion.FromToRotation(
			Quaternion.Euler(0, this.Rigidbody.rotation.eulerAngles.y, 0).mul(Vector3.forward),
			Quaternion.Euler(0, YRotation, 0).mul(Vector3.forward),
		).mul(this.Rigidbody.rotation);
	}

	public TeleportTo(Target: CFrame) {
		this.transform.rotation = Target.Rotation;
		this.transform.position = Target.Position;
	}

	public DamageSelf(Damage: number) {
		const Character = Game.localPlayer.character;
		if (Core().Client.Objective.TimeTrials.IsActive()) {
			if (Character && Character.GetHealth() - Damage > 0) {
				this.Health -= Damage;
			} else {
				this.Input.KeyPressed("QuickRestart", true);
			}
		} else {
			this.Health -= Damage;

			if (Damage > 25) {
				this.SetVelocity(Vector3.up.mul(this.GetVelocity().y));
			}
		}
	}

	public Land() {
		this.VelocityLocked = false;
		this.LastLanded = os.clock();
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
					Core().Client.Sound.Play("roll");
					this.AnimationController.Current = "VM_Roll";
					Damage = 0;
				}

				this.Moveset.Base.ResetDash();
			} else {
				this.Moveset.Base.StartSlide(this);
			}
		}

		if (Damage > 0) {
			Core().Client.Sound.Play(Damage <= 25 ? "strongland" : "landhard");

			this.AnimationController.Current = `VM_Damage${Damage <= 25 ? "Light" : "Heavy"}`;

			this.DamageSelf(Damage);
		} else {
			this.Moveset.Base.OnAnimationEvent("Footstep", this)
		}

		this.Momentum = this.Rigidbody.linearVelocity.WithY(0).magnitude;
	}

	public ResetLastFallSpeed() {
		this.LastFallSpeed = 0;
	}

	public ResetState() {
		this.Health = 100;
		this._LastHealth = 100;

		this.ResetLastFallSpeed();
		this.Moveset.Base.ResetState();
		this.Moveset.Grappler.ResetState();

		this.Land();
		this.SetVelocity(Vector3.zero);
		this.Momentum = 0;
	}

	// Utility Functions - Getters/Setters
	public GetCFrame(Raw?: boolean) {
		return new CFrame(Raw ? this.transform.position : this.Rigidbody.worldCenterOfMass, this.Rigidbody.rotation);
	}

	public GetVelocity() {
		return this.Rigidbody.linearVelocity;
	}

	public SetVelocity(Velocity: Vector3) {
		this.Rigidbody.linearVelocity = Velocity;
		return Velocity;
	}

	// Lifecycle
	@Client()
	override Update() {
		if (!this._LOADED) return;

		this.Interactions.Update();
	}

	@Client()
	override FixedUpdate(FixedDT: number) {
		if (!this._LOADED) return;
		this.OnStepMovement(FixedDT);
	}

	@Client()
	public LateUpdate(DeltaTime: number) {
		if (!this._LOADED) return;
		this.OnStepViewmodel();
		let Target = CFrame.FromTransform(this.Animator.HeadTransform);

		if (this.State === "Slide") {
			Target = new CFrame(Target.Position, Target.Rotation.mul(Quaternion.Euler(-Target.Rotation.eulerAngles.x, 0, 0)));
		}

		const NewTarget = this.AnimationController.Current === "VM_Run" ? new CFrame(Target.Position, Quaternion.Euler(0, Target.Rotation.eulerAngles.y, 0)) : Target;
		this.CameraTarget = new CFrame(NewTarget.Position, Quaternion.Slerp(this.CameraTarget.Rotation, NewTarget.Rotation, Settings.CameraRotationLerp * DeltaTime));

		this.FOV = math.lerpClamped(this.FOV, this.FOVCurve.Evaluate(math.clamp01(this.GetVelocity().magnitude / 30)) * Settings.FOV, 2.5 * DeltaTime);
		this.Camera.Update(DeltaTime, this, this.CameraTarget, NewTarget, this.FOV);

		if (this.MatchCameraStates.includes(this.State)) this.RotateCharacterToCamera();

		this.Animator.Animate(DeltaTime);
		this.UI.LateUpdate(DeltaTime);

		this.Moveset.Grappler.DrawRope(this);
	}

	public OnStepMovement(FixedDT: number) {
		this.Input.UpdateInputs();
		this.Moveset.Base.StepMoveset(this, FixedDT);

		if (this.MatchCameraStates.includes(this.State)) this.RotateCharacterToCamera();

		switch (this.State) {
			case "Grounded":
				if (!this.Floor.Touching) {
					this.State = "Airborne";
					this.Moveset.Base.EndDash();
					this.LastFallSpeed = 0;
				}

				this.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
				this.Moveset.Base.TryStepUp(this);

				if (this.AnimationController.Current !== "VM_DamageHeavy") {
					this.Physics.AccelerateToInput(this, FixedDT);
				}

				if (!["VM_VaultStart", "VM_LedgeGrab", "VM_Roll", "VM_DamageLight", "VM_DamageHeavy"].includes(this.AnimationController.Current)) {
					this.AnimationController.Current = (this.Rigidbody.linearVelocity.magnitude > 0.03 && "VM_Run") || "VM_Idle";
				}
				this.AnimationController.Speed = this.AnimationController.Current === "VM_Run" ? this.RunAnimationCurve.Evaluate(this.Rigidbody.linearVelocity.magnitude) : 1;

				this.Moveset.World.StartObjects(this);
				break;
			case "Slide":
				this.Moveset.Base.StepSlide(this, FixedDT);
				this.Moveset.World.StartObjects(this);

				break;
			case "Dropdown":
				this.AirborneTime += FixedDT;

				this.Rigidbody.AddForce(Config.Gravity, ForceMode.Acceleration);
				break;
			case "Airborne":
				this.AirborneTime += FixedDT;

				this.Rigidbody.AddForce(this.Moveset.Base.GetJumpGravity(), ForceMode.Acceleration);
				this.Moveset.Base.StepJump(this, FixedDT);

				if (this.Rigidbody.linearVelocity.y < 0) this.LastFallSpeed = math.max(this.LastFallSpeed, -this.Rigidbody.linearVelocity.y);

				this.Physics.AccelerateToInput(this, FixedDT);

				this.Moveset.Base.TryStepUp(this);

				if (this.Floor.Touching && this.Rigidbody.linearVelocity.y <= 3.25) {
					this.Land();
				}

				if (!this.FallIgnoreAnimations.includes(this.AnimationController.Current) && this.AirborneTime >= Config.JumpCoyoteTime) {
					this.AnimationController.Current = "VM_Fall";
				}

				this.Moveset.World.StartObjects(this);
				break;
			case "Wallclimb":
				if (this.Moveset.Base.StepWallclimb(this, FixedDT)) {
					this.AnimationController.Current = "VM_Wallclimb";
				}

				this.Moveset.World.StartObjects(this);

				break;
			case "Wallrun":
				if (this.Moveset.Base.StepWallrun(this, FixedDT)) this.AnimationController.Current = `VM_Wallrun${this.Moveset.Base.WallrunTarget === this.WallrunL ? "L" : "R"}`;

				this.Moveset.World.StartObjects(this);

				break;
			case "Fly": {
				const Stick = this.Input.GetMoveVector();
				this.SetVelocity(this.Camera.TargetRotation.mul(Stick.add(new Vector3(0, Actions.Jump.Active ? 1 : 0, 0).normalized)).mul(Actions.FlyBoost.Active ? 100 : 35));
				this.AnimationController.Current = "VM_Fall";
				this.AirborneTime = 100;

				this.Moveset.World.StartObjects(this);

				break;
			}
			case "LadderClimb": {
				this.Moveset.World.StepLadder(this, FixedDT);

				break;
			}
		}

		this.OnStepHealing(FixedDT);

		Core().Client.Objective.TimeTrials.StepTrials(this);
	}

	public OnStepViewmodel() {
		const Rotation = this.GetCFrame().Rotation;

		let TargetRotation = Quaternion.LookRotation(Rotation.mul(Vector3.forward), Vector3.up);
		if (this.State === "Slide") {
			const [Hit, _, Normal] = Physics.Raycast(this.GetCFrame().Position, new Vector3(0, -1, 0), 2, Config.CollisionLayer);
			if (Hit) {
				TargetRotation = Quaternion.FromToRotation(Vector3.up, Normal).mul(TargetRotation);
			}
		}

		this.Animator.gameObject.transform.rotation = TargetRotation;
		this.Animator.gameObject.transform.position = this.transform.position.add(Rotation.mul(Vector3.forward.mul(0.1)));
	}

	public OnStepHealing(FixedDT: number) {
		if (this._LastHealth !== this.Health) {
			this.OnHealthChanged();

			if (this._LastHealth > this.Health) {
				this._LastHealthLowered = os.clock();
			}
			this._LastHealthChanged = os.clock();
			this._LastHealth = this.Health;
		}

		if (this.Health < 100 && os.clock() - this._LastHealthLowered >= 2.5) {
			const HealRate = (os.clock() - this._LastHealthLowered - 2.5) * 2.5;
			this.Health = math.clamp(this.Health + HealRate * FixedDT, 0, 100);
		}
	}

	private OnHealthChanged() {
		if (this.Health <= 0) {
			if (Core().Client.Objective.TimeTrials.IsActive()) {
				Core().Client.Objective.TimeTrials.Restart(this);
			} else {
				Network.Effect.Respawn.client.FireServer();
			}
		}
	}
}

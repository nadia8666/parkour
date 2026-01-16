import { Asset } from "@Easy/Core/Shared/Asset";
import Config from "Code/Client/Config";
import Core from "Code/Core/Core";
import type ClientComponent from "../ClientComponent";
import { Actions } from "../Input";
import { Raycast } from "./Base";

const HitTemplate = Asset.LoadAsset("Assets/Resources/Prefabs/Gear/Grappler/GrapplerHit.prefab");
const Rope = Instantiate(Asset.LoadAsset("Assets/Resources/Prefabs/Gear/Grappler/GrappleRope.prefab"));

export class MovesetGrappler {
	public Active = false;
	public HasHit = false;
	public HitDelay = 0;
	public Duration = 0;
	public MaxLength = 1;
	public TargetPos = Vector3.zero;

	public StartGrapple(Controller: ClientComponent) {
		if (Controller.Gear.Ammo.Grappler < 1 || this.Active) return;
		const Target = Controller.Camera.TargetRotation;
		const Origin = Controller.GetCFrame().Position;
		const GrappleCast = Raycast(Origin, Target.mul(Vector3.forward), Config.GrapplerMaxDistance());
		if (GrappleCast.Hit) {
			this.ResetState();

			if (!["Grounded", "Slide"].includes(Controller.State)) {
				Controller.Gear.Ammo.Grappler--;
			}

			this.Active = true;

			this.HitDelay = math.max(math.clamp01(GrappleCast.Pos.sub(Origin).magnitude / Config.GrapplerMaxDistance()) * Config.GrapplerAttachTime(), Config.GrapplerMinAttachTime);
			this.MaxLength = this.HitDelay + Config.GrapplerMaxYankTime;
			this.TargetPos = GrappleCast.Pos;

			Core().Client.Sound.Play("grapplethrow");
			Core().Client.Sound.Play("grapplethrowspring", { Volume: 0.4 });
		}
	}

	public StepGrapple(Controller: ClientComponent, FixedDT: number) {
		if (this.Active) {
			this.Duration += FixedDT;
			const Origin = Controller.GetCFrame().Position;

			if (this.Duration > this.HitDelay) {
				if (!this.HasHit) {
					this.HasHit = true;
					Core().Client.Sound.Play("grapplepull");

					const HitParticle = Instantiate(HitTemplate, this.TargetPos, Quaternion.LookRotation(Origin.sub(this.TargetPos).normalized));
					Destroy(HitParticle, 2);
				}
				if (!Actions.CoreUse.Active || this.Duration >= this.MaxLength) {
					const YankForce = math.clamp01(1 - math.map(this.Duration - this.HitDelay, 0, this.MaxLength - this.HitDelay, 0, 1) + 0.25);

					Controller.SetVelocity(Controller.GetVelocity().add(this.TargetPos.sub(Origin).normalized.mul(YankForce * Config.GrapplerYankForce())));

					this.ResetState();
					Core().Client.Sound.Play("grapplethrowspring", { Volume: 0.4 });
				}
			} else if (!Actions.CoreUse.Active) {
				this.ResetState();
			}
		}

		this.UpdateUI();
	}

	public ResetState() {
		this.Active = false;
		this.Duration = 0;
		this.HasHit = false;
	}

	private UpdateUI() {}

	public DrawRope(Controller: ClientComponent) {
		Rope.SetActive(this.Active);

		if (this.Active) {
			const Alpha = math.clamp01(this.Duration / this.HitDelay);
			const Origin = Controller.AnimationController.Component.GrappleTransform.position;
			const EndPos = Origin.Lerp(this.TargetPos, Alpha);
			const MidPoint = Origin.Lerp(EndPos, 0.5);
			const Length = Origin.sub(EndPos).magnitude;
			const Look = this.TargetPos.sub(Origin).normalized;

			Rope.transform.position = MidPoint;
			Rope.transform.localScale = Rope.transform.localScale.WithY(Length);
			Rope.transform.rotation = Quaternion.LookRotation(Look).mul(Quaternion.Euler(90, 0, 0));
		}
	}
}

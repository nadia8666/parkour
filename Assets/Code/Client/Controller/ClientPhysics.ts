import Config from "../Config";
import type ClientComponent from "./ClientComponent";

function SignVector(Vector: Vector3) {
	return new Vector3(Vector.x !== 0 ? (Vector.x > 0 ? 1 : -1) : 0, Vector.y !== 0 ? (Vector.y > 0 ? 1 : -1) : 0, Vector.z !== 0 ? (Vector.z > 0 ? 1 : -1) : 0);
}

function WrapFriction(Current: number, Input: number) {
	if (Input === 0) {
		return 1;
	} else {
		if (math.sign(Current) === math.sign(Input)) {
			return 0;
		} else {
			return 1;
		}
	}
}

export class ClientPhysics {
	public AccelerateToInput(Controller: ClientComponent, FixedDT: number) {
		const Base = Controller.Moveset.Base;
		const Sliding = Controller.State === "Slide";
		const Grounded = Controller.State === "Grounded";
		const LocalMoveVector = Sliding ? new Vector3(Controller.Input.GetMoveVector().x, 0, 1).normalized : Controller.Input.GetMoveVector();

		const TargetVelocity = Controller.Rigidbody.transform.TransformDirection(LocalMoveVector);
		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;
		const AccelerationForce =
			Controller.AccelerationCurve.Evaluate(CurrentVelocity / Config.RunMaxSpeed) *
			Config.RunMaxSpeed *
			(Grounded ? 1 : 1) *
			(Grounded && Base.DashActive() ? 1.5 : 1) *
			(Sliding ? 0.35 : 1);
		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		const MVFriction = LocalMoveVector.magnitude > 0 ? 1 : Grounded ? 1 : 0.1;
		const FrictionRate = (Grounded ? 0.25 : 0.1) * FixedDT * Config.ReferenceFPS * MVFriction;

		const MomentumDecay = FrictionRate * this.GetMomentumFriction(Controller.Momentum);
		Controller.Momentum = math.max(0, Controller.Momentum - MomentumDecay);

		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.MoveTowards(Vector3.zero, FrictionRate);
		Controller.Rigidbody.AddForce(GlobalMoveVector.mul(AccelerationForce), ForceMode.Acceleration);

		let AccelAlignment = 0;
		if (GlobalMoveVector.magnitude > 0) {
			const HorizontalVel = Controller.Rigidbody.linearVelocity.WithY(0);
			AccelAlignment = HorizontalVel.magnitude > 0 ? math.max(0, GlobalMoveVector.Dot(HorizontalVel.normalized)) : 1;
		}

		// extra friction for smoother control
		const FrictionScalar = -(Grounded ? 0.3 : 0.15) * FixedDT * Config.ReferenceFPS * MVFriction;
		const SignVec = SignVector(LocalMoveVector);
		const LocalForce = Controller.transform.InverseTransformDirection(Controller.Rigidbody.linearVelocity);
		const TargetFriction = new Vector3(WrapFriction(LocalForce.x, SignVec.x), 0, WrapFriction(LocalForce.z, SignVec.z)).mul(FrictionScalar);
		const FrictionVector = LocalForce.mul(TargetFriction);
		Controller.Rigidbody.linearVelocity = Controller.transform.TransformDirection(LocalForce.add(FrictionVector));

		const DeltaMomentum = (AccelerationForce / 40) * FixedDT * Config.ReferenceFPS * AccelAlignment;
		Controller.Momentum = math.max(Controller.Momentum + DeltaMomentum, 0);

		// velocity angling
		if (TargetVelocity.magnitude > 0.25) {
			const RedirectForce = Controller.VelocityLocked ? 0.1 : 1;
			const Speed = Controller.GetVelocity();
			Controller.SetVelocity(
				Speed.WithY(0)
					.normalized.Slerp(TargetVelocity.WithY(0), math.clamp01(FixedDT * 2.5 * RedirectForce))
					.mul(Speed.WithY(0).magnitude)
					.WithY(Speed.y),
			);
		}

		Base.SyncMomentum(Controller, FixedDT);
	}

	private GetMomentumFriction(Momentum: number) {
		const Alpha = math.max((Momentum - 10) / 30, 0);

		return 1 + Alpha ** 1.75 * 6;
	}
}

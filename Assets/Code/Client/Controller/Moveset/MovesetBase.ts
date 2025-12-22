import { Keyboard } from "@Easy/Core/Shared/UserInput";
import type ClientController from "../ClientController";

export class MovesetBase {
	public JumpTimer = 0;

	public Jump(Controller: ClientController) {
		if (Keyboard.IsKeyDown(Key.Space)) {
			Controller.Rigidbody.AddForce(new Vector3(0, 6, 0), ForceMode.VelocityChange);

			this.JumpTimer = 1;
		}
	}

	public JumpHold(Controller: ClientController) {
		if (this.JumpTimer <= 0) return;

		if (Keyboard.IsKeyDown(Key.Space)) {
			this.JumpTimer -= 1 / 60;
			Controller.Rigidbody.AddForce(new Vector3(0, this.JumpTimer / 3, 0), ForceMode.VelocityChange);
		} else {
			this.JumpTimer = 0;
		}
	}

	public Walk(Controller: ClientController) {
		const LocalMoveVector = new Vector3(
			(Keyboard.IsKeyDown(Key.A) ? -1 : 0) + (Keyboard.IsKeyDown(Key.D) ? 1 : 0),
			0,
			(Keyboard.IsKeyDown(Key.S) ? -1 : 0) + (Keyboard.IsKeyDown(Key.W) ? 1 : 0),
		);

		const TargetVelocity = Controller.Rigidbody.transform.TransformVector(LocalMoveVector);

		const CurrentVelocity = Controller.Rigidbody.linearVelocity.WithY(0).magnitude;

		const AccelerationForce = Controller.AccelerationCurve.Evaluate(math.clamp(CurrentVelocity, 0, 15) / 15) * 20;

		const GlobalMoveVector = TargetVelocity.magnitude > 0 ? TargetVelocity.normalized : Vector3.zero;

		Controller.Rigidbody.linearVelocity = Controller.Rigidbody.linearVelocity.MoveTowards(Vector3.zero.WithY(Controller.Rigidbody.linearVelocity.y), 0.15);

		if (TargetVelocity.magnitude <= 0) return;

		Controller.Rigidbody.AddForce(GlobalMoveVector.mul(AccelerationForce), ForceMode.Acceleration);
	}
}
